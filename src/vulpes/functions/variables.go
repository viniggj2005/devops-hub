package vulpesFunctions

import (
	"errors"
	"math/rand/v2"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"

	"github.com/google/uuid"
)

const maxResolutionPasses = 10

const alphaNumericCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

var variablePattern = regexp.MustCompile(`\{\{([^{}]+)\}\}`)

var dynamicVariables = map[string]func() string{
	"$guid":       uuid.NewString,
	"$randomUUID": uuid.NewString,
	"$timestamp": func() string {
		return strconv.FormatInt(time.Now().Unix(), 10)
	},
	"$isoTimestamp": func() string {
		return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	},
	"$randomInt": func() string {
		return strconv.Itoa(rand.IntN(1001))
	},
	"$randomBoolean": func() string {
		return strconv.FormatBool(rand.IntN(2) == 1)
	},
	"$randomAlphaNumeric": func() string {
		return string(alphaNumericCharacters[rand.IntN(len(alphaNumericCharacters))])
	},
}

type ResponseSource func(reference ResponseReference) (*vulpesDtos.HttpResponseDto, error)

type VariableResolver struct {
	mutex     sync.Mutex
	values    map[string]string
	failure   error
	responses ResponseSource
	extracted map[string]string
}

func NewVariableResolver(layers ...[]vulpesDtos.VariableDto) *VariableResolver {
	values := map[string]string{}
	for _, layer := range layers {
		for _, variable := range layer {
			if variable.Enabled && variable.Key != "" {
				values[variable.Key] = variable.Value
			}
		}
	}
	return &VariableResolver{values: values, extracted: map[string]string{}}
}

func (resolver *VariableResolver) UseResponses(source ResponseSource) {
	resolver.responses = source
}

func (resolver *VariableResolver) TakeError() error {
	if resolver == nil {
		return nil
	}
	resolver.mutex.Lock()
	defer resolver.mutex.Unlock()
	failure := resolver.failure
	resolver.failure = nil
	return failure
}

func (resolver *VariableResolver) Resolve(text string) string {
	if resolver == nil || !strings.Contains(text, "{{") {
		return text
	}
	for pass := 0; pass < maxResolutionPasses; pass++ {
		replaced := variablePattern.ReplaceAllStringFunc(text, resolver.replaceMatch)
		if replaced == text {
			break
		}
		text = replaced
	}
	return text
}

func (resolver *VariableResolver) replaceMatch(match string) string {
	name := strings.TrimSpace(match[2 : len(match)-2])
	if value, found := resolver.values[name]; found {
		return value
	}
	if IsResponseExpression(name) {
		return resolver.responseValue(name, match)
	}
	if generate, found := dynamicVariable(name); found {
		return generate()
	}
	return match
}

func (resolver *VariableResolver) responseValue(expression string, match string) string {
	resolver.mutex.Lock()
	defer resolver.mutex.Unlock()
	if value, found := resolver.extracted[expression]; found {
		return value
	}
	value, err := resolver.fetchResponseValue(expression)
	if err != nil {
		if resolver.failure == nil {
			resolver.failure = err
		}
		return match
	}
	resolver.extracted[expression] = value
	return value
}

func (resolver *VariableResolver) fetchResponseValue(expression string) (string, error) {
	reference, err := ParseResponseReference(expression)
	if err != nil {
		return "", err
	}
	if resolver.responses == nil {
		return "", errors.New("{{$response}} só pode ser usado em requisições salvas em uma coleção")
	}
	response, err := resolver.responses(reference)
	if err != nil {
		return "", err
	}
	return ExtractResponseValue(response, reference)
}

func (resolver *VariableResolver) ResolveAll(values []string) []string {
	resolved := make([]string, len(values))
	for index, value := range values {
		resolved[index] = resolver.Resolve(value)
	}
	return resolved
}

func (resolver *VariableResolver) ResolveKeyValues(values []vulpesDtos.KeyValueDto) []vulpesDtos.KeyValueDto {
	resolved := make([]vulpesDtos.KeyValueDto, 0, len(values))
	for _, entry := range values {
		entry.Key = resolver.Resolve(entry.Key)
		entry.Value = resolver.Resolve(entry.Value)
		resolved = append(resolved, entry)
	}
	return resolved
}

