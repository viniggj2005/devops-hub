package vulpesFunctions

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

type ImportedCollection struct {
	Name    string
	Content vulpesDtos.CollectionContentDto
}

type ImportedData struct {
	Warnings     []string
	Collections  []ImportedCollection
	Environments []vulpesDtos.EnvironmentInputDto
}

type postmanEntry struct {
	ID          string          `json:"id"`
	Key         *string         `json:"key"`
	Src         json.RawMessage `json:"src"`
	Type        string          `json:"type"`
	Value       json.RawMessage `json:"value"`
	Enabled     *bool           `json:"enabled"`
	Disabled    bool            `json:"disabled"`
	ContentType string          `json:"contentType"`
	Description json.RawMessage `json:"description"`
}

type postmanScript struct {
	Exec json.RawMessage `json:"exec"`
}

type postmanEvent struct {
	Listen   string        `json:"listen"`
	Script   postmanScript `json:"script"`
	Disabled bool          `json:"disabled"`
}

type postmanInfo struct {
	Name        string          `json:"name"`
	Schema      string          `json:"schema"`
	Description json.RawMessage `json:"description"`
}

type postmanCollection struct {
	Info          postmanInfo            `json:"info"`
	Item          []postmanItem          `json:"item"`
	Auth          json.RawMessage        `json:"auth"`
	Event         []postmanEvent         `json:"event"`
	Variable      []postmanEntry         `json:"variable"`
	VulpesCookies []vulpesDtos.CookieDto `json:"vulpesCookies"`
}

type postmanItem struct {
	Name                    string                     `json:"name"`
	Item                    []postmanItem              `json:"item"`
	Auth                    json.RawMessage            `json:"auth"`
	Event                   []postmanEvent             `json:"event"`
	Request                 json.RawMessage            `json:"request"`
	Response                []json.RawMessage          `json:"response"`
	Description             json.RawMessage            `json:"description"`
	VulpesRequest           *vulpesDtos.RequestDto     `json:"vulpesRequest"`
	ProtocolProfileBehavior map[string]json.RawMessage `json:"protocolProfileBehavior"`
}

type postmanRequest struct {
	Url         json.RawMessage `json:"url"`
	Body        *postmanBody    `json:"body"`
	Auth        json.RawMessage `json:"auth"`
	Method      string          `json:"method"`
	Header      json.RawMessage `json:"header"`
	Description json.RawMessage `json:"description"`
}

type postmanUrl struct {
	Raw      string          `json:"raw"`
	Host     json.RawMessage `json:"host"`
	Path     json.RawMessage `json:"path"`
	Port     string          `json:"port"`
	Query    []postmanEntry  `json:"query"`
	Protocol string          `json:"protocol"`
	Variable []postmanEntry  `json:"variable"`
}

type postmanFile struct {
	Src json.RawMessage `json:"src"`
}

type postmanGraphql struct {
	Query     string          `json:"query"`
	Variables json.RawMessage `json:"variables"`
}

type postmanRawOptions struct {
	Language string `json:"language"`
}

type postmanBodyOptions struct {
	Raw *postmanRawOptions `json:"raw"`
}

type postmanBody struct {
	Raw        string              `json:"raw"`
	Mode       string              `json:"mode"`
	File       *postmanFile        `json:"file"`
	Graphql    *postmanGraphql     `json:"graphql"`
	Options    *postmanBodyOptions `json:"options"`
	Disabled   bool                `json:"disabled"`
	Formdata   []postmanEntry      `json:"formdata"`
	Urlencoded []postmanEntry      `json:"urlencoded"`
}

type postmanEnvironment struct {
	Name   string         `json:"name"`
	Scope  string         `json:"_postman_variable_scope"`
	Values []postmanEntry `json:"values"`
}

type warningCollector struct {
	order  []string
	counts map[string]int
}

func newWarningCollector() *warningCollector {
	return &warningCollector{counts: map[string]int{}}
}

func (collector *warningCollector) add(message string) {
	if collector.counts[message] == 0 {
		collector.order = append(collector.order, message)
	}
	collector.counts[message]++
}

func (collector *warningCollector) list() []string {
	messages := make([]string, 0, len(collector.order))
	for _, message := range collector.order {
		if count := collector.counts[message]; count > 1 {
			message = fmt.Sprintf("%s (%d ocorrências)", message, count)
		}
		messages = append(messages, message)
	}
	return messages
}

type postmanImporter struct {
	warnings *warningCollector
}

