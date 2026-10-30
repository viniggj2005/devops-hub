package vulpesHandlers

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const (
	grpcMaxMessageBytes = 64 << 20
	reflectionTimeout   = 20 * time.Second
)

type grpcCall struct {
	types      *dynamicpb.Types
	method     protoreflect.MethodDescriptor
	request    vulpesDtos.GrpcRequestDto
	metadata   metadata.MD
	resolver   *vulpesFunctions.VariableResolver
	connection *grpc.ClientConn
}

type grpcStreamSession struct {
	emit       func(vulpesDtos.RealtimeEventDto)
	call       *grpcCall
	cancel     context.CancelFunc
	stream     grpc.ClientStream
	sendMutex  sync.Mutex
	closeOnce  sync.Once
	sendClosed bool
}

func dialGrpc(grpcRequest vulpesDtos.GrpcRequestDto) (*grpc.ClientConn, error) {
	address, secure, err := vulpesFunctions.ParseGrpcTarget(grpcRequest.Url, grpcRequest.UseTls)
	if err != nil {
		return nil, err
	}
	transportCredentials := insecure.NewCredentials()
	if secure {
		transportCredentials = credentials.NewTLS(&tls.Config{InsecureSkipVerify: grpcRequest.SkipTlsVerify})
	}
	return grpc.NewClient(address,
		grpc.WithTransportCredentials(transportCredentials),
		grpc.WithUserAgent(vulpesFunctions.DefaultUserAgent),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(grpcMaxMessageBytes), grpc.MaxCallSendMsgSize(grpcMaxMessageBytes)),
	)
}

func grpcMetadata(grpcRequest vulpesDtos.GrpcRequestDto, auth vulpesDtos.AuthDto) metadata.MD {
	callMetadata := metadata.MD{}
	for _, entry := range grpcRequest.Metadata {
		if key := strings.ToLower(strings.TrimSpace(entry.Key)); entry.Enabled && key != "" {
			callMetadata.Append(key, entry.Value)
		}
	}
	authEntries := vulpesFunctions.BuildAuthEntries(auth)
	for _, entry := range append(authEntries.Headers, authEntries.Query...) {
		if key := strings.ToLower(entry.Key); len(callMetadata.Get(key)) == 0 {
			callMetadata.Set(key, entry.Value)
		}
	}
	return callMetadata
}

func loadGrpcDescriptors(callContext context.Context, connection *grpc.ClientConn, grpcRequest vulpesDtos.GrpcRequestDto, callMetadata metadata.MD) (*vulpesFunctions.GrpcDescriptorSource, error) {
	if grpcRequest.DescriptorSource == vulpesDtos.DescriptorProtoFiles {
		return vulpesFunctions.LoadProtoFiles(grpcRequest.ProtoFiles, grpcRequest.ImportPaths)
	}
	reflectionContext, cancel := context.WithTimeout(metadata.NewOutgoingContext(callContext, callMetadata), reflectionTimeout)
	defer cancel()
	return vulpesFunctions.LoadReflectionDescriptors(reflectionContext, connection)
}

func (handlerStruct *VulpesClientHandlerStruct) prepareGrpcCall(callContext context.Context, token string, input vulpesDtos.ExecutionInputDto) (*grpcCall, *vulpesFunctions.GrpcDescriptorSource, error) {
	plan, err := handlerStruct.prepareExecution(callContext, token, input)
	if err != nil {
		return nil, nil, err
	}
	if plan.request.Grpc == nil {
		return nil, nil, errors.New("a requisição não é gRPC")
	}
	grpcRequest := plan.resolver.ResolveGrpcRequest(*plan.request.Grpc)
	if err := plan.resolver.TakeError(); err != nil {
		return nil, nil, err
	}
	connection, err := dialGrpc(grpcRequest)
	if err != nil {
		return nil, nil, err
	}
	callMetadata := grpcMetadata(grpcRequest, plan.auth)
	source, err := loadGrpcDescriptors(callContext, connection, grpcRequest, callMetadata)
	if err != nil {
		connection.Close()
		return nil, nil, err
	}
	return &grpcCall{
		types:      source.Types(),
		request:    grpcRequest,
		metadata:   callMetadata,
		resolver:   plan.resolver,
		connection: connection,
	}, source, nil
}

func (call *grpcCall) decodeMessage(text string, descriptor protoreflect.MessageDescriptor) (*dynamicpb.Message, error) {
	message := dynamicpb.NewMessage(descriptor)
	if strings.TrimSpace(text) == "" {
		text = "{}"
	}
	if err := (protojson.UnmarshalOptions{Resolver: call.types}).Unmarshal([]byte(text), message); err != nil {
		return nil, fmt.Errorf("a mensagem não corresponde a %s: %w", descriptor.FullName(), err)
	}
	return message, nil
}

