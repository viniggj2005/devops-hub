package vulpesFunctions

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

var utf8ByteOrderMark = []byte("\xef\xbb\xbf")

type flexibleText string

func (text *flexibleText) UnmarshalJSON(raw []byte) error {
	*text = flexibleText(rawText(raw))
	return nil
}

func ParseImportFile(content []byte, sourceName string) (*ImportedData, error) {
	document, err := importDocumentAsJson(bytes.TrimPrefix(content, utf8ByteOrderMark), sourceName)
	if err != nil {
		return nil, err
	}
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(document, &probe); err != nil {
		return nil, fmt.Errorf("%s não é uma coleção nem um ambiente do Postman ou do Insomnia", sourceName)
	}
	if isInsomniaDocument(probe) {
		return ParseInsomniaFile(document, sourceName)
	}
	return ParsePostmanFile(document, sourceName)
}

func importDocumentAsJson(content []byte, sourceName string) ([]byte, error) {
	trimmed := bytes.TrimSpace(content)
	if len(trimmed) > 0 && (trimmed[0] == '{' || trimmed[0] == '[') {
		var probe any
		if err := json.Unmarshal(trimmed, &probe); err != nil {
			return nil, fmt.Errorf("%s não é um JSON válido: %w", sourceName, err)
		}
		return trimmed, nil
	}
	var document any
	if err := yaml.Unmarshal(trimmed, &document); err != nil {
		return nil, fmt.Errorf("%s não é um JSON nem um YAML válido: %w", sourceName, err)
	}
	converted, err := json.Marshal(jsonCompatible(document))
	if err != nil {
		return nil, fmt.Errorf("não foi possível converter o YAML de %s: %w", sourceName, err)
	}
	return converted, nil
}

func jsonCompatible(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		for key, entry := range typed {
			typed[key] = jsonCompatible(entry)
		}
		return typed
	case map[any]any:
		converted := make(map[string]any, len(typed))
		for key, entry := range typed {
			converted[fmt.Sprint(key)] = jsonCompatible(entry)
		}
		return converted
	case []any:
		for position, entry := range typed {
			typed[position] = jsonCompatible(entry)
		}
		return typed
	}
	return value
}

func isInsomniaDocument(probe map[string]json.RawMessage) bool {
	exportType, _ := jsonString(probe["_type"])
	if probe["resources"] != nil && (exportType == "export" || probe["__export_format"] != nil) {
		return true
	}
	documentType, _ := jsonString(probe["type"])
	return strings.Contains(documentType, ".insomnia.rest/")
}