func ParsePostmanFile(content []byte, sourceName string) (*ImportedData, error) {
	content = bytes.TrimPrefix(content, []byte("\xef\xbb\xbf"))
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(content, &probe); err != nil {
		return nil, fmt.Errorf("%s não é um JSON válido: %w", sourceName, err)
	}

	importer := postmanImporter{warnings: newWarningCollector()}
	imported := &ImportedData{}
	switch {
	case probe["info"] != nil:
		collection, err := importer.parseCollection(content, sourceName)
		if err != nil {
			return nil, err
		}
		imported.Collections = append(imported.Collections, *collection)
	case probe["values"] != nil:
		environment, err := parseEnvironment(content, sourceName)
		if err != nil {
			return nil, err
		}
		imported.Environments = append(imported.Environments, *environment)
	case probe["requests"] != nil && probe["order"] != nil:
		return nil, fmt.Errorf("%s está no formato Postman v1, que não é suportado; exporte a coleção novamente como v2.1", sourceName)
	default:
		return nil, fmt.Errorf("%s não é uma coleção nem um ambiente do Postman ou do Insomnia", sourceName)
	}
	imported.Warnings = importer.warnings.list()
	return imported, nil
}

func (importer postmanImporter) parseCollection(content []byte, sourceName string) (*ImportedCollection, error) {
	var collection postmanCollection
	if err := json.Unmarshal(content, &collection); err != nil {
		return nil, fmt.Errorf("não foi possível ler a coleção %s: %w", sourceName, err)
	}
	if strings.Contains(collection.Info.Schema, "/v1.") {
		return nil, fmt.Errorf("%s está no formato Postman v1, que não é suportado; exporte a coleção novamente como v2.1", sourceName)
	}

	name := strings.TrimSpace(collection.Info.Name)
	if name == "" {
		name = "Coleção importada"
	}
	imported := ImportedCollection{
		Name: name,
		Content: vulpesDtos.CollectionContentDto{
			Auth:        importer.parseAuth(collection.Auth, vulpesDtos.AuthNone),
			Cookies:     collection.VulpesCookies,
			Scripts:     importer.parseScripts(collection.Event),
			Variables:   parseVariables(collection.Variable),
			Description: descriptionText(collection.Info.Description),
		},
	}
	for _, item := range collection.Item {
		imported.Content.Items = append(imported.Content.Items, importer.parseItem(item))
	}
	NormalizeContent(&imported.Content)
	return &imported, nil
}

func (importer postmanImporter) parseItem(item postmanItem) vulpesDtos.CollectionItemDto {
	isFolder := item.Item != nil || (!hasJsonValue(item.Request) && item.VulpesRequest == nil)
	if isFolder {
		auth := importer.parseAuth(item.Auth, vulpesDtos.AuthInherit)
		folder := vulpesDtos.CollectionItemDto{
			Kind:        vulpesDtos.ItemKindFolder,
			Name:        item.Name,
			Auth:        &auth,
			Scripts:     importer.parseScripts(item.Event),
			Description: descriptionText(item.Description),
		}
		for _, child := range item.Item {
			folder.Children = append(folder.Children, importer.parseItem(child))
		}
		return folder
	}

	if len(item.Response) > 0 {
		importer.warnings.add("Exemplos de resposta salvos no Postman não são importados")
	}
	request := importer.parseRequest(item)
	return vulpesDtos.CollectionItemDto{
		Kind:        vulpesDtos.ItemKindRequest,
		Name:        item.Name,
		Request:     &request,
		Scripts:     importer.parseScripts(item.Event),
		Description: descriptionText(item.Description),
	}
}

func (importer postmanImporter) parseRequest(item postmanItem) vulpesDtos.RequestDto {
	if item.VulpesRequest != nil {
		request := *item.VulpesRequest
		NormalizeRequest(&request)
		return request
	}

	var definition postmanRequest
	if rawUrl, isString := jsonString(item.Request); isString {
		definition.Url, _ = json.Marshal(rawUrl)
	} else if err := json.Unmarshal(item.Request, &definition); err != nil {
		importer.warnings.add("Algumas requisições tinham formato inválido e foram importadas vazias")
	}

	httpRequest := &vulpesDtos.HttpRequestDto{Method: definition.Method}
	httpRequest.Url, httpRequest.Params, httpRequest.PathVariables = parseUrl(definition.Url)
	httpRequest.Headers = parseHeaders(definition.Header)
	httpRequest.Body = importer.parseBody(definition.Body, httpRequest.Headers)
	httpRequest.Settings = parseProtocolBehavior(item.ProtocolProfileBehavior)

	request := vulpesDtos.RequestDto{
		Http:     httpRequest,
		Auth:     importer.parseAuth(definition.Auth, vulpesDtos.AuthInherit),
		Protocol: vulpesDtos.ProtocolHttp,
	}
	NormalizeRequest(&request)
	return request
}

