package vulpesDtos

const (
	RealtimeAck        = "ack"
	RealtimeError      = "error"
	RealtimeClosed     = "closed"
	RealtimeMessage    = "message"
	RealtimeMetadata   = "metadata"
	RealtimeConnected  = "connected"
	RealtimeConnecting = "connecting"
)

const (
	DirectionSystem   = "system"
	DirectionIncoming = "incoming"
	DirectionOutgoing = "outgoing"
)

const (
	EncodingText   = "text"
	EncodingBase64 = "base64"
)

type ExecutionScopeDto struct {
	ItemID        string `json:"itemId"`
	CollectionID  uint   `json:"collectionId"`
	EnvironmentID uint   `json:"environmentId"`
}

type ExecutionInputDto struct {
	Scope   ExecutionScopeDto `json:"scope"`
	Request RequestDto        `json:"request"`
}

type HeaderDto struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CookieDto struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Value    string `json:"value"`
	Domain   string `json:"domain"`
	Secure   bool   `json:"secure"`
	Expires  string `json:"expires"`
	HostOnly bool   `json:"hostOnly"`
	HttpOnly bool   `json:"httpOnly"`
	SameSite string `json:"sameSite"`
}

type TimingsDto struct {
	DnsMs      float64 `json:"dnsMs"`
	TlsMs      float64 `json:"tlsMs"`
	WaitMs     float64 `json:"waitMs"`
	TotalMs    float64 `json:"totalMs"`
	ConnectMs  float64 `json:"connectMs"`
	DownloadMs float64 `json:"downloadMs"`
}

type HttpResponseDto struct {
	Url               string       `json:"url"`
	Body              string       `json:"body"`
	Status            string       `json:"status"`
	Method            string       `json:"method"`
	Cookies           []CookieDto  `json:"cookies"`
	Headers           []HeaderDto  `json:"headers"`
	Timings           TimingsDto   `json:"timings"`
	Protocol          string       `json:"protocol"`
	SizeBytes         int64        `json:"sizeBytes"`
	Truncated         bool         `json:"truncated"`
	StatusCode        int          `json:"statusCode"`
	ContentType       string       `json:"contentType"`
	BodyEncoding      string       `json:"bodyEncoding"`
	RequestHeaders    []HeaderDto  `json:"requestHeaders"`
	CollectionCookies *[]CookieDto `json:"collectionCookies"`
}

type ConnectionResultDto struct {
	CollectionCookies *[]CookieDto `json:"collectionCookies"`
}

type GrpcMethodDto struct {
	Name            string `json:"name"`
	FullName        string `json:"fullName"`
	InputType       string `json:"inputType"`
	OutputType      string `json:"outputType"`
	ExampleMessage  string `json:"exampleMessage"`
	ClientStreaming bool   `json:"clientStreaming"`
	ServerStreaming bool   `json:"serverStreaming"`
}

type GrpcServiceDto struct {
	Name    string          `json:"name"`
	Methods []GrpcMethodDto `json:"methods"`
}

type GrpcResponseDto struct {
	Code          string      `json:"code"`
	Message       string      `json:"message"`
	Headers       []HeaderDto `json:"headers"`
	Trailers      []HeaderDto `json:"trailers"`
	StatusCode    int         `json:"statusCode"`
	DurationMs    float64     `json:"durationMs"`
	StatusMessage string      `json:"statusMessage"`
}

type RealtimeEventDto struct {
	Kind      string `json:"kind"`
	Data      string `json:"data"`
	AckID     int64  `json:"ackId"`
	Event     string `json:"event"`
	HasAck    bool   `json:"hasAck"`
	Encoding  string `json:"encoding"`
	Direction string `json:"direction"`
	SizeBytes int    `json:"sizeBytes"`
	Timestamp int64  `json:"timestamp"`
}

type RealtimeMessageInputDto struct {
	Data string `json:"data"`
	Kind string `json:"kind"`
}

type SocketIoEmitInputDto struct {
	Event     string   `json:"event"`
	WithAck   bool     `json:"withAck"`
	Arguments []string `json:"arguments"`
}
