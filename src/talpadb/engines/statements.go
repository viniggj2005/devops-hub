package talpadbEngines

import (
	"fmt"
	"strings"
)

type tokenKind int

const (
	tokenWord tokenKind = iota
	tokenQuoted
	tokenString
	tokenNumber
	tokenSymbol
	tokenSlashLine
)

type token struct {
	end   int
	start int
	depth int
	text  string
	upper string
	kind  tokenKind
}

type dialect struct {
	plsqlBlocks       bool
	triggerBlocks     bool
	bracketIdentifier bool
	rowKeywords       map[string]bool
	returningRows     bool
}

type Statement struct {
	Text        string
	IsBlock     bool
	Keyword     string
	ReturnsRows bool
	tokens      []token
}

var commandModifiers = map[string]bool{
	"OR": true, "REPLACE": true, "UNIQUE": true, "TEMP": true, "TEMPORARY": true, "GLOBAL": true,
	"EDITIONABLE": true, "NONEDITIONABLE": true, "IF": true, "NOT": true, "EXISTS": true,
	"PUBLIC": true, "BITMAP": true, "FORCE": true, "NOFORCE": true, "VIRTUAL": true, "PRIVATE": true,
}

func (statement Statement) LeadingWords(count int) []string {
	return leadingWords(statement.tokens, count)
}

func CommandTag(statement Statement, affected int64) string {
	switch statement.Keyword {
	case "INSERT", "UPDATE", "DELETE", "MERGE", "REPLACE":
		return fmt.Sprintf("%s %d", statement.Keyword, affected)
	case "CREATE", "DROP", "ALTER":
		for _, word := range statement.LeadingWords(8)[1:] {
			if !commandModifiers[word] {
				return statement.Keyword + " " + word
			}
		}
	}
	if statement.IsBlock {
		return "PL/SQL"
	}
	return statement.Keyword
}

var oracleDialect = dialect{
	plsqlBlocks: true,
	rowKeywords: map[string]bool{"SELECT": true, "WITH": true},
}

var sqliteDialect = dialect{
	triggerBlocks:     true,
	returningRows:     true,
	bracketIdentifier: true,
	rowKeywords:       map[string]bool{"SELECT": true, "WITH": true, "PRAGMA": true, "EXPLAIN": true, "VALUES": true},
}

