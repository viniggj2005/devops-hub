package vulpesHandlers

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/coder/websocket"

	"docker-manager-go/src/appErrors"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

type mqttSession struct {
	emit           func(vulpesDtos.RealtimeEventDto)
	cancel         context.CancelFunc
	resolver       *vulpesFunctions.VariableResolver
	closeOnce      sync.Once
	writeMutex     sync.Mutex
	connection     net.Conn
	nextPacketID   atomic.Uint32
	closedByClient atomic.Bool
}

func (session *mqttSession) allocatePacketID() uint16 {
	next := uint16(session.nextPacketID.Add(1))
	if next == 0 {
		next = uint16(session.nextPacketID.Add(1))
	}
	return next
}

func (session *mqttSession) writePacket(packet []byte, timeout time.Duration) error {
	session.writeMutex.Lock()
	defer session.writeMutex.Unlock()
	if timeout > 0 {
		_ = session.connection.SetWriteDeadline(time.Now().Add(timeout))
		defer func() { _ = session.connection.SetWriteDeadline(time.Time{}) }()
	}
	_, err := session.connection.Write(packet)
	return err
}

func (handlerStruct *VulpesClientHandlerStruct) dialMqttConnection(
	callContext context.Context,
	sessionContext context.Context,
	endpoint vulpesFunctions.MqttEndpoint,
	skipTlsVerify bool,
	authEntries vulpesFunctions.AuthEntries,
	plan *executionPlan,
) (net.Conn, error) {
	switch endpoint.Transport {
	case "tcp":
		dialer := net.Dialer{Timeout: dialTimeout}
		connection, err := dialer.DialContext(callContext, "tcp", endpoint.Address)
		if err != nil {
			return nil, describeRequestError(err, callContext)
		}
		return connection, nil
	case "tls":
		dialer := tls.Dialer{
			NetDialer: &net.Dialer{Timeout: dialTimeout},
			Config: &tls.Config{
				ServerName:         endpoint.ServerName,
				InsecureSkipVerify: skipTlsVerify,
			},
		}
		connection, err := dialer.DialContext(callContext, "tcp", endpoint.Address)
		if err != nil {
			return nil, describeRequestError(err, callContext)
		}
		return connection, nil
	case "ws", "wss":
		wsUrl := vulpesFunctions.AppendQuery(endpoint.WsEndpoint, authEntries.Query)
		headers := requestHeaders(nil, authEntries)
		wsConnection, err := handlerStruct.dialRealtime(callContext, wsUrl, headers, []string{"mqtt"}, skipTlsVerify, plan.httpCookieJar())
		if err != nil {
			return nil, err
		}
		return websocket.NetConn(sessionContext, wsConnection, websocket.MessageBinary), nil
	default:
		return nil, appErrors.New("vulpes.unsupportedMqttTransport", "transporte MQTT \"{transport}\" não suportado").With("transport", endpoint.Transport)
	}
}

func resolveMqttCredentials(mqttRequest vulpesDtos.MqttRequestDto, auth vulpesDtos.AuthDto) (string, string) {
	username := strings.TrimSpace(mqttRequest.Username)
	password := mqttRequest.Password
	if username == "" && auth.Type == vulpesDtos.AuthBasic {
		username = strings.TrimSpace(auth.Username)
		if password == "" {
			password = auth.Password
		}
	}
	if password == "" && auth.Type == vulpesDtos.AuthBearer && auth.Token != "" {
		if username == "" {
			username = "token"
		}
		password = auth.Token
	}
	return username, password
}

