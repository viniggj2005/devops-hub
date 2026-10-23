package vulpesHandlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const legacySocketIoVersion = "v2"

type pendingBinaryPacket struct {
	packet      vulpesFunctions.SocketIoPacket
	attachments [][]byte
}

type socketIoSession struct {
	emit           func(vulpesDtos.RealtimeEventDto)
	cancel         context.CancelFunc
	pending        *pendingBinaryPacket
	version        string
	resolver       *vulpesFunctions.VariableResolver
	namespace      string
	closeOnce      sync.Once
	nextAckID      atomic.Int64
	connection     *websocket.Conn
	closedByClient atomic.Bool
}

func (handlerStruct *VulpesClientHandlerStruct) ConnectSocketIo(callContext context.Context, token string, sessionID string, input vulpesDtos.ExecutionInputDto) error {
	resolver, request, auth, err := handlerStruct.prepareExecution(token, input)
	if err != nil {
		return err
	}
	if request.SocketIo == nil {
		return errors.New("a requisição não é Socket.IO")
	}
	socketRequest := resolver.ResolveSocketIoRequest(*request.SocketIo)
	authEntries := vulpesFunctions.BuildAuthEntries(auth)
	endpoint, namespace, err := vulpesFunctions.SocketIoEndpoint(socketRequest.Url, socketRequest.Path, socketRequest.Namespace, socketRequest.Version)
	if err != nil {
		return err
	}
	endpoint = vulpesFunctions.AppendQuery(endpoint, authEntries.Query)

	key, windowName := handlerStruct.sessionKey(callContext, sessionID)
	emit := handlerStruct.eventEmitter(windowName, sessionID)
	emit(vulpesDtos.RealtimeEventDto{Kind: vulpesDtos.RealtimeConnecting, Data: endpoint, Direction: vulpesDtos.DirectionSystem})

	headers := requestHeaders(socketRequest.Headers, authEntries)
	connection, err := handlerStruct.dialRealtime(callContext, endpoint, headers, nil, socketRequest.SkipTlsVerify)
	if err != nil {
		return err
	}

	sessionContext, cancel := context.WithCancel(handlerStruct.baseContext())
	session := &socketIoSession{
		emit:       emit,
		cancel:     cancel,
		version:    socketRequest.Version,
		resolver:   resolver,
		namespace:  namespace,
		connection: connection,
	}
	handshakeContext, cancelHandshake := context.WithTimeout(callContext, dialTimeout)
	defer cancelHandshake()
	open, err := session.handshake(handshakeContext, socketRequest.HandshakeAuth)
	if err != nil {
		cancel()
		connection.CloseNow()
		return err
	}

	handlerStruct.registerSession(key, session)
	emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeConnected,
		Data:      fmt.Sprintf("Namespace %s conectado", namespace),
		Event:     open.Sid,
		Direction: vulpesDtos.DirectionSystem,
	})
	go session.read(sessionContext, func() { handlerStruct.forgetSession(key, session) })
	if session.version == legacySocketIoVersion && open.PingInterval > 0 {
		go session.ping(sessionContext, time.Duration(open.PingInterval)*time.Millisecond)
	}
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) EmitSocketIo(callContext context.Context, token string, sessionID string, input vulpesDtos.SocketIoEmitInputDto) error {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return err
	}
	key, _ := handlerStruct.sessionKey(callContext, sessionID)
	session, isSocketIo := handlerStruct.findSession(key).(*socketIoSession)
	if !isSocketIo {
		return errSessionNotFound
	}

	event := strings.TrimSpace(session.resolver.Resolve(input.Event))
	arguments := vulpesFunctions.SocketIoArguments(session.resolver.ResolveAll(input.Arguments))
	payload, err := vulpesFunctions.SocketIoEventPayload(event, arguments)
	if err != nil {
		return err
	}
	packet := vulpesFunctions.SocketIoPacket{Type: vulpesFunctions.SocketEvent, Namespace: session.namespace, Data: payload}
	if input.WithAck {
		packet.AckID, packet.HasAckID = session.nextAckID.Add(1), true
	}

	writeContext, cancel := context.WithTimeout(callContext, writeTimeout)
	defer cancel()
	if err := session.writePacket(writeContext, packet); err != nil {
		return fmt.Errorf("não foi possível emitir o evento: %w", err)
	}
	session.emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMessage,
		Data:      vulpesFunctions.DisplayArguments(arguments),
		AckID:     packet.AckID,
		Event:     event,
		HasAck:    packet.HasAckID,
		Direction: vulpesDtos.DirectionOutgoing,
	})
	return nil
}

