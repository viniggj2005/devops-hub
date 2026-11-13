package vulpesFunctions

import (
	"bytes"
	"encoding/binary"
	"io"
	"net"
	"net/url"
	"strings"

	"docker-manager-go/src/appErrors"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const (
	MqttConnect     byte = 1
	MqttConnack     byte = 2
	MqttPublish     byte = 3
	MqttPuback      byte = 4
	MqttPubrec      byte = 5
	MqttPubrel      byte = 6
	MqttPubcomp     byte = 7
	MqttSubscribe   byte = 8
	MqttSuback      byte = 9
	MqttUnsubscribe byte = 10
	MqttUnsuback    byte = 11
	MqttPingreq     byte = 12
	MqttPingresp    byte = 13
	MqttDisconnect  byte = 14
)

const maxMqttPacketBytes = 32 << 20

type MqttEndpoint struct {
	Transport  string
	Address    string
	ServerName string
	WsEndpoint string
	DisplayUrl string
}

type MqttConnectOptions struct {
	WillQos      byte
	ClientID     string
	Username     string
	Password     string
	WillTopic    string
	WillRetain   bool
	WillMessage  string
	CleanSession bool
	KeepAliveSec uint16
}

type MqttIncomingPublish struct {
	Qos       byte
	Topic     string
	Retain    bool
	Payload   []byte
	PacketID  uint16
	Duplicate bool
}

func ParseMqttEndpoint(rawUrl string) (MqttEndpoint, error) {
	trimmed := strings.TrimSpace(rawUrl)
	if trimmed == "" {
		return MqttEndpoint{}, appErrors.New("vulpes.mqttUrlRequired", "informe a URL do broker MQTT")
	}
	if !HasScheme(trimmed) {
		trimmed = "mqtt://" + trimmed
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return MqttEndpoint{}, appErrors.New("vulpes.invalidMqttUrl", "URL do broker MQTT inválida")
	}

	scheme := strings.ToLower(parsed.Scheme)
	hostname := parsed.Hostname()
	port := parsed.Port()

	switch scheme {
	case "mqtt", "tcp":
		if port == "" {
			port = "1883"
		}
		address := net.JoinHostPort(hostname, port)
		return MqttEndpoint{
			Transport:  "tcp",
			Address:    address,
			ServerName: hostname,
			DisplayUrl: "mqtt://" + address,
		}, nil
	case "mqtts", "ssl", "tls":
		if port == "" {
			port = "8883"
		}
		address := net.JoinHostPort(hostname, port)
		return MqttEndpoint{
			Transport:  "tls",
			Address:    address,
			ServerName: hostname,
			DisplayUrl: "mqtts://" + address,
		}, nil
	case "ws", "wss":
		if parsed.Path == "" {
			parsed.Path = "/mqtt"
		}
		return MqttEndpoint{
			Transport:  scheme,
			Address:    parsed.Host,
			ServerName: hostname,
			WsEndpoint: parsed.String(),
			DisplayUrl: parsed.String(),
		}, nil
	default:
		return MqttEndpoint{}, appErrors.New("vulpes.unsupportedMqttScheme", "protocolo \"{scheme}\" não suportado; use mqtt://, mqtts://, ws:// ou wss://").With("scheme", scheme)
	}
}

func EncodeMqttConnect(options MqttConnectOptions) []byte {
	var body bytes.Buffer
	writeMqttString(&body, "MQTT")
	body.WriteByte(4)

	var connectFlags byte
	if options.CleanSession {
		connectFlags |= 0x02
	}
	hasWill := strings.TrimSpace(options.WillTopic) != ""
	if hasWill {
		connectFlags |= 0x04
		connectFlags |= (options.WillQos & 0x03) << 3
		if options.WillRetain {
			connectFlags |= 0x20
		}
	}
	hasUsername := options.Username != ""
	hasPassword := options.Password != "" && hasUsername
	if hasUsername {
		connectFlags |= 0x80
	}
	if hasPassword {
		connectFlags |= 0x40
	}
	body.WriteByte(connectFlags)

	keepAlive := options.KeepAliveSec
	if keepAlive == 0 {
		keepAlive = 60
	}
	writeUint16(&body, keepAlive)

	clientID := strings.TrimSpace(options.ClientID)
	if clientID == "" {
		clientID = "vulpes-" + NewItemID()[:8]
	}
	writeMqttString(&body, clientID)

	if hasWill {
		writeMqttString(&body, strings.TrimSpace(options.WillTopic))
		writeMqttString(&body, options.WillMessage)
	}
	if hasUsername {
		writeMqttString(&body, options.Username)
	}
	if hasPassword {
		writeMqttString(&body, options.Password)
	}

	return wrapMqttPacket(MqttConnect, 0, body.Bytes())
}

func ParseMqttConnack(body []byte) (bool, byte, error) {
	if len(body) < 2 {
		return false, 0, appErrors.New("vulpes.invalidConnack", "resposta CONNACK inválida do broker MQTT")
	}
	sessionPresent := (body[0] & 0x01) != 0
	return sessionPresent, body[1], nil
}

func MqttConnackError(returnCode byte) error {
	switch returnCode {
	case 0:
		return nil
	case 1:
		return appErrors.New("vulpes.mqttRefusedProtocol", "o broker recusou a conexão: versão de protocolo MQTT não suportada")
	case 2:
		return appErrors.New("vulpes.mqttRefusedClientId", "o broker recusou a conexão: Client ID rejeitado")
	case 3:
		return appErrors.New("vulpes.mqttRefusedUnavailable", "o broker recusou a conexão: serviço MQTT indisponível")
	case 4:
		return appErrors.New("vulpes.mqttRefusedCredentials", "o broker recusou a conexão: usuário ou senha inválidos")
	case 5:
		return appErrors.New("vulpes.mqttRefusedUnauthorized", "o broker recusou a conexão: cliente não autorizado")
	default:
		return appErrors.New("vulpes.mqttRefusedCode", "o broker recusou a conexão (código {code})").With("code", returnCode)
	}
}

func EncodeMqttPublish(packetID uint16, topic string, payload []byte, qos byte, retain bool) ([]byte, error) {
	trimmedTopic := strings.TrimSpace(topic)
	if trimmedTopic == "" {
		return nil, appErrors.New("vulpes.mqttPublishTopicRequired", "informe o tópico MQTT para publicar")
	}
	if strings.ContainsAny(trimmedTopic, "+#") {
		return nil, appErrors.New("vulpes.mqttPublishWildcard", "o tópico de publicação não pode conter curingas (+ ou #)")
	}

	var flags byte
	flags |= (qos & 0x03) << 1
	if retain {
		flags |= 0x01
	}

	var body bytes.Buffer
	writeMqttString(&body, trimmedTopic)
	if qos > 0 {
		writeUint16(&body, packetID)
	}
	body.Write(payload)
	return wrapMqttPacket(MqttPublish, flags, body.Bytes()), nil
}

func ParseMqttPublish(flags byte, body []byte) (MqttIncomingPublish, error) {
	topic, offset, err := readMqttString(body, 0)
	if err != nil {
		return MqttIncomingPublish{}, err
	}
	qos := (flags >> 1) & 0x03
	var packetID uint16
	if qos > 0 {
		if len(body) < offset+2 {
			return MqttIncomingPublish{}, appErrors.New("vulpes.mqttPublishWithoutId", "pacote PUBLISH sem identificador")
		}
		packetID = binary.BigEndian.Uint16(body[offset : offset+2])
		offset += 2
	}
	payload := append([]byte(nil), body[offset:]...)
	return MqttIncomingPublish{
		Qos:       qos,
		Topic:     topic,
		Retain:    (flags & 0x01) != 0,
		Payload:   payload,
		PacketID:  packetID,
		Duplicate: (flags & 0x08) != 0,
	}, nil
}

func EncodeMqttPacketAck(packetType byte, flags byte, packetID uint16) []byte {
	var body bytes.Buffer
	writeUint16(&body, packetID)
	return wrapMqttPacket(packetType, flags, body.Bytes())
}

func ParseMqttPacketID(body []byte) (uint16, error) {
	if len(body) < 2 {
		return 0, appErrors.New("vulpes.mqttPacketWithoutId", "pacote MQTT sem identificador")
	}
	return binary.BigEndian.Uint16(body[:2]), nil
}

func EncodeMqttSubscribe(packetID uint16, subscriptions []vulpesDtos.MqttSubscriptionDto) ([]byte, error) {
	var body bytes.Buffer
	writeUint16(&body, packetID)
	count := 0
	for _, subscription := range subscriptions {
		topic := strings.TrimSpace(subscription.Topic)
		if !subscription.Enabled || topic == "" {
			continue
		}
		writeMqttString(&body, topic)
		qos := byte(normalizeMqttQos(subscription.Qos))
		body.WriteByte(qos)
		count++
	}
	if count == 0 {
		return nil, appErrors.New("vulpes.mqttSubscribeTopicRequired", "informe ao menos um tópico para assinar")
	}
	return wrapMqttPacket(MqttSubscribe, 0x02, body.Bytes()), nil
}

func EncodeMqttUnsubscribe(packetID uint16, topics []string) ([]byte, error) {
	var body bytes.Buffer
	writeUint16(&body, packetID)
	count := 0
	for _, topic := range topics {
		trimmed := strings.TrimSpace(topic)
		if trimmed == "" {
			continue
		}
		writeMqttString(&body, trimmed)
		count++
	}
	if count == 0 {
		return nil, appErrors.New("vulpes.mqttUnsubscribeTopicRequired", "informe o tópico para cancelar a inscrição")
	}
	return wrapMqttPacket(MqttUnsubscribe, 0x02, body.Bytes()), nil
}

func EncodeMqttSimplePacket(packetType byte) []byte {
	return []byte{packetType << 4, 0}
}

func ReadMqttPacket(reader io.Reader) (byte, byte, []byte, error) {
	var header [1]byte
	if _, err := io.ReadFull(reader, header[:]); err != nil {
		return 0, 0, nil, err
	}
	packetType := header[0] >> 4
	flags := header[0] & 0x0F

	remainingLength, err := readRemainingLength(reader)
	if err != nil {
		return 0, 0, nil, err
	}
	if remainingLength > maxMqttPacketBytes {
		return 0, 0, nil, appErrors.New("vulpes.mqttPacketTooLarge", "pacote MQTT excedeu o limite de {megabytes} MB").With("megabytes", maxMqttPacketBytes>>20)
	}
	body := make([]byte, remainingLength)
	if remainingLength > 0 {
		if _, err := io.ReadFull(reader, body); err != nil {
			return 0, 0, nil, err
		}
	}
	return packetType, flags, body, nil
}

func wrapMqttPacket(packetType byte, flags byte, body []byte) []byte {
	var packet bytes.Buffer
	packet.WriteByte((packetType << 4) | (flags & 0x0F))
	writeRemainingLength(&packet, len(body))
	packet.Write(body)
	return packet.Bytes()
}

func writeRemainingLength(buffer *bytes.Buffer, length int) {
	remaining := length
	for {
		encodedByte := byte(remaining % 128)
		remaining /= 128
		if remaining > 0 {
			encodedByte |= 0x80
		}
		buffer.WriteByte(encodedByte)
		if remaining == 0 {
			break
		}
	}
}

func readRemainingLength(reader io.Reader) (int, error) {
	multiplier := 1
	value := 0
	var singleByte [1]byte
	for {
		if _, err := io.ReadFull(reader, singleByte[:]); err != nil {
			return 0, err
		}
		encodedByte := singleByte[0]
		value += int(encodedByte&127) * multiplier
		if (encodedByte & 128) == 0 {
			return value, nil
		}
		multiplier *= 128
		if multiplier > 128*128*128 {
			return 0, appErrors.New("vulpes.mqttInvalidLength", "comprimento de pacote MQTT inválido")
		}
	}
}

func writeUint16(buffer *bytes.Buffer, value uint16) {
	var encoded [2]byte
	binary.BigEndian.PutUint16(encoded[:], value)
	buffer.Write(encoded[:])
}

func writeMqttString(buffer *bytes.Buffer, value string) {
	writeUint16(buffer, uint16(len(value)))
	buffer.WriteString(value)
}

func readMqttString(data []byte, offset int) (string, int, error) {
	if len(data) < offset+2 {
		return "", offset, appErrors.New("vulpes.mqttTruncatedString", "string MQTT truncada")
	}
	length := int(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2
	if len(data) < offset+length {
		return "", offset, appErrors.New("vulpes.mqttTruncatedContent", "conteúdo da string MQTT truncado")
	}
	return string(data[offset : offset+length]), offset + length, nil
}