func (resolver *VariableResolver) ResolveAuth(auth vulpesDtos.AuthDto) vulpesDtos.AuthDto {
	auth.Key = resolver.Resolve(auth.Key)
	auth.Token = resolver.Resolve(auth.Token)
	auth.Value = resolver.Resolve(auth.Value)
	auth.Username = resolver.Resolve(auth.Username)
	auth.Password = resolver.Resolve(auth.Password)
	return auth
}

func (resolver *VariableResolver) ResolveHttpRequest(httpRequest vulpesDtos.HttpRequestDto) vulpesDtos.HttpRequestDto {
	httpRequest.Url = resolver.Resolve(httpRequest.Url)
	httpRequest.Params = resolver.ResolveKeyValues(httpRequest.Params)
	httpRequest.Headers = resolver.ResolveKeyValues(httpRequest.Headers)
	httpRequest.PathVariables = resolver.ResolveKeyValues(httpRequest.PathVariables)

	body := &httpRequest.Body
	body.Raw = resolver.Resolve(body.Raw)
	body.BinaryPath = resolver.Resolve(body.BinaryPath)
	body.GraphqlQuery = resolver.Resolve(body.GraphqlQuery)
	body.GraphqlVariables = resolver.Resolve(body.GraphqlVariables)
	body.UrlEncoded = resolver.ResolveKeyValues(body.UrlEncoded)

	formData := make([]vulpesDtos.FormFieldDto, 0, len(body.FormData))
	for _, field := range body.FormData {
		field.Key = resolver.Resolve(field.Key)
		field.Value = resolver.Resolve(field.Value)
		field.FilePath = resolver.Resolve(field.FilePath)
		formData = append(formData, field)
	}
	body.FormData = formData
	return httpRequest
}

func (resolver *VariableResolver) ResolveGrpcRequest(grpcRequest vulpesDtos.GrpcRequestDto) vulpesDtos.GrpcRequestDto {
	grpcRequest.Url = resolver.Resolve(grpcRequest.Url)
	grpcRequest.Method = resolver.Resolve(grpcRequest.Method)
	grpcRequest.Message = resolver.Resolve(grpcRequest.Message)
	grpcRequest.Metadata = resolver.ResolveKeyValues(grpcRequest.Metadata)
	grpcRequest.ProtoFiles = resolver.ResolveAll(grpcRequest.ProtoFiles)
	grpcRequest.ImportPaths = resolver.ResolveAll(grpcRequest.ImportPaths)
	return grpcRequest
}

func (resolver *VariableResolver) ResolveWebSocketRequest(webSocketRequest vulpesDtos.WebSocketRequestDto) vulpesDtos.WebSocketRequestDto {
	webSocketRequest.Url = resolver.Resolve(webSocketRequest.Url)
	webSocketRequest.Params = resolver.ResolveKeyValues(webSocketRequest.Params)
	webSocketRequest.Headers = resolver.ResolveKeyValues(webSocketRequest.Headers)
	webSocketRequest.Subprotocols = resolver.ResolveAll(webSocketRequest.Subprotocols)
	return webSocketRequest
}

func (resolver *VariableResolver) ResolveSocketIoRequest(socketIoRequest vulpesDtos.SocketIoRequestDto) vulpesDtos.SocketIoRequestDto {
	socketIoRequest.Url = resolver.Resolve(socketIoRequest.Url)
	socketIoRequest.Path = resolver.Resolve(socketIoRequest.Path)
	socketIoRequest.Namespace = resolver.Resolve(socketIoRequest.Namespace)
	socketIoRequest.HandshakeAuth = resolver.Resolve(socketIoRequest.HandshakeAuth)
	socketIoRequest.Params = resolver.ResolveKeyValues(socketIoRequest.Params)
	socketIoRequest.Headers = resolver.ResolveKeyValues(socketIoRequest.Headers)
	return socketIoRequest
}