func (session *socketIoSession) writeText(ctx context.Context, text string) error {
	return session.connection.Write(ctx, websocket.MessageText, []byte(text))
}

func (session *socketIoSession) writePacket(ctx context.Context, packet vulpesFunctions.SocketIoPacket) error {
	return session.writeText(ctx, string(vulpesFunctions.EngineMessage)+vulpesFunctions.EncodeSocketIoPacket(packet))
}

func (session *socketIoSession) handshake(ctx context.Context, handshakeAuth string) (vulpesFunctions.EngineOpenPayload, error) {
	var open vulpesFunctions.EngineOpenPayload
	opened := false
	for !opened {
		text, err := session.readText(ctx)
		if err != nil {
			return open, fmt.Errorf("o servidor não iniciou a sessão Socket.IO: %w", err)
		}
		if text != "" && text[0] == vulpesFunctions.EngineOpen {
			if err := json.Unmarshal([]byte(text[1:]), &open); err != nil {
				return open, fmt.Errorf("handshake Engine.IO inválido: %w", err)
			}
			opened = true
		}
	}

	connectPacket := vulpesFunctions.SocketIoPacket{Type: vulpesFunctions.SocketConnect, Namespace: session.namespace}
	if session.version != legacySocketIoVersion {
		if handshakeAuth = strings.TrimSpace(handshakeAuth); handshakeAuth != "" {
			if !strings.HasPrefix(handshakeAuth, "{") || !json.Valid([]byte(handshakeAuth)) {
				return open, errors.New("o auth do handshake precisa ser um objeto JSON")
			}
			connectPacket.Data = json.RawMessage(handshakeAuth)
		}
	}
	if session.version != legacySocketIoVersion || session.namespace != "/" {
		if err := session.writePacket(ctx, connectPacket); err != nil {
			return open, err
		}
	}

	for {
		text, err := session.readText(ctx)
		if err != nil {
			return open, fmt.Errorf("o servidor não confirmou a conexão do namespace %s: %w", session.namespace, err)
		}
		if text == "" {
			continue
		}
		switch text[0] {
		case vulpesFunctions.EnginePing:
			if err := session.writeText(ctx, string(vulpesFunctions.EnginePong)+text[1:]); err != nil {
				return open, err
			}
		case vulpesFunctions.EngineClose:
			return open, errors.New("o servidor encerrou a conexão durante o handshake")
		case vulpesFunctions.EngineMessage:
			packet, err := vulpesFunctions.ParseSocketIoPacket(text[1:])
			if err != nil || packet.Namespace != session.namespace {
				continue
			}
			switch packet.Type {
			case vulpesFunctions.SocketConnect:
				return open, nil
			case vulpesFunctions.SocketConnectError:
				return open, fmt.Errorf("o servidor recusou a conexão: %s", connectErrorMessage(packet.Data))
			}
		}
	}
}

func (session *socketIoSession) readText(ctx context.Context) (string, error) {
	for {
		messageType, data, err := session.connection.Read(ctx)
		if err != nil {
			return "", err
		}
		if messageType == websocket.MessageText {
			return string(data), nil
		}
	}
}

func connectErrorMessage(data json.RawMessage) string {
	var payload struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(data, &payload) == nil && payload.Message != "" {
		return payload.Message
	}
	var message string
	if json.Unmarshal(data, &message) == nil && message != "" {
		return message
	}
	if len(data) > 0 {
		return string(data)
	}
	return "motivo não informado"
}

func (session *socketIoSession) read(sessionContext context.Context, onFinish func()) {
	defer func() {
		onFinish()
		session.cancel()
		session.connection.CloseNow()
	}()
	for {
		messageType, data, err := session.connection.Read(sessionContext)
		if err != nil {
			emitRealtimeClosure(session.emit, err, session.closedByClient.Load())
			return
		}
		if messageType == websocket.MessageBinary {
			session.receiveAttachment(data)
			continue
		}
		if session.handleEnginePacket(sessionContext, string(data)) {
			return
		}
	}
}

func (session *socketIoSession) handleEnginePacket(ctx context.Context, text string) bool {
	if text == "" {
		return false
	}
	switch text[0] {
	case vulpesFunctions.EnginePing:
		writeContext, cancel := context.WithTimeout(ctx, writeTimeout)
		defer cancel()
		_ = session.writeText(writeContext, string(vulpesFunctions.EnginePong)+text[1:])
	case vulpesFunctions.EngineClose:
		session.emit(vulpesDtos.RealtimeEventDto{Kind: vulpesDtos.RealtimeClosed, Data: "O servidor encerrou a conexão", Direction: vulpesDtos.DirectionSystem})
		return true
	case vulpesFunctions.EngineMessage:
		return session.handleSocketPacket(text[1:])
	}
	return false
}