func (handlerStruct *VulpesClientHandlerStruct) ConnectMqtt(callContext context.Context, token string, sessionID string, input vulpesDtos.ExecutionInputDto) (*vulpesDtos.ConnectionResultDto, error) {
	plan, err := handlerStruct.prepareExecution(callContext, token, input)
	if err != nil {
		return nil, err
	}
	if plan.request.Mqtt == nil {
		return nil, appErrors.New("vulpes.requestNotMqtt", "a requisição não é MQTT")
	}
	mqttRequest := plan.resolver.ResolveMqttRequest(*plan.request.Mqtt)
	if err := plan.resolver.TakeError(); err != nil {
		return nil, err
	}
	endpoint, err := vulpesFunctions.ParseMqttEndpoint(mqttRequest.Url)
	if err != nil {
		return nil, err
	}

	key, windowName := handlerStruct.sessionKey(callContext, sessionID)
	emit := handlerStruct.eventEmitter(windowName, sessionID)
	emit(vulpesDtos.RealtimeEventDto{Kind: vulpesDtos.RealtimeConnecting, Data: endpoint.DisplayUrl, Direction: vulpesDtos.DirectionSystem})

	authEntries := vulpesFunctions.BuildAuthEntries(plan.auth)
	sessionContext, cancel := context.WithCancel(handlerStruct.baseContext())
	connection, err := handlerStruct.dialMqttConnection(callContext, sessionContext, endpoint, mqttRequest.SkipTlsVerify, authEntries, plan)
	collectionCookies := handlerStruct.persistReceivedCookies(plan)
	if err != nil {
		cancel()
		return nil, err
	}

	clientID := strings.TrimSpace(mqttRequest.ClientID)
	if clientID == "" {
		clientID = "vulpes-" + vulpesFunctions.NewItemID()[:8]
	}
	keepAliveSec := mqttRequest.KeepAliveSec
	if keepAliveSec <= 0 {
		keepAliveSec = vulpesFunctions.DefaultMqttKeepAliveSec
	}
	username, password := resolveMqttCredentials(mqttRequest, plan.auth)

	session := &mqttSession{
		emit:       emit,
		cancel:     cancel,
		resolver:   plan.resolver,
		connection: connection,
	}

	connectPacket := vulpesFunctions.EncodeMqttConnect(vulpesFunctions.MqttConnectOptions{
		WillQos:      byte(mqttRequest.WillQos),
		ClientID:     clientID,
		Username:     username,
		Password:     password,
		WillTopic:    mqttRequest.WillTopic,
		WillRetain:   mqttRequest.WillRetain,
		WillMessage:  mqttRequest.WillMessage,
		CleanSession: mqttRequest.CleanSession,
		KeepAliveSec: uint16(keepAliveSec),
	})

	if err := session.handshake(connectPacket); err != nil {
		cancel()
		_ = connection.Close()
		return nil, err
	}

	handlerStruct.registerSession(key, session)
	emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeConnected,
		Data:      fmt.Sprintf("%s · Client ID: %s", endpoint.DisplayUrl, clientID),
		Event:     clientID,
		Direction: vulpesDtos.DirectionSystem,
	})

	session.subscribeInitialTopics(mqttRequest.Subscriptions)
	go session.read(func() { handlerStruct.forgetSession(key, session) })
	go session.keepAlive(sessionContext, time.Duration(keepAliveSec)*time.Second)

	return &vulpesDtos.ConnectionResultDto{CollectionCookies: collectionCookies}, nil
}

func (session *mqttSession) handshake(connectPacket []byte) error {
	if err := session.writePacket(connectPacket, dialTimeout); err != nil {
		return appErrors.Wrap("vulpes.mqttConnectSendFailed", "falha ao enviar pacote CONNECT ao broker MQTT", err)
	}
	_ = session.connection.SetReadDeadline(time.Now().Add(dialTimeout))
	defer func() { _ = session.connection.SetReadDeadline(time.Time{}) }()

	packetType, _, body, err := vulpesFunctions.ReadMqttPacket(session.connection)
	if err != nil {
		return appErrors.Wrap("vulpes.mqttHandshakeFailed", "o broker MQTT não respondeu ao handshake", err)
	}
	if packetType != vulpesFunctions.MqttConnack {
		return appErrors.New("vulpes.mqttUnexpectedPacket", "resposta inesperada do broker MQTT (pacote {packet})").With("packet", packetType)
	}
	_, returnCode, err := vulpesFunctions.ParseMqttConnack(body)
	if err != nil {
		return err
	}
	return vulpesFunctions.MqttConnackError(returnCode)
}

func (session *mqttSession) subscribeInitialTopics(subscriptions []vulpesDtos.MqttSubscriptionDto) {
	enabled := make([]vulpesDtos.MqttSubscriptionDto, 0, len(subscriptions))
	topicLabels := make([]string, 0, len(subscriptions))
	for _, subscription := range subscriptions {
		topic := strings.TrimSpace(subscription.Topic)
		if !subscription.Enabled || topic == "" {
			continue
		}
		enabled = append(enabled, vulpesDtos.MqttSubscriptionDto{Topic: topic, Qos: subscription.Qos, Enabled: true})
		topicLabels = append(topicLabels, fmt.Sprintf("%s (QoS %d)", topic, subscription.Qos))
	}
	if len(enabled) == 0 {
		return
	}
	packet, err := vulpesFunctions.EncodeMqttSubscribe(session.allocatePacketID(), enabled)
	if err != nil {
		return
	}
	if err := session.writePacket(packet, writeTimeout); err != nil {
		session.emit(errorEvent(appErrors.Wrap("vulpes.mqttSubscribeTopicsFailed", "Falha ao assinar tópicos", err)))
		return
	}
	subscribedMessage := appErrors.New("vulpes.realtimeSubscribedTopics", "Inscrito em: {topics}").With("topics", strings.Join(topicLabels, ", "))
	session.emit(localizedEvent(subscribedMessage, vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMetadata,
		Event:     "SUBSCRIBE",
		Direction: vulpesDtos.DirectionSystem,
	}))
}

