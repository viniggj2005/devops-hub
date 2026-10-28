package vulpesFunctions

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type jsonPathSelector int

const (
	selectKey jsonPathSelector = iota
	selectIndex
	selectWildcard
)

type jsonPathStep struct {
	key       string
	index     int
	selector  jsonPathSelector
	recursive bool
}

func ExtractJsonPath(document string, path string) (string, error) {
	steps, err := parseJsonPath(path)
	if err != nil {
		return "", err
	}
	var root any
	decoder := json.NewDecoder(strings.NewReader(document))
	decoder.UseNumber()
	if err := decoder.Decode(&root); err != nil {
		return "", fmt.Errorf("a resposta não é um JSON válido para aplicar o filtro %s", path)
	}

	results := evaluateJsonPath(root, steps)
	switch {
	case len(results) == 0:
		return "", fmt.Errorf("o filtro %s não encontrou nenhum valor na resposta", path)
	case len(results) > 1:
		return "", fmt.Errorf("o filtro %s retornou %d valores; ajuste-o para retornar apenas um", path, len(results))
	}
	if text, isText := results[0].(string); isText {
		return text, nil
	}
	encoded, err := json.Marshal(results[0])
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func parseJsonPath(path string) ([]jsonPathStep, error) {
	trimmed := strings.TrimSpace(path)
	if !strings.HasPrefix(trimmed, "$") {
		return nil, fmt.Errorf("o filtro JSONPath %q precisa começar com $", path)
	}
	steps := []jsonPathStep{}
	position := 1
	for position < len(trimmed) {
		var step jsonPathStep
		var err error
		switch {
		case strings.HasPrefix(trimmed[position:], ".."):
			step, position, err = parseJsonPathSegment(trimmed, position+2)
			step.recursive = true
		case trimmed[position] == '.':
			step, position, err = parseJsonPathSegment(trimmed, position+1)
		case trimmed[position] == '[':
			step, position, err = parseJsonPathBracket(trimmed, position)
		default:
			err = fmt.Errorf("o filtro JSONPath %q é inválido perto de %q", path, trimmed[position:])
		}
		if err != nil {
			return nil, err
		}
		steps = append(steps, step)
	}
	return steps, nil
}

func parseJsonPathSegment(path string, start int) (jsonPathStep, int, error) {
	if start < len(path) && path[start] == '[' {
		return parseJsonPathBracket(path, start)
	}
	end := start
	for end < len(path) && path[end] != '.' && path[end] != '[' {
		end++
	}
	name := path[start:end]
	switch name {
	case "":
		return jsonPathStep{}, end, fmt.Errorf("o filtro JSONPath %q tem um segmento vazio", path)
	case "*":
		return jsonPathStep{selector: selectWildcard}, end, nil
	}
	return jsonPathStep{key: name, selector: selectKey}, end, nil
}

func parseJsonPathBracket(path string, start int) (jsonPathStep, int, error) {
	var quote byte
	for end := start + 1; end < len(path); end++ {
		character := path[end]
		switch {
		case quote != 0 && character == '\\':
			end++
		case quote != 0 && character == quote:
			quote = 0
		case quote == 0 && (character == '\'' || character == '"'):
			quote = character
		case quote == 0 && character == ']':
			step, err := jsonPathBracketStep(path, strings.TrimSpace(path[start+1:end]))
			return step, end + 1, err
		}
	}
	return jsonPathStep{}, len(path), fmt.Errorf("o filtro JSONPath %q tem um colchete sem fechamento", path)
}

func jsonPathBracketStep(path string, content string) (jsonPathStep, error) {
	if content == "*" {
		return jsonPathStep{selector: selectWildcard}, nil
	}
	if length := len(content); length >= 2 && (content[0] == '\'' || content[0] == '"') && content[length-1] == content[0] {
		return jsonPathStep{key: unescapeQuoted(content[1 : length-1]), selector: selectKey}, nil
	}
	if index, err := strconv.Atoi(content); err == nil {
		return jsonPathStep{index: index, selector: selectIndex}, nil
	}
	return jsonPathStep{}, fmt.Errorf("o filtro JSONPath %q usa a expressão [%s], que não é suportada (use chaves, índices, * ou ..)", path, content)
}

func unescapeQuoted(text string) string {
	if !strings.Contains(text, `\`) {
		return text
	}
	var builder strings.Builder
	for position := 0; position < len(text); position++ {
		if text[position] == '\\' && position+1 < len(text) {
			position++
		}
		builder.WriteByte(text[position])
	}
	return builder.String()
}

func evaluateJsonPath(root any, steps []jsonPathStep) []any {
	nodes := []any{root}
	for _, step := range steps {
		candidates := nodes
		if step.recursive {
			candidates = []any{}
			for _, node := range nodes {
				candidates = appendDescendants(candidates, node)
			}
		}
		selected := []any{}
		for _, candidate := range candidates {
			selected = append(selected, step.apply(candidate)...)
		}
		nodes = selected
	}
	return nodes
}

func appendDescendants(collected []any, node any) []any {
	collected = append(collected, node)
	switch typed := node.(type) {
	case map[string]any:
		for _, child := range typed {
			collected = appendDescendants(collected, child)
		}
	case []any:
		for _, child := range typed {
			collected = appendDescendants(collected, child)
		}
	}
	return collected
}

func (step jsonPathStep) apply(node any) []any {
	switch typed := node.(type) {
	case map[string]any:
		if step.selector == selectWildcard {
			values := make([]any, 0, len(typed))
			for _, value := range typed {
				values = append(values, value)
			}
			return values
		}
		if value, found := typed[step.key]; found && step.selector == selectKey {
			return []any{value}
		}
	case []any:
		switch step.selector {
		case selectWildcard:
			return typed
		case selectIndex:
			index := step.index
			if index < 0 {
				index += len(typed)
			}
			if index >= 0 && index < len(typed) {
				return []any{typed[index]}
			}
		}
	}
	return nil
}
