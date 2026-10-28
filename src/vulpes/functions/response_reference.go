package vulpesFunctions

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const ResponseVariable = "$response"

const (
	ResponseFieldUrl    = "url"
	ResponseFieldRaw    = "raw"
	ResponseFieldBody   = "body"
	ResponseFieldHeader = "header"
)

const (
	ResendNever       = "never"
	ResendAlways      = "always"
	ResendNoHistory   = "no-history"
	ResendWhenExpired = "when-expired"
)

const (
	encodedFilterSuffix = "::46b"
	encodedFilterPrefix = "b64::"
)

var responseFields = map[string]bool{
	ResponseFieldUrl:    true,
	ResponseFieldRaw:    true,
	ResponseFieldBody:   true,
	ResponseFieldHeader: true,
}

var resendBehaviors = map[string]bool{
	ResendNever:       true,
	ResendAlways:      true,
	ResendNoHistory:   true,
	ResendWhenExpired: true,
}

var errMissingResponseRequest = errors.New("informe a requisição de origem em {{$response}}")

type ResponseReference struct {
	Field     string
	Filter    string
	MaxAge    time.Duration
	Trigger   string
	RequestID string
}

func IsResponseExpression(name string) bool {
	remainder, found := strings.CutPrefix(name, ResponseVariable)
	return found && (remainder == "" || remainder[0] == ' ' || remainder[0] == '\t')
}

func ParseResponseReference(expression string) (ResponseReference, error) {
	return ResponseReferenceFromArguments(ParseTagArguments(strings.TrimPrefix(expression, ResponseVariable)))
}

func ResponseReferenceFromArguments(arguments []string) (ResponseReference, error) {
	argument := func(position int, fallback string) string {
		if position < len(arguments) && strings.TrimSpace(arguments[position]) != "" {
			return strings.TrimSpace(arguments[position])
		}
		return fallback
	}
	reference := ResponseReference{
		Field:     strings.ToLower(argument(0, ResponseFieldBody)),
		Filter:    decodeResponseFilter(argument(2, "")),
		Trigger:   strings.ToLower(argument(3, ResendNever)),
		RequestID: argument(1, ""),
	}
	if reference.RequestID == "" {
		return reference, errMissingResponseRequest
	}
	if !responseFields[reference.Field] {
		return reference, fmt.Errorf("o atributo %q de {{$response}} é inválido; use body, header, raw ou url", reference.Field)
	}
	if !resendBehaviors[reference.Trigger] {
		return reference, fmt.Errorf("o reenvio %q de {{$response}} é inválido; use never, no-history, when-expired ou always", reference.Trigger)
	}
	if maxAge := argument(4, ""); maxAge != "" {
		seconds, err := strconv.ParseFloat(maxAge, 64)
		if err != nil || seconds < 0 {
			return reference, fmt.Errorf("a validade %q de {{$response}} precisa ser um número de segundos", maxAge)
		}
		reference.MaxAge = time.Duration(seconds * float64(time.Second))
	}
	return reference, nil
}

func (reference ResponseReference) Expression() string {
	return "{{" + ResponseVariable + " " + reference.arguments(false) + "}}"
}

func (reference ResponseReference) InsomniaTag() string {
	return "{% response " + reference.arguments(true) + " %}"
}

func (reference ResponseReference) arguments(encodeFilter bool) string {
	filter := reference.Filter
	if filter != "" && (encodeFilter || strings.ContainsAny(filter, `'"\{}`)) {
		filter = encodedFilterPrefix + base64.StdEncoding.EncodeToString([]byte(filter)) + encodedFilterSuffix
	}
	arguments := []string{quoteTagArgument(reference.Field), quoteTagArgument(reference.RequestID), quoteTagArgument(filter), quoteTagArgument(reference.Trigger)}
	if reference.MaxAge > 0 {
		arguments = append(arguments, strconv.FormatFloat(reference.MaxAge.Seconds(), 'f', -1, 64))
	}
	return strings.Join(arguments, ", ")
}

func (reference ResponseReference) ShouldResend(hasResponse bool, receivedAt time.Time, now time.Time) bool {
	switch reference.Trigger {
	case ResendAlways:
		return true
	case ResendWhenExpired:
		return !hasResponse || now.Sub(receivedAt) > reference.MaxAge
	}
	return !hasResponse
}

func ExtractResponseValue(response *vulpesDtos.HttpResponseDto, reference ResponseReference) (string, error) {
	body := response.Body
	if response.BodyEncoding == vulpesDtos.EncodingBase64 {
		decoded, err := base64.StdEncoding.DecodeString(body)
		if err != nil {
			return "", fmt.Errorf("o corpo da resposta de origem é inválido: %w", err)
		}
		body = string(decoded)
	}

	filter := strings.TrimSpace(reference.Filter)
	switch reference.Field {
	case ResponseFieldUrl:
		return response.Url, nil
	case ResponseFieldRaw:
		return body, nil
	case ResponseFieldHeader:
		if filter == "" {
			return "", errors.New("informe o nome do cabeçalho em {{$response 'header', ...}}")
		}
		for _, header := range response.Headers {
			if strings.EqualFold(header.Key, filter) {
				return header.Value, nil
			}
		}
		return "", fmt.Errorf("o cabeçalho %s não está na resposta de origem", filter)
	}
	switch {
	case filter == "":
		return body, nil
	case strings.HasPrefix(filter, "$"):
		return ExtractJsonPath(body, filter)
	}
	return "", fmt.Errorf("o filtro %q não é suportado; use JSONPath (começando com $)", filter)
}

func FindRequestItem(items []vulpesDtos.CollectionItemDto, reference string) *vulpesDtos.CollectionItemDto {
	if item := FindItem(items, reference); item != nil && item.Kind == vulpesDtos.ItemKindRequest {
		return item
	}
	matches := []*vulpesDtos.CollectionItemDto{}
	collectRequestsNamed(items, reference, &matches)
	if len(matches) == 1 {
		return matches[0]
	}
	return nil
}

func collectRequestsNamed(items []vulpesDtos.CollectionItemDto, name string, matches *[]*vulpesDtos.CollectionItemDto) {
	for index := range items {
		item := &items[index]
		if item.Kind == vulpesDtos.ItemKindRequest && item.Name == name {
			*matches = append(*matches, item)
		}
		collectRequestsNamed(item.Children, name, matches)
	}
}

func ParseTagArguments(text string) []string {
	var quote byte
	var current strings.Builder
	arguments := []string{}
	hasValue := false
	for position := 0; position < len(text); position++ {
		character := text[position]
		switch {
		case quote != 0 && character == '\\' && position+1 < len(text):
			position++
			current.WriteByte(text[position])
		case quote != 0 && character == quote:
			quote = 0
		case quote != 0:
			current.WriteByte(character)
		case character == '\'' || character == '"':
			quote, hasValue = character, true
		case character == ',':
			arguments = append(arguments, current.String())
			current.Reset()
			hasValue = false
		case character != ' ' && character != '\t' && character != '\n' && character != '\r':
			current.WriteByte(character)
			hasValue = true
		}
	}
	if hasValue || len(arguments) > 0 {
		arguments = append(arguments, current.String())
	}
	return arguments
}

func quoteTagArgument(value string) string {
	return "'" + strings.NewReplacer(`\`, `\\`, `'`, `\'`).Replace(value) + "'"
}

func decodeResponseFilter(filter string) string {
	encoded, found := strings.CutPrefix(filter, encodedFilterPrefix)
	if !found {
		return filter
	}
	encoded = strings.TrimSuffix(encoded, encodedFilterSuffix)
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return filter
	}
	return string(decoded)
}
