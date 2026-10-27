package vulpesFunctions

import (
	"strings"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"

	"github.com/google/uuid"
)

const (
	DefaultRequestName      = "Nova requisição"
	DefaultFolderName       = "Nova pasta"
	DefaultSocketIoPath     = "/socket.io/"
	DefaultSocketIoEvent    = "message"
	DefaultSocketIoVersion  = "v4"
	DefaultRawBodyLanguage  = "json"
	DefaultWebSocketMessage = "text"
)

var supportedProtocols = map[string]bool{
	vulpesDtos.ProtocolHttp:      true,
	vulpesDtos.ProtocolGrpc:      true,
	vulpesDtos.ProtocolSocketIo:  true,
	vulpesDtos.ProtocolWebSocket: true,
}

var supportedAuthTypes = map[string]bool{
	vulpesDtos.AuthNone:    true,
	vulpesDtos.AuthBasic:   true,
	vulpesDtos.AuthApiKey:  true,
	vulpesDtos.AuthBearer:  true,
	vulpesDtos.AuthInherit: true,
}

var supportedBodyModes = map[string]bool{
	vulpesDtos.BodyRaw:        true,
	vulpesDtos.BodyNone:       true,
	vulpesDtos.BodyBinary:     true,
	vulpesDtos.BodyGraphql:    true,
	vulpesDtos.BodyFormData:   true,
	vulpesDtos.BodyUrlEncoded: true,
}

var supportedSocketIoVersions = map[string]bool{"v2": true, "v3": true, "v4": true}

var supportedWebSocketMessageKinds = map[string]bool{"text": true, "json": true, "binary": true}

func NewItemID() string {
	return uuid.NewString()
}

func NewRequest(protocol string) vulpesDtos.RequestDto {
	request := vulpesDtos.RequestDto{Protocol: protocol}
	NormalizeRequest(&request)
	return request
}

func NormalizeRequest(request *vulpesDtos.RequestDto) {
	request.Protocol = strings.ToLower(strings.TrimSpace(request.Protocol))
	if !supportedProtocols[request.Protocol] {
		request.Protocol = vulpesDtos.ProtocolHttp
	}
	NormalizeAuth(&request.Auth, vulpesDtos.AuthInherit)

	httpRequest, grpcRequest := request.Http, request.Grpc
	socketIoRequest, webSocketRequest := request.SocketIo, request.WebSocket
	request.Http, request.Grpc, request.SocketIo, request.WebSocket = nil, nil, nil, nil

	switch request.Protocol {
	case vulpesDtos.ProtocolHttp:
		request.Http = normalizeHttpRequest(httpRequest)
	case vulpesDtos.ProtocolGrpc:
		request.Grpc = normalizeGrpcRequest(grpcRequest)
	case vulpesDtos.ProtocolSocketIo:
		request.SocketIo = normalizeSocketIoRequest(socketIoRequest)
	case vulpesDtos.ProtocolWebSocket:
		request.WebSocket = normalizeWebSocketRequest(webSocketRequest)
	}
}

func NormalizeAuth(auth *vulpesDtos.AuthDto, fallback string) {
	auth.Type = strings.ToLower(strings.TrimSpace(auth.Type))
	if !supportedAuthTypes[auth.Type] {
		auth.Type = fallback
	}
	if auth.Type == vulpesDtos.AuthApiKey && auth.Location != "query" {
		auth.Location = "header"
	}
}

func normalizeHttpRequest(httpRequest *vulpesDtos.HttpRequestDto) *vulpesDtos.HttpRequestDto {
	if httpRequest == nil {
		httpRequest = &vulpesDtos.HttpRequestDto{}
	}
	httpRequest.Method = strings.ToUpper(strings.TrimSpace(httpRequest.Method))
	if httpRequest.Method == "" {
		httpRequest.Method = "GET"
	}
	httpRequest.Params = nonNilKeyValues(httpRequest.Params)
	httpRequest.Headers = nonNilKeyValues(httpRequest.Headers)
	httpRequest.PathVariables = nonNilKeyValues(httpRequest.PathVariables)
	if httpRequest.Settings.TimeoutMs < 0 {
		httpRequest.Settings.TimeoutMs = 0
	}

	body := &httpRequest.Body
	body.Mode = strings.ToLower(strings.TrimSpace(body.Mode))
	if !supportedBodyModes[body.Mode] {
		body.Mode = vulpesDtos.BodyNone
	}
	if body.Language == "" {
		body.Language = DefaultRawBodyLanguage
	}
	body.UrlEncoded = nonNilKeyValues(body.UrlEncoded)
	if body.FormData == nil {
		body.FormData = []vulpesDtos.FormFieldDto{}
	}
	for index := range body.FormData {
		if body.FormData[index].Kind != "file" {
			body.FormData[index].Kind = "text"
		}
	}
	return httpRequest
}