func (session *socketIoSession) handleSocketPacket(text string) bool {
	packet, err := vulpesFunctions.ParseSocketIoPacket(text)
	if err != nil {
		session.emit(vulpesDtos.RealtimeEventDto{Kind: vulpesDtos.RealtimeError, Data: err.Error(), Direction: vulpesDtos.DirectionSystem})
		return false
	}
	if packet.Namespace != session.namespace {
		return false
	}
	if packet.Attachments > 0 {
		session.pending = &pendingBinaryPacket{packet: packet}
		return false
	}
	return session.dispatch(packet)
}

func (session *socketIoSession) receiveAttachment(data []byte) {
	if session.pending == nil {
		return
	}
	if session.version == legacySocketIoVersion && len(data) > 0 && data[0] == 4 {
		data = data[1:]
	}
	session.pending.attachments = append(session.pending.attachments, data)
	if len(session.pending.attachments) < session.pending.packet.Attachments {
		return
	}
	packet := session.pending.packet
	packet.Data = replacePlaceholders(packet.Data, session.pending.attachments)
	session.pending = nil
	session.dispatch(packet)
}

func (session *socketIoSession) dispatch(packet vulpesFunctions.SocketIoPacket) bool {
	switch packet.Type {
	case vulpesFunctions.SocketEvent, vulpesFunctions.SocketBinaryEvent:
		event, arguments := vulpesFunctions.SplitSocketIoEvent(packet.Data)
		session.emit(vulpesDtos.RealtimeEventDto{
			Kind:      vulpesDtos.RealtimeMessage,
			Data:      vulpesFunctions.DisplayArguments(arguments),
			AckID:     packet.AckID,
			Event:     event,
			HasAck:    packet.HasAckID,
			Direction: vulpesDtos.DirectionIncoming,
		})
	case vulpesFunctions.SocketAck, vulpesFunctions.SocketBinaryAck:
		var arguments []json.RawMessage
		_ = json.Unmarshal(packet.Data, &arguments)
		session.emit(vulpesDtos.RealtimeEventDto{
			Kind:      vulpesDtos.RealtimeAck,
			Data:      vulpesFunctions.DisplayArguments(arguments),
			AckID:     packet.AckID,
			HasAck:    true,
			Direction: vulpesDtos.DirectionIncoming,
		})
	case vulpesFunctions.SocketConnectError:
		session.emit(vulpesDtos.RealtimeEventDto{Kind: vulpesDtos.RealtimeError, Data: connectErrorMessage(packet.Data), Direction: vulpesDtos.DirectionSystem})
	case vulpesFunctions.SocketDisconnect:
		session.emit(vulpesDtos.RealtimeEventDto{Kind: vulpesDtos.RealtimeClosed, Data: "O servidor desconectou o namespace", Direction: vulpesDtos.DirectionSystem})
		return true
	}
	return false
}

func replacePlaceholders(data json.RawMessage, attachments [][]byte) json.RawMessage {
	var decoded any
	if json.Unmarshal(data, &decoded) != nil {
		return data
	}
	var replace func(value any) any
	replace = func(value any) any {
		switch typed := value.(type) {
		case map[string]any:
			if placeholder, _ := typed["_placeholder"].(bool); placeholder {
				if position, isNumber := typed["num"].(float64); isNumber && int(position) < len(attachments) {
					return base64.StdEncoding.EncodeToString(attachments[int(position)])
				}
			}
			for key, nested := range typed {
				typed[key] = replace(nested)
			}
		case []any:
			for position, nested := range typed {
				typed[position] = replace(nested)
			}
		}
		return value
	}
	encoded, err := json.Marshal(replace(decoded))
	if err != nil {
		return data
	}
	return encoded
}

func (session *socketIoSession) ping(sessionContext context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-sessionContext.Done():
			return
		case <-ticker.C:
			writeContext, cancel := context.WithTimeout(sessionContext, writeTimeout)
			err := session.writeText(writeContext, string(vulpesFunctions.EnginePing))
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func (session *socketIoSession) close() {
	session.closeOnce.Do(func() {
		session.closedByClient.Store(true)
		go func() {
			writeContext, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			_ = session.writePacket(writeContext, vulpesFunctions.SocketIoPacket{Type: vulpesFunctions.SocketDisconnect, Namespace: session.namespace})
			cancel()
			_ = session.connection.Close(websocket.StatusNormalClosure, "")
			session.cancel()
		}()
	})
}