func (call *grpcCall) encodeMessage(message *dynamicpb.Message) string {
	encoded, err := protojson.MarshalOptions{Multiline: true, Indent: "  ", Resolver: call.types, EmitUnpopulated: true}.Marshal(message)
	if err != nil {
		return fmt.Sprintf("<não foi possível converter a resposta: %v>", err)
	}
	return string(encoded)
}

func metadataEntries(values metadata.MD) []vulpesDtos.HeaderDto {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	entries := []vulpesDtos.HeaderDto{}
	for _, key := range keys {
		for _, value := range values[key] {
			entries = append(entries, vulpesDtos.HeaderDto{Key: key, Value: value})
		}
	}
	return entries
}

func (handlerStruct *VulpesClientHandlerStruct) ListGrpcServices(callContext context.Context, token string, input vulpesDtos.ExecutionInputDto) ([]vulpesDtos.GrpcServiceDto, error) {
	call, source, err := handlerStruct.prepareGrpcCall(callContext, token, input)
	if err != nil {
		return nil, err
	}
	defer call.connection.Close()

	services := []vulpesDtos.GrpcServiceDto{}
	for _, service := range source.Services() {
		methods := []vulpesDtos.GrpcMethodDto{}
		descriptors := service.Methods()
		for index := 0; index < descriptors.Len(); index++ {
			method := descriptors.Get(index)
			methods = append(methods, vulpesDtos.GrpcMethodDto{
				Name:            string(method.Name()),
				FullName:        string(service.FullName()) + "/" + string(method.Name()),
				InputType:       string(method.Input().FullName()),
				OutputType:      string(method.Output().FullName()),
				ExampleMessage:  vulpesFunctions.ExampleMessageJson(method.Input()),
				ClientStreaming: method.IsStreamingClient(),
				ServerStreaming: method.IsStreamingServer(),
			})
		}
		services = append(services, vulpesDtos.GrpcServiceDto{Name: string(service.FullName()), Methods: methods})
	}
	return services, nil
}

func (handlerStruct *VulpesClientHandlerStruct) InvokeGrpc(callContext context.Context, token string, input vulpesDtos.ExecutionInputDto) (*vulpesDtos.GrpcResponseDto, error) {
	call, source, err := handlerStruct.prepareGrpcCall(callContext, token, input)
	if err != nil {
		return nil, err
	}
	defer call.connection.Close()

	method, err := source.FindMethod(call.request.Method)
	if err != nil {
		return nil, err
	}
	if method.IsStreamingClient() || method.IsStreamingServer() {
		return nil, errors.New("este método usa streaming; inicie um stream para utilizá-lo")
	}
	requestMessage, err := call.decodeMessage(call.request.Message, method.Input())
	if err != nil {
		return nil, err
	}

	invokeContext := metadata.NewOutgoingContext(callContext, call.metadata)
	if call.request.TimeoutMs > 0 {
		var cancel context.CancelFunc
		invokeContext, cancel = context.WithTimeout(invokeContext, time.Duration(call.request.TimeoutMs)*time.Millisecond)
		defer cancel()
	}

	var header, trailer metadata.MD
	responseMessage := dynamicpb.NewMessage(method.Output())
	started := time.Now()
	invokeError := call.connection.Invoke(invokeContext, vulpesFunctions.MethodPath(method), requestMessage, responseMessage, grpc.Header(&header), grpc.Trailer(&trailer))
	callStatus := status.Convert(invokeError)

	response := &vulpesDtos.GrpcResponseDto{
		Code:          callStatus.Code().String(),
		Headers:       metadataEntries(header),
		Trailers:      metadataEntries(trailer),
		StatusCode:    int(callStatus.Code()),
		DurationMs:    elapsedMs(started, time.Now()),
		StatusMessage: callStatus.Message(),
	}
	if invokeError == nil {
		response.Message = call.encodeMessage(responseMessage)
	}
	return response, nil
}