func (handlerStruct *VulpesClientHandlerStruct) PublishMqtt(callContext context.Context, token string, sessionID string, input vulpesDtos.MqttPublishInputDto) error {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return err
	}
	key, _ := handlerStruct.sessionKey(callContext, sessionID)
	session, isMqtt := handlerStruct.findSession(key).(*mqttSession)
	if !isMqtt {
		return errSessionNotFound
	}

	topic := strings.TrimSpace(session.resolver.Resolve(input.Topic))
	data := session.resolver.Resolve(input.Data)
	if err := session.resolver.TakeError(); err != nil {
		return err
	}

	payload := []byte(data)
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
		payload, encoding = decoded, vulpesDtos.EncodingBase64
	}

	qos := byte(0)
	if input.Qos >= 1 && input.Qos <= 2 {
		qos = byte(input.Qos)
	}
	var packetID uint16
	if qos > 0 {
		packetID = session.allocatePacketID()
	}

	packet, err := vulpesFunctions.EncodeMqttPublish(packetID, topic, payload, qos, input.Retain)
	if err != nil {
		return err
	}
	if err := session.writePacket(packet, writeTimeout); err != nil {
		return appErrors.Wrap("vulpes.mqttPublishFailed", "não foi possível publicar a mensagem", err)
	}

	eventLabel := topic
	if input.Retain {
		eventLabel = topic + " [retain]"
	}
	session.emit(vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMessage,
		Data:      strings.TrimSpace(data),
		AckID:     int64(packetID),
		Event:     eventLabel,
		HasAck:    qos > 0,
		Encoding:  encoding,
		Direction: vulpesDtos.DirectionOutgoing,
		SizeBytes: len(payload),
	})
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) SubscribeMqtt(callContext context.Context, token string, sessionID string, subscription vulpesDtos.MqttSubscriptionDto) error {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return err
	}
	key, _ := handlerStruct.sessionKey(callContext, sessionID)
	session, isMqtt := handlerStruct.findSession(key).(*mqttSession)
	if !isMqtt {
		return errSessionNotFound
	}

	topic := strings.TrimSpace(session.resolver.Resolve(subscription.Topic))
	if err := session.resolver.TakeError(); err != nil {
		return err
	}
	entry := vulpesDtos.MqttSubscriptionDto{Topic: topic, Qos: subscription.Qos, Enabled: true}
	packet, err := vulpesFunctions.EncodeMqttSubscribe(session.allocatePacketID(), []vulpesDtos.MqttSubscriptionDto{entry})
	if err != nil {
		return err
	}
	if err := session.writePacket(packet, writeTimeout); err != nil {
		return appErrors.Wrap("vulpes.mqttSubscribeFailed", "não foi possível assinar o tópico", err)
	}
	subscribedMessage := appErrors.New("vulpes.realtimeSubscribedTopic", "Inscrito em {topic} (QoS {qos})").With("topic", topic).With("qos", entry.Qos)
	session.emit(localizedEvent(subscribedMessage, vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMetadata,
		Event:     "SUBSCRIBE",
		Direction: vulpesDtos.DirectionSystem,
	}))
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) UnsubscribeMqtt(callContext context.Context, token string, sessionID string, topic string) error {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return err
	}
	key, _ := handlerStruct.sessionKey(callContext, sessionID)
	session, isMqtt := handlerStruct.findSession(key).(*mqttSession)
	if !isMqtt {
		return errSessionNotFound
	}

	resolvedTopic := strings.TrimSpace(session.resolver.Resolve(topic))
	if err := session.resolver.TakeError(); err != nil {
		return err
	}
	packet, err := vulpesFunctions.EncodeMqttUnsubscribe(session.allocatePacketID(), []string{resolvedTopic})
	if err != nil {
		return err
	}
	if err := session.writePacket(packet, writeTimeout); err != nil {
		return appErrors.Wrap("vulpes.mqttUnsubscribeFailed", "não foi possível cancelar a inscrição", err)
	}
	unsubscribedMessage := appErrors.New("vulpes.realtimeUnsubscribed", "Inscrição cancelada: {topic}").With("topic", resolvedTopic)
	session.emit(localizedEvent(unsubscribedMessage, vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeMetadata,
		Event:     "UNSUBSCRIBE",
		Direction: vulpesDtos.DirectionSystem,
	}))
	return nil
}