func normalizeGrpcRequest(grpcRequest *vulpesDtos.GrpcRequestDto) *vulpesDtos.GrpcRequestDto {
	if grpcRequest == nil {
		grpcRequest = &vulpesDtos.GrpcRequestDto{}
	}
	if grpcRequest.DescriptorSource != vulpesDtos.DescriptorProtoFiles {
		grpcRequest.DescriptorSource = vulpesDtos.DescriptorReflection
	}
	if grpcRequest.TimeoutMs < 0 {
		grpcRequest.TimeoutMs = 0
	}
	grpcRequest.Metadata = nonNilKeyValues(grpcRequest.Metadata)
	grpcRequest.ProtoFiles = nonNilStrings(grpcRequest.ProtoFiles)
	grpcRequest.ImportPaths = nonNilStrings(grpcRequest.ImportPaths)
	return grpcRequest
}

func normalizeWebSocketRequest(webSocketRequest *vulpesDtos.WebSocketRequestDto) *vulpesDtos.WebSocketRequestDto {
	if webSocketRequest == nil {
		webSocketRequest = &vulpesDtos.WebSocketRequestDto{}
	}
	if !supportedWebSocketMessageKinds[webSocketRequest.MessageKind] {
		webSocketRequest.MessageKind = DefaultWebSocketMessage
	}
	webSocketRequest.Params = nonNilKeyValues(webSocketRequest.Params)
	webSocketRequest.Headers = nonNilKeyValues(webSocketRequest.Headers)
	webSocketRequest.Subprotocols = nonNilStrings(webSocketRequest.Subprotocols)
	return webSocketRequest
}

func normalizeSocketIoRequest(socketIoRequest *vulpesDtos.SocketIoRequestDto) *vulpesDtos.SocketIoRequestDto {
	if socketIoRequest == nil {
		socketIoRequest = &vulpesDtos.SocketIoRequestDto{Event: DefaultSocketIoEvent}
	}
	if !supportedSocketIoVersions[socketIoRequest.Version] {
		socketIoRequest.Version = DefaultSocketIoVersion
	}
	if strings.TrimSpace(socketIoRequest.Path) == "" {
		socketIoRequest.Path = DefaultSocketIoPath
	}
	socketIoRequest.Params = nonNilKeyValues(socketIoRequest.Params)
	socketIoRequest.Headers = nonNilKeyValues(socketIoRequest.Headers)
	socketIoRequest.Arguments = nonNilStrings(socketIoRequest.Arguments)
	return socketIoRequest
}

func NormalizeItem(item *vulpesDtos.CollectionItemDto) {
	item.Name = strings.TrimSpace(item.Name)
	if strings.TrimSpace(item.ID) == "" {
		item.ID = NewItemID()
	}
	if item.Scripts == nil {
		item.Scripts = []vulpesDtos.ScriptDto{}
	}
	if item.Children == nil {
		item.Children = []vulpesDtos.CollectionItemDto{}
	}

	if item.Kind != vulpesDtos.ItemKindFolder {
		item.Kind = vulpesDtos.ItemKindRequest
		item.Auth = nil
		item.Children = []vulpesDtos.CollectionItemDto{}
		if item.Request == nil {
			item.Request = &vulpesDtos.RequestDto{}
		}
		NormalizeRequest(item.Request)
		if item.Name == "" {
			item.Name = DefaultRequestName
		}
		return
	}

	item.Request = nil
	if item.Auth == nil {
		item.Auth = &vulpesDtos.AuthDto{}
	}
	NormalizeAuth(item.Auth, vulpesDtos.AuthInherit)
	if item.Name == "" {
		item.Name = DefaultFolderName
	}
	for index := range item.Children {
		NormalizeItem(&item.Children[index])
	}
}

func NormalizeContent(content *vulpesDtos.CollectionContentDto) {
	NormalizeAuth(&content.Auth, vulpesDtos.AuthNone)
	if content.Auth.Type == vulpesDtos.AuthInherit {
		content.Auth.Type = vulpesDtos.AuthNone
	}
	if content.Items == nil {
		content.Items = []vulpesDtos.CollectionItemDto{}
	}
	if content.Scripts == nil {
		content.Scripts = []vulpesDtos.ScriptDto{}
	}
	content.Cookies = NormalizeCookies(content.Cookies, time.Now())
	content.Variables = NormalizeVariables(content.Variables)
	for index := range content.Items {
		NormalizeItem(&content.Items[index])
	}
}

func NormalizeVariables(variables []vulpesDtos.VariableDto) []vulpesDtos.VariableDto {
	normalized := make([]vulpesDtos.VariableDto, 0, len(variables))
	for _, variable := range variables {
		variable.Key = strings.TrimSpace(variable.Key)
		if variable.Key == "" && variable.Value == "" {
			continue
		}
		normalized = append(normalized, variable)
	}
	return normalized
}

func nonNilKeyValues(values []vulpesDtos.KeyValueDto) []vulpesDtos.KeyValueDto {
	if values == nil {
		return []vulpesDtos.KeyValueDto{}
	}
	return values
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
