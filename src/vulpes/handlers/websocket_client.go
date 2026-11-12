package vulpesHandlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"

	"docker-manager-go/src/appErrors"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const (
	dialTimeout          = 30 * time.Second
	writeTimeout         = 30 * time.Second
	maxRealtimeFrameSize = 32 << 20
)

type webSocketSession struct {
	emit           func(vulpesDtos.RealtimeEventDto)
	cancel         context.CancelFunc
	resolver       *vulpesFunctions.VariableResolver
	closeOnce      sync.Once
	connection     *websocket.Conn
	closedByClient atomic.Bool
}

func (handlerStruct *VulpesClientHandlerStruct) dialRealtime(callContext context.Context, endpoint string, headers http.Header, subprotocols []string, skipTlsVerify bool, cookieJar http.CookieJar) (*websocket.Conn, error) {
	dialContext, cancel := context.WithTimeout(callContext, dialTimeout)
	defer cancel()

	connection, response, err := websocket.Dial(dialContext, endpoint, &websocket.DialOptions{
		HTTPClient:   &http.Client{Jar: cookieJar, Transport: handlerStruct.upgradeTransports.pick(skipTlsVerify)},
		HTTPHeader:   headers,
		Subprotocols: subprotocols,
	})
	if err != nil {
		if response != nil && response.StatusCode != http.StatusSwitchingProtocols {
			return nil, appErrors.New("vulpes.websocketRefused", "o servidor recusou a conexão com {status}").With("status", response.Status)
		}
		return nil, describeRequestError(err, dialContext)
	}
	connection.SetReadLimit(maxRealtimeFrameSize)
	return connection, nil
}

func realtimeEndpoint(rawUrl string, defaultScheme string, authQuery []vulpesDtos.HeaderDto) (string, error) {
	endpoint, err := vulpesFunctions.NormalizeUrl(rawUrl, defaultScheme)
	if err != nil {
		return "", err
	}
	scheme, rest, _ := strings.Cut(endpoint, "://")
	switch strings.ToLower(scheme) {
	case "ws", "http":
		endpoint = "ws://" + rest
	case "wss", "https":
		endpoint = "wss://" + rest
	default:
		return "", appErrors.New("vulpes.unsupportedWebsocketScheme", "protocolo \"{scheme}\" não suportado; use ws:// ou wss://").With("scheme", scheme)
	}
	return vulpesFunctions.AppendQuery(endpoint, authQuery), nil
}

func nonEmptyValues(values []string) []string {
	filtered := []string{}
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			filtered = append(filtered, trimmed)
		}
	}
	return filtered
}

func (handlerStruct *VulpesClientHandlerStruct) ConnectWebSocket(callContext context.Context, token string, sessionID string, input vulpesDtos.ExecutionInputDto) (*vulpesDtos.ConnectionResultDto, error) {
	plan, err := handlerStruct.prepareExecution(callContext, token, input)
	if err != nil {
		return nil, err
	}
	if plan.request.WebSocket == nil {
		return nil, appErrors.New("vulpes.requestNotWebsocket", "a requisição não é WebSocket")
	}
	webSocketRequest := plan.resolver.ResolveWebSocketRequest(*plan.request.WebSocket)
	if err := plan.resolver.TakeError(); err != nil {
		return nil, err
	}
	authEntries := vulpesFunctions.BuildAuthEntries(plan.auth)
	endpoint, err := realtimeEndpoint(webSocketRequest.Url, "ws", authEntries.Query)
	if err != nil {
		return nil, err
	}

	key, windowName := handlerStruct.sessionKey(callContext, sessionID)
	emit := handlerStruct.eventEmitter(windowName, sessionID)
	emit(vulpesDtos.RealtimeEventDto{Kind: vulpesDtos.RealtimeConnecting, Data: endpoint, Direction: vulpesDtos.DirectionSystem})

	headers := requestHeaders(webSocketRequest.Headers, authEntries)
	connection, err := handlerStruct.dialRealtime(callContext, endpoint, headers, nonEmptyValues(webSocketRequest.Subprotocols), webSocketRequest.SkipTlsVerify, plan.httpCookieJar())
	collectionCookies := handlerStruct.persistReceivedCookies(plan)
	if err != nil {
		return nil, err
	}

	sessionContext, cancel := context.WithCancel(handlerStruct.baseContext())
	session := &webSocketSession{emit: emit, cancel: cancel, resolver: plan.resolver, connection: connection}
	handlerStruct.registerSession(key, session)
	emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeConnected,
		Data:      endpoint,
		Event:     connection.Subprotocol(),
		Direction: vulpesDtos.DirectionSystem,
	})
	go session.read(sessionContext, func() { handlerStruct.forgetSession(key, session) })
	return &vulpesDtos.ConnectionResultDto{CollectionCookies: collectionCookies}, nil
}

