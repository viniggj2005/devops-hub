package vulpesFunctions

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const upperHexDigits = "0123456789ABCDEF"

var schemePattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]*://`)

func HasScheme(rawUrl string) bool {
	return schemePattern.MatchString(rawUrl)
}

func NormalizeUrl(rawUrl string, defaultScheme string) (string, error) {
	trimmed := strings.TrimSpace(rawUrl)
	if trimmed == "" {
		return "", errors.New("informe a URL")
	}
	if match := variablePattern.FindString(trimmed); match != "" {
		return "", fmt.Errorf("a variável %s não está definida na coleção nem no ambiente selecionado", match)
	}
	if !HasScheme(trimmed) {
		trimmed = defaultScheme + "://" + trimmed
	}
	if hashIndex := strings.IndexByte(trimmed, '#'); hashIndex >= 0 {
		trimmed = trimmed[:hashIndex]
	}

	base, query, hasQuery := strings.Cut(trimmed, "?")
	normalized := encodeInvalidCharacters(base, isPathCharacter)
	if hasQuery && query != "" {
		normalized += "?" + EncodeQuery(query)
	}

	parsed, err := url.Parse(normalized)
	if err != nil {
		return "", fmt.Errorf("URL inválida: %w", err)
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("URL inválida: %q não possui host", rawUrl)
	}
	return normalized, nil
}

func EncodeQuery(query string) string {
	return encodeInvalidCharacters(query, isQueryCharacter)
}

func AppendQuery(rawUrl string, entries []vulpesDtos.HeaderDto) string {
	if len(entries) == 0 {
		return rawUrl
	}
	pairs := make([]string, 0, len(entries))
	for _, entry := range entries {
		pairs = append(pairs, url.QueryEscape(entry.Key)+"="+url.QueryEscape(entry.Value))
	}
	separator := "?"
	if strings.Contains(rawUrl, "?") {
		separator = "&"
		if strings.HasSuffix(rawUrl, "?") || strings.HasSuffix(rawUrl, "&") {
			separator = ""
		}
	}
	return rawUrl + separator + strings.Join(pairs, "&")
}

func ApplyPathVariables(rawUrl string, variables []vulpesDtos.KeyValueDto) string {
	values := map[string]string{}
	for _, variable := range variables {
		if variable.Key != "" {
			values[variable.Key] = variable.Value
		}
	}
	pathStart := pathStartIndex(rawUrl)
	if len(values) == 0 || pathStart < 0 {
		return rawUrl
	}

	path, query, hasQuery := strings.Cut(rawUrl[pathStart:], "?")
	segments := strings.Split(path, "/")
	for index, segment := range segments {
		if value, found := values[strings.TrimPrefix(segment, ":")]; found && strings.HasPrefix(segment, ":") {
			segments[index] = value
		}
	}

	resolved := rawUrl[:pathStart] + strings.Join(segments, "/")
	if hasQuery {
		resolved += "?" + query
	}
	return resolved
}

func PathVariableNames(rawUrl string) []string {
	pathStart := pathStartIndex(rawUrl)
	if pathStart < 0 {
		return []string{}
	}
	path, _, _ := strings.Cut(rawUrl[pathStart:], "?")
	names := []string{}
	for _, segment := range strings.Split(path, "/") {
		if len(segment) > 1 && strings.HasPrefix(segment, ":") {
			names = append(names, segment[1:])
		}
	}
	return names
}

func pathStartIndex(rawUrl string) int {
	authorityStart := 0
	if schemeEnd := strings.Index(rawUrl, "://"); schemeEnd >= 0 {
		authorityStart = schemeEnd + 3
	}
	for position := authorityStart; position < len(rawUrl); position++ {
		switch rawUrl[position] {
		case '/':
			return position
		case '?', '#':
			return -1
		}
	}
	return -1
}

func encodeInvalidCharacters(text string, isAllowed func(byte) bool) string {
	var builder strings.Builder
	builder.Grow(len(text))
	for position := 0; position < len(text); position++ {
		character := text[position]
		isEscapeSequence := character == '%' && position+2 < len(text) && isHexDigit(text[position+1]) && isHexDigit(text[position+2])
		if isEscapeSequence || isAllowed(character) {
			builder.WriteByte(character)
			continue
		}
		builder.WriteByte('%')
		builder.WriteByte(upperHexDigits[character>>4])
		builder.WriteByte(upperHexDigits[character&15])
	}
	return builder.String()
}

func isUnreserved(character byte) bool {
	return 'a' <= character && character <= 'z' ||
		'A' <= character && character <= 'Z' ||
		'0' <= character && character <= '9' ||
		strings.IndexByte("-._~", character) >= 0
}

func isPathCharacter(character byte) bool {
	return isUnreserved(character) || strings.IndexByte("!$&'()*+,;=:@/[]", character) >= 0
}

func isQueryCharacter(character byte) bool {
	return isUnreserved(character) || strings.IndexByte("!$&'()*+,;=:@/?", character) >= 0
}

func isHexDigit(character byte) bool {
	return '0' <= character && character <= '9' ||
		'a' <= character && character <= 'f' ||
		'A' <= character && character <= 'F'
}