func parseProtocolBehavior(behavior map[string]json.RawMessage) vulpesDtos.HttpSettingsDto {
	var settings vulpesDtos.HttpSettingsDto
	if string(behavior["followRedirects"]) == "false" {
		settings.DisableRedirects = true
	}
	if string(behavior["strictSSL"]) == "false" {
		settings.SkipTlsVerify = true
	}
	return settings
}

func parseUrl(raw json.RawMessage) (string, []vulpesDtos.KeyValueDto, []vulpesDtos.KeyValueDto) {
	if rawUrl, isString := jsonString(raw); isString {
		return rawUrl, parseQueryString(rawUrl), pathVariablesFromUrl(rawUrl, nil)
	}

	var definition postmanUrl
	if len(raw) == 0 || json.Unmarshal(raw, &definition) != nil {
		return "", []vulpesDtos.KeyValueDto{}, []vulpesDtos.KeyValueDto{}
	}

	rawUrl := definition.Raw
	if rawUrl == "" {
		rawUrl = buildUrlFromParts(definition)
	}
	if definition.Query == nil {
		return rawUrl, parseQueryString(rawUrl), pathVariablesFromUrl(rawUrl, definition.Variable)
	}

	base, _, _ := strings.Cut(rawUrl, "?")
	params := make([]vulpesDtos.KeyValueDto, 0, len(definition.Query))
	enabledPairs := []string{}
	for _, entry := range definition.Query {
		if entry.Key == nil {
			continue
		}
		param := vulpesDtos.KeyValueDto{
			Key:         *entry.Key,
			Value:       rawText(entry.Value),
			Enabled:     !entry.Disabled,
			Description: descriptionText(entry.Description),
		}
		params = append(params, param)
		if param.Enabled {
			enabledPairs = append(enabledPairs, queryPair(param.Key, param.Value, hasJsonValue(entry.Value)))
		}
	}
	if len(enabledPairs) > 0 {
		base += "?" + strings.Join(enabledPairs, "&")
	}
	return base, params, pathVariablesFromUrl(base, definition.Variable)
}

func buildUrlFromParts(definition postmanUrl) string {
	var builder strings.Builder
	if definition.Protocol != "" {
		builder.WriteString(definition.Protocol + "://")
	}
	builder.WriteString(joinedSegments(definition.Host, "."))
	if definition.Port != "" {
		builder.WriteString(":" + definition.Port)
	}
	if path := joinedSegments(definition.Path, "/"); path != "" {
		builder.WriteString("/" + strings.TrimPrefix(path, "/"))
	}
	return builder.String()
}

func joinedSegments(raw json.RawMessage, separator string) string {
	if text, isString := jsonString(raw); isString {
		return text
	}
	var segments []json.RawMessage
	if json.Unmarshal(raw, &segments) != nil {
		return ""
	}
	parts := make([]string, 0, len(segments))
	for _, segment := range segments {
		if text, isString := jsonString(segment); isString {
			parts = append(parts, text)
			continue
		}
		var typedSegment struct {
			Value string `json:"value"`
		}
		if json.Unmarshal(segment, &typedSegment) == nil {
			parts = append(parts, typedSegment.Value)
		}
	}
	return strings.Join(parts, separator)
}

func queryPair(key string, value string, hasValue bool) string {
	if !hasValue && value == "" {
		return key
	}
	return key + "=" + value
}

func parseQueryString(rawUrl string) []vulpesDtos.KeyValueDto {
	params := []vulpesDtos.KeyValueDto{}
	_, query, hasQuery := strings.Cut(rawUrl, "?")
	if !hasQuery {
		return params
	}
	query, _, _ = strings.Cut(query, "#")
	for _, pair := range strings.Split(query, "&") {
		if pair == "" {
			continue
		}
		key, value, _ := strings.Cut(pair, "=")
		params = append(params, vulpesDtos.KeyValueDto{Key: key, Value: value, Enabled: true})
	}
	return params
}

func pathVariablesFromUrl(rawUrl string, entries []postmanEntry) []vulpesDtos.KeyValueDto {
	known := map[string]postmanEntry{}
	for _, entry := range entries {
		if key := entryKey(entry); key != "" {
			known[key] = entry
		}
	}
	variables := []vulpesDtos.KeyValueDto{}
	for _, name := range PathVariableNames(rawUrl) {
		entry := known[name]
		variables = append(variables, vulpesDtos.KeyValueDto{
			Key:         name,
			Value:       rawText(entry.Value),
			Enabled:     true,
			Description: descriptionText(entry.Description),
		})
	}
	return variables
}

