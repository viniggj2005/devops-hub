package vulpesDtos

const (
	ProtocolHttp      = "http"
	ProtocolGrpc      = "grpc"
	ProtocolSocketIo  = "socketio"
	ProtocolWebSocket = "websocket"
)

const (
	ItemKindFolder  = "folder"
	ItemKindRequest = "request"
)

const (
	AuthNone    = "none"
	AuthBasic   = "basic"
	AuthApiKey  = "apikey"
	AuthBearer  = "bearer"
	AuthInherit = "inherit"
)

const (
	BodyNone       = "none"
	BodyRaw        = "raw"
	BodyBinary     = "binary"
	BodyGraphql    = "graphql"
	BodyFormData   = "formdata"
	BodyUrlEncoded = "urlencoded"
)

const (
	DescriptorReflection = "reflection"
	DescriptorProtoFiles = "proto"
)

const (
	ExportFormatPostman  = "postman"
	ExportFormatInsomnia = "insomnia"
)

type KeyValueDto struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
}

type VariableDto struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Secret  bool   `json:"secret"`
	Enabled bool   `json:"enabled"`
}

type FormFieldDto struct {
	Key         string `json:"key"`
	Kind        string `json:"kind"`
	Value       string `json:"value"`
	Enabled     bool   `json:"enabled"`
	FilePath    string `json:"filePath"`
	ContentType string `json:"contentType"`
}

type AuthDto struct {
	Key      string `json:"key"`
	Type     string `json:"type"`
	Token    string `json:"token"`
	Value    string `json:"value"`
	Location string `json:"location"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type HttpBodyDto struct {
	Raw              string         `json:"raw"`
	Mode             string         `json:"mode"`
	Language         string         `json:"language"`
	FormData         []FormFieldDto `json:"formData"`
	BinaryPath       string         `json:"binaryPath"`
	UrlEncoded       []KeyValueDto  `json:"urlEncoded"`
	GraphqlQuery     string         `json:"graphqlQuery"`
	GraphqlVariables string         `json:"graphqlVariables"`
}

type HttpSettingsDto struct {
	TimeoutMs        int64 `json:"timeoutMs"`
	SkipTlsVerify    bool  `json:"skipTlsVerify"`
	DisableRedirects bool  `json:"disableRedirects"`
}

type HttpRequestDto struct {
	Url           string          `json:"url"`
	Body          HttpBodyDto     `json:"body"`
	Method        string          `json:"method"`
	Params        []KeyValueDto   `json:"params"`
	Headers       []KeyValueDto   `json:"headers"`
	Settings      HttpSettingsDto `json:"settings"`
	PathVariables []KeyValueDto   `json:"pathVariables"`
}

type GrpcRequestDto struct {
	Url              string        `json:"url"`
	Method           string        `json:"method"`
	UseTls           bool          `json:"useTls"`
	Message          string        `json:"message"`
	Metadata         []KeyValueDto `json:"metadata"`
	TimeoutMs        int64         `json:"timeoutMs"`
	SkipTlsVerify    bool          `json:"skipTlsVerify"`
	ProtoFiles       []string      `json:"protoFiles"`
	ImportPaths      []string      `json:"importPaths"`
	DescriptorSource string        `json:"descriptorSource"`
}

type WebSocketRequestDto struct {
	Url           string        `json:"url"`
	Params        []KeyValueDto `json:"params"`
	Headers       []KeyValueDto `json:"headers"`
	Message       string        `json:"message"`
	MessageKind   string        `json:"messageKind"`
	Subprotocols  []string      `json:"subprotocols"`
	SkipTlsVerify bool          `json:"skipTlsVerify"`
}

type SocketIoRequestDto struct {
	Url           string        `json:"url"`
	Path          string        `json:"path"`
	Event         string        `json:"event"`
	Params        []KeyValueDto `json:"params"`
	Headers       []KeyValueDto `json:"headers"`
	Version       string        `json:"version"`
	WithAck       bool          `json:"withAck"`
	Arguments     []string      `json:"arguments"`
	Namespace     string        `json:"namespace"`
	HandshakeAuth string        `json:"handshakeAuth"`
	SkipTlsVerify bool          `json:"skipTlsVerify"`
}

type RequestDto struct {
	Auth      AuthDto              `json:"auth"`
	Http      *HttpRequestDto      `json:"http,omitempty"`
	Grpc      *GrpcRequestDto      `json:"grpc,omitempty"`
	Protocol  string               `json:"protocol"`
	SocketIo  *SocketIoRequestDto  `json:"socketIo,omitempty"`
	WebSocket *WebSocketRequestDto `json:"webSocket,omitempty"`
}

type ScriptDto struct {
	Listen string `json:"listen"`
	Source string `json:"source"`
}

type CollectionItemDto struct {
	ID          string              `json:"id"`
	Kind        string              `json:"kind"`
	Name        string              `json:"name"`
	Auth        *AuthDto            `json:"auth,omitempty"`
	Request     *RequestDto         `json:"request,omitempty"`
	Scripts     []ScriptDto         `json:"scripts"`
	Children    []CollectionItemDto `json:"children"`
	Description string              `json:"description"`
}

type CollectionContentDto struct {
	Auth        AuthDto             `json:"auth"`
	Items       []CollectionItemDto `json:"items"`
	Cookies     []CookieDto         `json:"cookies"`
	Scripts     []ScriptDto         `json:"scripts"`
	Variables   []VariableDto       `json:"variables"`
	Description string              `json:"description"`
}

type CollectionDto struct {
	ID          uint                `json:"id"`
	Name        string              `json:"name"`
	Auth        AuthDto             `json:"auth"`
	Items       []CollectionItemDto `json:"items"`
	Cookies     []CookieDto         `json:"cookies"`
	Scripts     []ScriptDto         `json:"scripts"`
	Variables   []VariableDto       `json:"variables"`
	Description string              `json:"description"`
}

type CollectionInputDto struct {
	Name        string        `json:"name"`
	Auth        AuthDto       `json:"auth"`
	Variables   []VariableDto `json:"variables"`
	Description string        `json:"description"`
}

type ItemMutationResultDto struct {
	ItemID     string        `json:"itemId"`
	Collection CollectionDto `json:"collection"`
}

type MoveItemInputDto struct {
	ItemID             string `json:"itemId"`
	TargetIndex        int    `json:"targetIndex"`
	CollectionID       uint   `json:"collectionId"`
	TargetParentID     string `json:"targetParentId"`
	TargetCollectionID uint   `json:"targetCollectionId"`
}
