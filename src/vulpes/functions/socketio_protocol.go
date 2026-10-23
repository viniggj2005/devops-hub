package vulpesFunctions

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

const (
	EngineOpen    = '0'
	EngineClose   = '1'
	EnginePing    = '2'
	EnginePong    = '3'
	EngineMessage = '4'
	EngineNoop    = '6'
)

const (
	SocketConnect      = 0
	SocketDisconnect   = 1
	SocketEvent        = 2
	SocketAck          = 3
	SocketConnectError = 4
	SocketBinaryEvent  = 5
	SocketBinaryAck    = 6
)

type SocketIoPacket struct {
	Data        json.RawMessage
	Type        int
	AckID       int64
	HasAckID    bool
	Namespace   string
	Attachments int
}

type EngineOpenPayload struct {
	Sid          string `json:"sid"`
	PingTimeout  int64  `json:"pingTimeout"`
	PingInterval int64  `json:"pingInterval"`
}

func ParseSocketIoPacket(text string) (SocketIoPacket, error) {
	if text == "" {
		return SocketIoPacket{}, errors.New("pacote Socket.IO vazio")
	}
	packet := SocketIoPacket{Type: int(text[0]) - '0', Namespace: "/"}
	if packet.Type < SocketConnect || packet.Type > SocketBinaryAck {
		return SocketIoPacket{}, fmt.Errorf("tipo de pacote Socket.IO desconhecido: %q", text[0])
	}

	position := 1
	if packet.Type == SocketBinaryEvent || packet.Type == SocketBinaryAck {
		separator := strings.IndexByte(text[position:], '-')
		if separator < 0 {
			return SocketIoPacket{}, errors.New("pacote binário Socket.IO sem contagem de anexos")
		}
		attachments, err := strconv.Atoi(text[position : position+separator])
		if err != nil {
			return SocketIoPacket{}, fmt.Errorf("contagem de anexos inválida: %w", err)
		}
		packet.Attachments = attachments
		position += separator + 1
	}

	if position < len(text) && text[position] == '/' {
		separator := strings.IndexByte(text[position:], ',')
		if separator < 0 {
			packet.Namespace = text[position:]
			position = len(text)
		} else {
			packet.Namespace = text[position : position+separator]
			position += separator + 1
		}
	}

	digitsStart := position
	for position < len(text) && text[position] >= '0' && text[position] <= '9' {
		position++
	}
	if position > digitsStart {
		ackID, err := strconv.ParseInt(text[digitsStart:position], 10, 64)
		if err != nil {
			return SocketIoPacket{}, fmt.Errorf("id de ack inválido: %w", err)
		}
		packet.AckID, packet.HasAckID = ackID, true
	}

	if position < len(text) {
		payload := json.RawMessage(text[position:])
		if !json.Valid(payload) {
			return SocketIoPacket{}, errors.New("pacote Socket.IO com JSON inválido")
		}
		packet.Data = payload
	}
	return packet, nil
}

func EncodeSocketIoPacket(packet SocketIoPacket) string {
	var builder strings.Builder
	builder.WriteString(strconv.Itoa(packet.Type))
	if packet.Attachments > 0 {
		builder.WriteString(strconv.Itoa(packet.Attachments) + "-")
	}
	if packet.Namespace != "" && packet.Namespace != "/" {
		builder.WriteString(packet.Namespace + ",")
	}
	if packet.HasAckID {
		builder.WriteString(strconv.FormatInt(packet.AckID, 10))
	}
	builder.Write(packet.Data)
	return builder.String()
}

func SocketIoArguments(arguments []string) []json.RawMessage {
	encoded := make([]json.RawMessage, 0, len(arguments))
	for _, argument := range arguments {
		trimmed := strings.TrimSpace(argument)
		if trimmed == "" {
			continue
		}
		if json.Valid([]byte(trimmed)) {
			encoded = append(encoded, json.RawMessage(trimmed))
			continue
		}
		quoted, _ := json.Marshal(argument)
		encoded = append(encoded, quoted)
	}
	return encoded
}

func SocketIoEventPayload(event string, arguments []json.RawMessage) (json.RawMessage, error) {
	if strings.TrimSpace(event) == "" {
		return nil, errors.New("informe o nome do evento")
	}
	payload := append([]json.RawMessage{}, mustMarshal(event))
	payload = append(payload, arguments...)
	return json.Marshal(payload)
}

func SplitSocketIoEvent(data json.RawMessage) (string, []json.RawMessage) {
	var values []json.RawMessage
	if json.Unmarshal(data, &values) != nil || len(values) == 0 {
		return "", nil
	}
	var event string
	if json.Unmarshal(values[0], &event) != nil {
		return "", values
	}
	return event, values[1:]
}

func DisplayArguments(arguments []json.RawMessage) string {
	switch len(arguments) {
	case 0:
		return ""
	case 1:
		return string(arguments[0])
	}
	encoded, _ := json.Marshal(arguments)
	return string(encoded)
}

func SocketIoEndpoint(rawUrl string, path string, namespace string, version string) (string, string, error) {
	normalized, err := NormalizeUrl(rawUrl, "http")
	if err != nil {
		return "", "", err
	}
	parsed, err := url.Parse(normalized)
	if err != nil {
		return "", "", err
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "ws":
		parsed.Scheme = "ws"
	case "https", "wss":
		parsed.Scheme = "wss"
	default:
		return "", "", fmt.Errorf("protocolo %q não suportado pelo Socket.IO", parsed.Scheme)
	}

	resolvedNamespace := strings.TrimSpace(namespace)
	if resolvedNamespace == "" {
		resolvedNamespace = strings.TrimSuffix(parsed.Path, "/")
	}
	if !strings.HasPrefix(resolvedNamespace, "/") {
		resolvedNamespace = "/" + resolvedNamespace
	}

	engineVersion := "4"
	if version == "v2" {
		engineVersion = "3"
	}
	parsed.Path = "/"
	if enginePath := strings.Trim(strings.TrimSpace(path), "/"); enginePath != "" {
		parsed.Path = "/" + enginePath + "/"
	}
	parsed.RawPath = ""
	engineQuery := "EIO=" + engineVersion + "&transport=websocket"
	if parsed.RawQuery == "" {
		parsed.RawQuery = engineQuery
	} else {
		parsed.RawQuery += "&" + engineQuery
	}
	return parsed.String(), resolvedNamespace, nil
}

func mustMarshal(value any) json.RawMessage {
	encoded, _ := json.Marshal(value)
	return encoded
}