func parseHeaders(raw json.RawMessage) []vulpesDtos.KeyValueDto {
	headers := []vulpesDtos.KeyValueDto{}
	if text, isString := jsonString(raw); isString {
		for _, line := range strings.Split(text, "\n") {
			key, value, found := strings.Cut(line, ":")
			if found && strings.TrimSpace(key) != "" {
				headers = append(headers, vulpesDtos.KeyValueDto{Key: strings.TrimSpace(key), Value: strings.TrimSpace(value), Enabled: true})
			}
		}
		return headers
	}

	var entries []postmanEntry
	if len(raw) == 0 || json.Unmarshal(raw, &entries) != nil {
		return headers
	}
	for _, entry := range entries {
		headers = append(headers, vulpesDtos.KeyValueDto{
			Key:         entryKey(entry),
			Value:       rawText(entry.Value),
			Enabled:     !entry.Disabled,
			Description: descriptionText(entry.Description),
		})
	}
	return headers
}

func (importer postmanImporter) parseBody(body *postmanBody, headers []vulpesDtos.KeyValueDto) vulpesDtos.HttpBodyDto {
	parsed := vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyNone}
	if body == nil || body.Disabled {
		return parsed
	}

	switch body.Mode {
	case "raw":
		parsed.Mode = vulpesDtos.BodyRaw
		parsed.Raw = body.Raw
		parsed.Language = rawLanguage(body, headers)
	case "urlencoded":
		parsed.Mode = vulpesDtos.BodyUrlEncoded
		for _, entry := range body.Urlencoded {
			parsed.UrlEncoded = append(parsed.UrlEncoded, vulpesDtos.KeyValueDto{
				Key:         entryKey(entry),
				Value:       rawText(entry.Value),
				Enabled:     !entry.Disabled,
				Description: descriptionText(entry.Description),
			})
		}
	case "formdata":
		parsed.Mode = vulpesDtos.BodyFormData
		for _, entry := range body.Formdata {
			parsed.FormData = append(parsed.FormData, importer.parseFormField(entry))
		}
	case "file":
		parsed.Mode = vulpesDtos.BodyBinary
		if body.File != nil {
			parsed.BinaryPath = importer.firstSource(body.File.Src)
		}
	case "graphql":
		parsed.Mode = vulpesDtos.BodyGraphql
		if body.Graphql != nil {
			parsed.GraphqlQuery = body.Graphql.Query
			parsed.GraphqlVariables = rawText(body.Graphql.Variables)
		}
	}
	return parsed
}

func (importer postmanImporter) parseFormField(entry postmanEntry) vulpesDtos.FormFieldDto {
	field := vulpesDtos.FormFieldDto{
		Key:         entryKey(entry),
		Kind:        "text",
		Enabled:     !entry.Disabled,
		ContentType: entry.ContentType,
	}
	if entry.Type == "file" {
		field.Kind = "file"
		field.FilePath = importer.firstSource(entry.Src)
		return field
	}
	field.Value = rawText(entry.Value)
	return field
}

func (importer postmanImporter) firstSource(raw json.RawMessage) string {
	if path, isString := jsonString(raw); isString {
		return path
	}
	var paths []string
	if json.Unmarshal(raw, &paths) == nil && len(paths) > 0 {
		if len(paths) > 1 {
			importer.warnings.add("Campos com vários arquivos foram importados apenas com o primeiro arquivo")
		}
		return paths[0]
	}
	return ""
}