func (handlerStruct *VulpesClientHandlerStruct) StartGrpcStream(callContext context.Context, token string, sessionID string, input vulpesDtos.ExecutionInputDto) error {
	call, source, err := handlerStruct.prepareGrpcCall(callContext, token, input)
	if err != nil {
		return err
	}
	method, err := source.FindMethod(call.request.Method)
	if err != nil {
		call.connection.Close()
		return err
	}
	if !method.IsStreamingClient() && !method.IsStreamingServer() {
		call.connection.Close()
		return errors.New("este método é unário; use Invocar")
	}
	call.method = method

	outgoingContext := metadata.NewOutgoingContext(handlerStruct.baseContext(), call.metadata)
	var cancel context.CancelFunc
	var streamContext context.Context
	if call.request.TimeoutMs > 0 {
		streamContext, cancel = context.WithTimeout(outgoingContext, time.Duration(call.request.TimeoutMs)*time.Millisecond)
	} else {
		streamContext, cancel = context.WithCancel(outgoingContext)
	}
	stream, err := call.connection.NewStream(streamContext, &grpc.StreamDesc{
		StreamName:    string(method.Name()),
		ServerStreams: method.IsStreamingServer(),
		ClientStreams: method.IsStreamingClient(),
	}, vulpesFunctions.MethodPath(method))
	if err != nil {
		cancel()
		call.connection.Close()
		return fmt.Errorf("não foi possível iniciar o stream: %w", err)
	}

	key, windowName := handlerStruct.sessionKey(callContext, sessionID)
	session := &grpcStreamSession{
		emit:   handlerStruct.eventEmitter(windowName, sessionID),
		call:   call,
		cancel: cancel,
		stream: stream,
	}
	handlerStruct.registerSession(key, session)
	session.emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeConnected,
		Data:      vulpesFunctions.MethodPath(method),
		Direction: vulpesDtos.DirectionSystem,
	})

	if !method.IsStreamingClient() {
		if err := session.send(call.request.Message); err != nil {
			handlerStruct.forgetSession(key, session)
			session.close()
			return err
		}
		if err := session.closeSend(); err != nil {
			handlerStruct.forgetSession(key, session)
			session.close()
			return err
		}
	}

	go session.receive(func() { handlerStruct.forgetSession(key, session) })
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) findGrpcSession(callContext context.Context, token string, sessionID string) (*grpcStreamSession, error) {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return nil, err
	}
	key, _ := handlerStruct.sessionKey(callContext, sessionID)
	session, isGrpc := handlerStruct.findSession(key).(*grpcStreamSession)
	if !isGrpc {
		return nil, errSessionNotFound
	}
	return session, nil
}

func (handlerStruct *VulpesClientHandlerStruct) SendGrpcStreamMessage(callContext context.Context, token string, sessionID string, message string) error {
	session, err := handlerStruct.findGrpcSession(callContext, token, sessionID)
	if err != nil {
		return err
	}
	return session.send(message)
}

func (handlerStruct *VulpesClientHandlerStruct) EndGrpcStream(callContext context.Context, token string, sessionID string) error {
	session, err := handlerStruct.findGrpcSession(callContext, token, sessionID)
	if err != nil {
		return err
	}
	return session.closeSend()
}

func (session *grpcStreamSession) send(text string) error {
	resolved := session.call.resolver.Resolve(text)
	if err := session.call.resolver.TakeError(); err != nil {
		return err
	}
	message, err := session.call.decodeMessage(resolved, session.call.method.Input())
	if err != nil {
		return err
	}

	session.sendMutex.Lock()
	defer session.sendMutex.Unlock()
	if session.sendClosed {
		return errors.New("o envio deste stream já foi finalizado")
	}
	if err := session.stream.SendMsg(message); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("o servidor já encerrou o stream")
		}
		return err
	}
	session.emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMessage,
		Data:      session.call.encodeMessage(message),
		Direction: vulpesDtos.DirectionOutgoing,
	})
	return nil
}

func (session *grpcStreamSession) closeSend() error {
	session.sendMutex.Lock()
	defer session.sendMutex.Unlock()
	if session.sendClosed {
		return nil
	}
	session.sendClosed = true
	if err := session.stream.CloseSend(); err != nil {
		return err
	}
	session.emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMessage,
		Data:      "Envio finalizado",
		Direction: vulpesDtos.DirectionSystem,
	})
	return nil
}

func (session *grpcStreamSession) receive(onFinish func()) {
	defer func() {
		onFinish()
		session.close()
	}()

	if header, err := session.stream.Header(); err == nil {
		session.emitMetadata(header, "headers")
	}

	for {
		message := dynamicpb.NewMessage(session.call.method.Output())
		err := session.stream.RecvMsg(message)
		if err == nil {
			session.emit(vulpesDtos.RealtimeEventDto{
				Kind:      vulpesDtos.RealtimeMessage,
				Data:      session.call.encodeMessage(message),
				Direction: vulpesDtos.DirectionIncoming,
			})
			continue
		}

		callStatus := status.Convert(err)
		if errors.Is(err, io.EOF) {
			callStatus = status.New(codes.OK, "")
		}
		session.emitMetadata(session.stream.Trailer(), "trailers")
		session.emit(vulpesDtos.RealtimeEventDto{
			Kind:      vulpesDtos.RealtimeClosed,
			Data:      callStatus.Message(),
			Event:     callStatus.Code().String(),
			Direction: vulpesDtos.DirectionSystem,
		})
		return
	}
}

func (session *grpcStreamSession) emitMetadata(values metadata.MD, label string) {
	if len(values) == 0 {
		return
	}
	encoded, _ := json.MarshalIndent(metadataEntries(values), "", "  ")
	session.emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMetadata,
		Data:      string(encoded),
		Event:     label,
		Direction: vulpesDtos.DirectionIncoming,
	})
}

func (session *grpcStreamSession) close() {
	session.closeOnce.Do(func() {
		session.cancel()
		session.call.connection.Close()
	})
}