func (handlerStruct *VulpesClientHandlerStruct) SendWebSocketMessage(callContext context.Context, token string, sessionID string, input vulpesDtos.RealtimeMessageInputDto) error {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return err
	}
	key, _ := handlerStruct.sessionKey(callContext, sessionID)
	session, isWebSocket := handlerStruct.findSession(key).(*webSocketSession)
	if !isWebSocket {
		return errSessionNotFound
	}

	data := session.resolver.Resolve(input.Data)
	if err := session.resolver.TakeError(); err != nil {
		return err
	}
	messageType, payload := websocket.MessageText, []byte(data)
	encoding := vulpesDtos.EncodingText
	switch input.Kind {
	case "json":
		if !json.Valid(payload) {
			return appErrors.New("vulpes.messageInvalidJson", "a mensagem não é um JSON válido")
		}
	case "binary":
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(data))
		if err != nil {
			return appErrors.New("vulpes.binaryMessageNotBase64", "mensagens binárias precisam estar em base64")
		}
		messageType, payload, encoding = websocket.MessageBinary, decoded, vulpesDtos.EncodingBase64
	}

	writeContext, cancel := context.WithTimeout(callContext, writeTimeout)
	defer cancel()
	if err := session.connection.Write(writeContext, messageType, payload); err != nil {
		return appErrors.Wrap("vulpes.websocketSendFailed", "não foi possível enviar a mensagem", err)
	}
	session.emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMessage,
		Data:      strings.TrimSpace(data),
		Encoding:  encoding,
		Direction: vulpesDtos.DirectionOutgoing,
		SizeBytes: len(payload),
	})
	return nil
}

func (session *webSocketSession) read(sessionContext context.Context, onFinish func()) {
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
		event := vulpesDtos.RealtimeEventDto{
			Kind:      vulpesDtos.RealtimeMessage,
			Data:      string(data),
			Direction: vulpesDtos.DirectionIncoming,
			SizeBytes: len(data),
		}
		if messageType == websocket.MessageBinary {
			event.Data, event.Encoding = base64.StdEncoding.EncodeToString(data), vulpesDtos.EncodingBase64
		}
		session.emit(event)
	}
}

func (session *webSocketSession) close() {
	session.closeOnce.Do(func() {
		session.closedByClient.Store(true)
		go func() {
			_ = session.connection.Close(websocket.StatusNormalClosure, "")
			session.cancel()
		}()
	})
}

func emitRealtimeClosure(emit func(vulpesDtos.RealtimeEventDto), err error, closedByClient bool) {
	if closedByClient {
		emit(systemEvent(vulpesDtos.RealtimeClosed, appErrors.New("vulpes.realtimeDisconnected", "Desconectado")))
		return
	}
	var closeError websocket.CloseError
	if errors.As(err, &closeError) {
		closedMessage := appErrors.New("vulpes.realtimeClosedWithCode", "Conexão encerrada pelo servidor (código {code})").With("code", int(closeError.Code))
		if closeError.Reason != "" {
			closedMessage = appErrors.Wrap(closedMessage.Code, closedMessage.Message, errors.New(closeError.Reason)).With("code", int(closeError.Code))
		}
		emit(systemEvent(vulpesDtos.RealtimeClosed, closedMessage))
		return
	}
	emit(errorEvent(err))
	emit(systemEvent(vulpesDtos.RealtimeClosed, appErrors.New("vulpes.realtimeConnectionLost", "Conexão perdida")))
}