func (session *mqttSession) read(onFinish func()) {
	defer func() {
		onFinish()
		session.cancel()
		_ = session.connection.Close()
	}()
	for {
		packetType, flags, body, err := vulpesFunctions.ReadMqttPacket(session.connection)
		if err != nil {
			if session.closedByClient.Load() {
				session.emit(systemEvent(vulpesDtos.RealtimeClosed, appErrors.New("vulpes.realtimeDisconnected", "Desconectado")))
				return
			}
			session.emit(errorEvent(err))
			session.emit(systemEvent(vulpesDtos.RealtimeClosed, appErrors.New("vulpes.realtimeClosedByBroker", "Conexão encerrada pelo broker")))
			return
		}
		session.handlePacket(packetType, flags, body)
	}
}

func (session *mqttSession) handlePacket(packetType byte, flags byte, body []byte) {
	switch packetType {
	case vulpesFunctions.MqttPublish:
		incoming, err := vulpesFunctions.ParseMqttPublish(flags, body)
		if err != nil {
			session.emit(errorEvent(err))
			return
		}
		if incoming.Qos == 1 {
			_ = session.writePacket(vulpesFunctions.EncodeMqttPacketAck(vulpesFunctions.MqttPuback, 0, incoming.PacketID), writeTimeout)
		} else if incoming.Qos == 2 {
			_ = session.writePacket(vulpesFunctions.EncodeMqttPacketAck(vulpesFunctions.MqttPubrec, 0, incoming.PacketID), writeTimeout)
		}
		eventLabel := incoming.Topic
		if incoming.Retain {
			eventLabel = incoming.Topic + " [retain]"
		}
		event := vulpesDtos.RealtimeEventDto{
			Kind:      vulpesDtos.RealtimeMessage,
			Data:      string(incoming.Payload),
			AckID:     int64(incoming.PacketID),
			Event:     eventLabel,
			HasAck:    incoming.Qos > 0,
			Encoding:  vulpesDtos.EncodingText,
			Direction: vulpesDtos.DirectionIncoming,
			SizeBytes: len(incoming.Payload),
		}
		if !utf8.Valid(incoming.Payload) {
			event.Data = base64.StdEncoding.EncodeToString(incoming.Payload)
			event.Encoding = vulpesDtos.EncodingBase64
		}
		session.emit(event)
	case vulpesFunctions.MqttPuback:
		if packetID, err := vulpesFunctions.ParseMqttPacketID(body); err == nil {
			session.emit(localizedEvent(appErrors.New("vulpes.realtimePuback", "Publicação confirmada pelo broker (PUBACK)"), vulpesDtos.RealtimeEventDto{
				Kind:      vulpesDtos.RealtimeAck,
				AckID:     int64(packetID),
				HasAck:    true,
				Direction: vulpesDtos.DirectionIncoming,
			}))
		}
	case vulpesFunctions.MqttPubrec:
		if packetID, err := vulpesFunctions.ParseMqttPacketID(body); err == nil {
			_ = session.writePacket(vulpesFunctions.EncodeMqttPacketAck(vulpesFunctions.MqttPubrel, 0x02, packetID), writeTimeout)
		}
	case vulpesFunctions.MqttPubrel:
		if packetID, err := vulpesFunctions.ParseMqttPacketID(body); err == nil {
			_ = session.writePacket(vulpesFunctions.EncodeMqttPacketAck(vulpesFunctions.MqttPubcomp, 0, packetID), writeTimeout)
		}
	case vulpesFunctions.MqttPubcomp:
		if packetID, err := vulpesFunctions.ParseMqttPacketID(body); err == nil {
			session.emit(localizedEvent(appErrors.New("vulpes.realtimePubcomp", "Publicação QoS 2 concluída (PUBCOMP)"), vulpesDtos.RealtimeEventDto{
				Kind:      vulpesDtos.RealtimeAck,
				AckID:     int64(packetID),
				HasAck:    true,
				Direction: vulpesDtos.DirectionIncoming,
			}))
		}
	}
}

func (session *mqttSession) keepAlive(sessionContext context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 60 * time.Second
	}
	pingInterval := interval * 3 / 4
	if pingInterval < 5*time.Second {
		pingInterval = 5 * time.Second
	}
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-sessionContext.Done():
			return
		case <-ticker.C:
			if err := session.writePacket(vulpesFunctions.EncodeMqttSimplePacket(vulpesFunctions.MqttPingreq), writeTimeout); err != nil {
				return
			}
		}
	}
}

func (session *mqttSession) close() {
	session.closeOnce.Do(func() {
		session.closedByClient.Store(true)
		go func() {
			_ = session.writePacket(vulpesFunctions.EncodeMqttSimplePacket(vulpesFunctions.MqttDisconnect), 2*time.Second)
			_ = session.connection.Close()
			session.cancel()
		}()
	})
}