func isWordStart(character byte) bool {
	return character == '_' || character >= 0x80 ||
		(character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
}

func isWordPart(character byte) bool {
	return isWordStart(character) || character == '$' || character == '#' || (character >= '0' && character <= '9')
}

func isDigit(character byte) bool {
	return character >= '0' && character <= '9'
}

func isSlashLine(script string, position int) bool {
	lineStart := strings.LastIndexByte(script[:position], '\n') + 1
	if strings.TrimSpace(script[lineStart:position]) != "" {
		return false
	}
	lineEnd := strings.IndexByte(script[position+1:], '\n')
	rest := script[position+1:]
	if lineEnd >= 0 {
		rest = rest[:lineEnd]
	}
	return strings.TrimSpace(rest) == ""
}

func closingQuote(script string, start int, quote byte) int {
	for position := start + 1; position < len(script); position++ {
		if script[position] != quote {
			continue
		}
		if position+1 < len(script) && script[position+1] == quote {
			position++
			continue
		}
		return position + 1
	}
	return len(script)
}

func oracleAlternativeQuoteEnd(script string, start int) (int, bool) {
	if start+2 >= len(script) || script[start+1] != '\'' {
		return 0, false
	}
	opening := script[start+2]
	closing := opening
	switch opening {
	case '[':
		closing = ']'
	case '{':
		closing = '}'
	case '(':
		closing = ')'
	case '<':
		closing = '>'
	}
	terminator := string([]byte{closing, '\''})
	index := strings.Index(script[start+3:], terminator)
	if index < 0 {
		return len(script), true
	}
	return start + 3 + index + 2, true
}

func tokenize(script string, language dialect) []token {
	tokens := []token{}
	length := len(script)
	for position := 0; position < length; {
		character := script[position]
		switch {
		case character == ' ' || character == '\t' || character == '\r' || character == '\n':
			position++
		case character == '-' && position+1 < length && script[position+1] == '-':
			lineEnd := strings.IndexByte(script[position:], '\n')
			if lineEnd < 0 {
				position = length
			} else {
				position += lineEnd + 1
			}
		case character == '/' && position+1 < length && script[position+1] == '*':
			commentEnd := strings.Index(script[position+2:], "*/")
			if commentEnd < 0 {
				position = length
			} else {
				position += commentEnd + 4
			}
		case character == '/' && language.plsqlBlocks && isSlashLine(script, position):
			tokens = append(tokens, token{kind: tokenSlashLine, start: position, end: position + 1, text: "/", upper: "/"})
			position++
		case (character == 'q' || character == 'Q') && language.plsqlBlocks && position+1 < length && script[position+1] == '\'':
			end, _ := oracleAlternativeQuoteEnd(script, position)
			tokens = append(tokens, token{kind: tokenString, start: position, end: end, text: script[position:end]})
			position = end
		case character == '\'':
			end := closingQuote(script, position, '\'')
			tokens = append(tokens, token{kind: tokenString, start: position, end: end, text: script[position:end]})
			position = end
		case character == '"' || (character == '`' && language.bracketIdentifier):
			end := closingQuote(script, position, character)
			inner := script[position+1 : max(position+1, end-1)]
			inner = strings.ReplaceAll(inner, string([]byte{character, character}), string(character))
			tokens = append(tokens, token{kind: tokenQuoted, start: position, end: end, text: inner, upper: strings.ToUpper(inner)})
			position = end
		case character == '[' && language.bracketIdentifier:
			closing := strings.IndexByte(script[position:], ']')
			end := length
			if closing >= 0 {
				end = position + closing + 1
			}
			inner := script[position+1 : max(position+1, end-1)]
			tokens = append(tokens, token{kind: tokenQuoted, start: position, end: end, text: inner, upper: strings.ToUpper(inner)})
			position = end
		case isWordStart(character):
			end := position + 1
			for end < length && isWordPart(script[end]) {
				end++
			}
			word := script[position:end]
			tokens = append(tokens, token{kind: tokenWord, start: position, end: end, text: word, upper: strings.ToUpper(word)})
			position = end
		case isDigit(character) || (character == '.' && position+1 < length && isDigit(script[position+1])):
			end := position + 1
			for end < length && (isDigit(script[end]) || script[end] == '.' || script[end] == 'e' || script[end] == 'E') {
				end++
			}
			tokens = append(tokens, token{kind: tokenNumber, start: position, end: end, text: script[position:end]})
			position = end
		default:
			tokens = append(tokens, token{kind: tokenSymbol, start: position, end: position + 1, text: string(character), upper: string(character)})
			position++
		}
	}
	return tokens
}

func leadingWords(tokens []token, count int) []string {
	words := []string{}
	for _, item := range tokens {
		if item.kind != tokenWord {
			break
		}
		words = append(words, item.upper)
		if len(words) == count {
			break
		}
	}
	return words
}

func isPlsqlBlock(tokens []token) bool {
	words := leadingWords(tokens, 6)
	if len(words) == 0 {
		return false
	}
	if words[0] == "DECLARE" || words[0] == "BEGIN" {
		return true
	}
	if words[0] != "CREATE" {
		return false
	}
	for _, word := range words[1:] {
		switch word {
		case "OR", "REPLACE", "EDITIONABLE", "NONEDITIONABLE", "EDITIONING":
			continue
		case "FUNCTION", "PROCEDURE", "PACKAGE", "TRIGGER", "TYPE", "LIBRARY", "JAVA":
			return true
		}
		return false
	}
	return false
}

func isTriggerBlock(tokens []token) bool {
	words := leadingWords(tokens, 3)
	if len(words) < 2 || words[0] != "CREATE" {
		return false
	}
	if words[1] == "TRIGGER" {
		return true
	}
	return len(words) == 3 && (words[1] == "TEMP" || words[1] == "TEMPORARY") && words[2] == "TRIGGER"
}

func splitStatements(script string, language dialect) []Statement {
	statements := []Statement{}
	current := []token{}
	blockDepth := 0
	sawBlockBegin := false

	flush := func() {
		if len(current) == 0 {
			return
		}
		statements = append(statements, buildStatement(script, current, language))
		current = []token{}
		blockDepth = 0
		sawBlockBegin = false
	}

	for _, item := range tokenize(script, language) {
		if item.kind == tokenSlashLine {
			flush()
			continue
		}
		inPlsql := language.plsqlBlocks && isPlsqlBlock(current)
		inTrigger := language.triggerBlocks && isTriggerBlock(current)

		if inTrigger && item.kind == tokenWord {
			switch item.upper {
			case "BEGIN", "CASE":
				blockDepth++
				sawBlockBegin = sawBlockBegin || item.upper == "BEGIN"
			case "END":
				if blockDepth > 0 {
					blockDepth--
				}
			}
		}

		if item.kind == tokenSymbol && item.text == ";" {
			if inPlsql {
				current = append(current, item)
				continue
			}
			if inTrigger && (!sawBlockBegin || blockDepth > 0) {
				current = append(current, item)
				continue
			}
			flush()
			continue
		}
		current = append(current, item)
	}
	flush()
	return statements
}

func buildStatement(script string, tokens []token, language dialect) Statement {
	depth := 0
	analyzed := make([]token, len(tokens))
	for index, item := range tokens {
		if item.kind == tokenSymbol && item.text == ")" && depth > 0 {
			depth--
		}
		item.depth = depth
		if item.kind == tokenSymbol && item.text == "(" {
			depth++
		}
		analyzed[index] = item
	}

	keyword := ""
	if analyzed[0].kind == tokenWord {
		keyword = analyzed[0].upper
	}
	returnsRows := language.rowKeywords[keyword]
	if !returnsRows && language.returningRows {
		for _, item := range analyzed {
			if item.depth == 0 && item.kind == tokenWord && item.upper == "RETURNING" {
				returnsRows = true
				break
			}
		}
	}

	return Statement{
		IsBlock:     language.plsqlBlocks && isPlsqlBlock(tokens) && keyword != "CREATE",
		Keyword:     keyword,
		ReturnsRows: returnsRows,
		tokens:      analyzed,
		Text:        strings.TrimSpace(script[analyzed[0].start:analyzed[len(analyzed)-1].end]),
	}
}

var singleTableBreakers = map[string]bool{
	"JOIN": true, "UNION": true, "INTERSECT": true, "EXCEPT": true, "MINUS": true,
	"GROUP": true, "HAVING": true, "DISTINCT": true, "CONNECT": true, "PIVOT": true,
	"UNPIVOT": true, "MODEL": true, "WINDOW": true, "NATURAL": true, "CROSS": true,
}

var singleTableFollowers = map[string]bool{
	"WHERE": true, "ORDER": true, "LIMIT": true, "FETCH": true, "OFFSET": true, "FOR": true,
}

type TableReference struct {
	Name         string
	Schema       string
	NameQuoted   bool
	SchemaQuoted bool
}

func (statement Statement) SingleTable() (TableReference, bool) {
	reference := TableReference{}
	topLevel := []token{}
	for _, item := range statement.tokens {
		if item.depth == 0 {
			topLevel = append(topLevel, item)
		}
	}
	if len(topLevel) == 0 || topLevel[0].upper != "SELECT" {
		return reference, false
	}

	fromIndex := -1
	for index, item := range topLevel {
		if item.kind == tokenWord && singleTableBreakers[item.upper] {
			return reference, false
		}
		if item.kind == tokenWord && item.upper == "FROM" && fromIndex < 0 {
			fromIndex = index
		}
	}
	if fromIndex < 0 || fromIndex+1 >= len(topLevel) {
		return reference, false
	}

	isIdentifier := func(item token) bool { return item.kind == tokenWord || item.kind == tokenQuoted }
	position := fromIndex + 1
	first := topLevel[position]
	if !isIdentifier(first) {
		return reference, false
	}
	reference.Name, reference.NameQuoted = first.text, first.kind == tokenQuoted
	position++

	if position+1 < len(topLevel) && topLevel[position].text == "." && isIdentifier(topLevel[position+1]) {
		reference.Schema, reference.SchemaQuoted = reference.Name, reference.NameQuoted
		reference.Name, reference.NameQuoted = topLevel[position+1].text, topLevel[position+1].kind == tokenQuoted
		position += 2
	}

	if position < len(topLevel) && topLevel[position].kind == tokenWord && topLevel[position].upper == "AS" {
		position++
	}
	if position < len(topLevel) && isIdentifier(topLevel[position]) && !singleTableFollowers[topLevel[position].upper] {
		position++
	}
	if position < len(topLevel) {
		next := topLevel[position]
		if next.kind != tokenWord || !singleTableFollowers[next.upper] {
			return reference, false
		}
	}
	return reference, true
}