func rawLanguage(body *postmanBody, headers []vulpesDtos.KeyValueDto) string {
	if body.Options != nil && body.Options.Raw != nil && body.Options.Raw.Language != "" {
		if _, supported := rawLanguageContentTypes[body.Options.Raw.Language]; supported {
			return body.Options.Raw.Language
		}
		return "text"
	}
	for _, header := range headers {
		if !strings.EqualFold(header.Key, "Content-Type") {
			continue
		}
		contentType := strings.ToLower(header.Value)
		switch {
		case strings.Contains(contentType, "json"):
			return "json"
		case strings.Contains(contentType, "xml"):
			return "xml"
		case strings.Contains(contentType, "html"):
			return "html"
		case strings.Contains(contentType, "javascript"):
			return "javascript"
		}
	}
	trimmed := strings.TrimSpace(body.Raw)
	if (strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[")) && json.Valid([]byte(trimmed)) {
		return "json"
	}
	return "text"
}

func (importer postmanImporter) parseAuth(raw json.RawMessage, fallback string) vulpesDtos.AuthDto {
	if len(raw) == 0 || string(raw) == "null" {
		return vulpesDtos.AuthDto{Type: fallback}
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return vulpesDtos.AuthDto{Type: fallback}
	}
	authType, _ := jsonString(fields["type"])
	params := authParams(fields[authType])

	switch authType {
	case "noauth":
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
	case "inherit":
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthInherit}
	case "bearer":
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: params["token"]}
	case "basic":
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthBasic, Username: params["username"], Password: params["password"]}
	case "apikey":
		location := "header"
		if params["in"] == "query" {
			location = "query"
		}
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthApiKey, Key: params["key"], Value: params["value"], Location: location}
	case "oauth2":
		if token := params["accessToken"]; token != "" {
			importer.warnings.add("Autenticações OAuth 2.0 foram convertidas em Bearer Token com o access token salvo")
			return vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: token}
		}
	}
	importer.warnings.add(fmt.Sprintf("Autenticação do tipo %q não é suportada e foi ignorada", authType))
	return vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
}

func authParams(raw json.RawMessage) map[string]string {
	params := map[string]string{}
	var entries []postmanEntry
	if json.Unmarshal(raw, &entries) == nil {
		for _, entry := range entries {
			params[entryKey(entry)] = rawText(entry.Value)
		}
		return params
	}
	var values map[string]json.RawMessage
	if json.Unmarshal(raw, &values) == nil {
		for key, value := range values {
			params[key] = rawText(value)
		}
	}
	return params
}

func (importer postmanImporter) parseScripts(events []postmanEvent) []vulpesDtos.ScriptDto {
	scripts := []vulpesDtos.ScriptDto{}
	for _, event := range events {
		source := scriptSource(event.Script.Exec)
		if event.Disabled || strings.TrimSpace(source) == "" {
			continue
		}
		scripts = append(scripts, vulpesDtos.ScriptDto{Listen: event.Listen, Source: source})
	}
	if len(scripts) > 0 {
		importer.warnings.add("Scripts do Postman foram preservados, mas não são executados pelo Vulpes")
	}
	return scripts
}

func scriptSource(raw json.RawMessage) string {
	if text, isString := jsonString(raw); isString {
		return text
	}
	var lines []string
	if json.Unmarshal(raw, &lines) == nil {
		return strings.Join(lines, "\n")
	}
	return ""
}

func parseVariables(entries []postmanEntry) []vulpesDtos.VariableDto {
	variables := []vulpesDtos.VariableDto{}
	for _, entry := range entries {
		key := entryKey(entry)
		if key == "" {
			continue
		}
		enabled := !entry.Disabled
		if entry.Enabled != nil {
			enabled = *entry.Enabled
		}
		variables = append(variables, vulpesDtos.VariableDto{
			Key:     key,
			Value:   rawText(entry.Value),
			Secret:  entry.Type == "secret",
			Enabled: enabled,
		})
	}
	return variables
}

func parseEnvironment(content []byte, sourceName string) (*vulpesDtos.EnvironmentInputDto, error) {
	var environment postmanEnvironment
	if err := json.Unmarshal(content, &environment); err != nil {
		return nil, fmt.Errorf("não foi possível ler o ambiente %s: %w", sourceName, err)
	}
	name := strings.TrimSpace(environment.Name)
	if name == "" && environment.Scope == "globals" {
		name = "Globals"
	}
	if name == "" {
		name = "Ambiente importado"
	}
	return &vulpesDtos.EnvironmentInputDto{Name: name, Variables: parseVariables(environment.Values)}, nil
}

func entryKey(entry postmanEntry) string {
	if entry.Key != nil {
		return *entry.Key
	}
	return entry.ID
}

func hasJsonValue(raw json.RawMessage) bool {
	return len(raw) > 0 && string(raw) != "null"
}

func jsonString(raw json.RawMessage) (string, bool) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '"' {
		return "", false
	}
	var text string
	if json.Unmarshal(trimmed, &text) != nil {
		return "", false
	}
	return text, true
}

func rawText(raw json.RawMessage) string {
	if !hasJsonValue(raw) {
		return ""
	}
	if text, isString := jsonString(raw); isString {
		return text
	}
	return string(bytes.TrimSpace(raw))
}

func descriptionText(raw json.RawMessage) string {
	if text, isString := jsonString(raw); isString {
		return text
	}
	var description struct {
		Content string `json:"content"`
	}
	if hasJsonValue(raw) && json.Unmarshal(raw, &description) == nil {
		return description.Content
	}
	return ""
}
