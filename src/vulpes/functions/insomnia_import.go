package vulpesFunctions

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const (
	insomniaFolder           = "request_group"
	insomniaRequest          = "request"
	insomniaWorkspace        = "workspace"
	insomniaCookieJar        = "cookie_jar"
	insomniaOAuthToken       = "oauth2_token"
	insomniaEnvironment      = "environment"
	insomniaGrpcRequest      = "grpc_request"
	insomniaWebSocketPayload = "websocket_payload"
	insomniaWebSocketRequest = "websocket_request"
)

const (
	defaultInsomniaCollectionName  = "Coleção importada do Insomnia"
	defaultInsomniaEnvironmentName = "Ambiente importado"
)

var (
	insomniaTagPattern      = regexp.MustCompile(`\{%\s*([A-Za-z0-9_]+)([^%]*)%\}`)
	insomniaScriptPattern   = regexp.MustCompile(`\binsomnia\.`)
	insomniaBracketPattern  = regexp.MustCompile(`\{\{\s*_\[\s*['"]([^'"]+)['"]\s*\]\s*\}\}`)
	insomniaVariablePattern = regexp.MustCompile(`\{\{\s*_\.([^{}\s|]+)\s*\}\}`)
	queryComponentEscaper   = strings.NewReplacer("&", "%26", "#", "%23")
)

var silentInsomniaTypes = map[string]bool{
	"project":           true,
	"api_spec":          true,
	"settings":          true,
	"response":          true,
	"proto_file":        true,
	"plugin_data":       true,
	"request_meta":      true,
	"workspace_meta":    true,
	"git_repository":    true,
	"proto_directory":   true,
	"request_version":   true,
	"grpc_request_meta": true,
	insomniaCookieJar:   true,
	insomniaOAuthToken:  true,
	insomniaEnvironment: true,
}

var describedInsomniaTypes = map[string]string{
	"unit_test":          "Testes de unidade do Insomnia não são importados",
	"mock_route":         "Servidores mock do Insomnia não são importados",
	"mock_server":        "Servidores mock do Insomnia não são importados",
	"ca_certificate":     "Certificados de CA do Insomnia não são importados",
	"unit_test_suite":    "Testes de unidade do Insomnia não são importados",
	"client_certificate": "Certificados de cliente do Insomnia não são importados",
}

type insomniaPair struct {
	Name        flexibleText `json:"name"`
	Type        string       `json:"type"`
	Value       flexibleText `json:"value"`
	Disabled    bool         `json:"disabled"`
	FileName    string       `json:"fileName"`
	Description flexibleText `json:"description"`
}

type insomniaBody struct {
	Text     flexibleText   `json:"text"`
	Params   []insomniaPair `json:"params"`
	MimeType string         `json:"mimeType"`
	FileName string         `json:"fileName"`
}

type insomniaAuth struct {
	Key      flexibleText `json:"key"`
	Type     string       `json:"type"`
	AddTo    string       `json:"addTo"`
	Token    flexibleText `json:"token"`
	Value    flexibleText `json:"value"`
	Prefix   flexibleText `json:"prefix"`
	Disabled bool         `json:"disabled"`
	Username flexibleText `json:"username"`
	Password flexibleText `json:"password"`
}

type insomniaCookie struct {
	Key      flexibleText `json:"key"`
	Path     string       `json:"path"`
	Value    flexibleText `json:"value"`
	Domain   string       `json:"domain"`
	Secure   bool         `json:"secure"`
	Expires  flexibleText `json:"expires"`
	HostOnly bool         `json:"hostOnly"`
	HttpOnly bool         `json:"httpOnly"`
	SameSite string       `json:"sameSite"`
}

type insomniaResource struct {
	ID                     string                 `json:"_id"`
	Url                    flexibleText           `json:"url"`
	Name                   flexibleText           `json:"name"`
	Type                   string                 `json:"_type"`
	Body                   json.RawMessage        `json:"body"`
	Data                   json.RawMessage        `json:"data"`
	Mode                   string                 `json:"mode"`
	Scope                  string                 `json:"scope"`
	Value                  flexibleText           `json:"value"`
	Method                 string                 `json:"method"`
	Cookies                []insomniaCookie       `json:"cookies"`
	Headers                []insomniaPair         `json:"headers"`
	Metadata               []insomniaPair         `json:"metadata"`
	ParentID               string                 `json:"parentId"`
	Parameters             []insomniaPair         `json:"parameters"`
	AccessToken            string                 `json:"accessToken"`
	Description            flexibleText           `json:"description"`
	MetaSortKey            float64                `json:"metaSortKey"`
	Environment            json.RawMessage        `json:"environment"`
	ProtoFileID            string                 `json:"protoFileId"`
	VulpesRequest          *vulpesDtos.RequestDto `json:"vulpesRequest"`
	PathParameters         []insomniaPair         `json:"pathParameters"`
	Authentication         json.RawMessage        `json:"authentication"`
	ProtoMethodName        string                 `json:"protoMethodName"`
	PreRequestScript       string                 `json:"preRequestScript"`
	AfterResponseScript    string                 `json:"afterResponseScript"`
	SettingFollowRedirects string                 `json:"settingFollowRedirects"`
}

type insomniaV5Meta struct {
	ID          string       `json:"id"`
	Description flexibleText `json:"description"`
}

type insomniaV5Settings struct {
	FollowRedirects string `json:"followRedirects"`
}

type insomniaV5Scripts struct {
	PreRequest    string `json:"preRequest"`
	AfterResponse string `json:"afterResponse"`
}

type insomniaV5Item struct {
	insomniaResource
	Meta     insomniaV5Meta      `json:"meta"`
	Scripts  *insomniaV5Scripts  `json:"scripts"`
	Children []json.RawMessage   `json:"children"`
	Settings *insomniaV5Settings `json:"settings"`
}

type insomniaV5Environment struct {
	Name            flexibleText            `json:"name"`
	Meta            insomniaV5Meta          `json:"meta"`
	Data            json.RawMessage         `json:"data"`
	SubEnvironments []insomniaV5Environment `json:"subEnvironments"`
}

type insomniaV5CookieJar struct {
	Meta    insomniaV5Meta   `json:"meta"`
	Cookies []insomniaCookie `json:"cookies"`
}

type insomniaV5Document struct {
	Name         flexibleText           `json:"name"`
	Type         string                 `json:"type"`
	Meta         insomniaV5Meta         `json:"meta"`
	CookieJar    *insomniaV5CookieJar   `json:"cookieJar"`
	Collection   []json.RawMessage      `json:"collection"`
	Environments *insomniaV5Environment `json:"environments"`
}

type insomniaImporter struct {
	byID          map[string]*insomniaResource
	children      map[string][]*insomniaResource
	warnings      *warningCollector
	resources     []insomniaResource
	oauthTokens   map[string]string
	claimedEnvIDs map[string]bool
}

func ParseInsomniaFile(content []byte, sourceName string) (*ImportedData, error) {
	var probe struct {
		Type      string            `json:"type"`
		Resources []json.RawMessage `json:"resources"`
	}
	if err := json.Unmarshal(content, &probe); err != nil {
		return nil, fmt.Errorf("não foi possível ler o arquivo do Insomnia %s: %w", sourceName, err)
	}

	importer := &insomniaImporter{warnings: newWarningCollector()}
	resources := importer.decodeResources(probe.Resources)
	if strings.Contains(probe.Type, ".insomnia.rest/") {
		converted, err := importer.convertV5Document(content, sourceName)
		if err != nil {
			return nil, err
		}
		resources = converted
	}
	importer.index(resources)

	imported := importer.build()
	if len(imported.Collections) == 0 && len(imported.Environments) == 0 {
		return nil, fmt.Errorf("%s não contém coleções nem ambientes do Insomnia", sourceName)
	}
	imported.Warnings = importer.warnings.list()
	return imported, nil
}

func (importer *insomniaImporter) decodeResources(rawResources []json.RawMessage) []insomniaResource {
	resources := make([]insomniaResource, 0, len(rawResources))
	for _, raw := range rawResources {
		var resource insomniaResource
		if err := json.Unmarshal(raw, &resource); err != nil {
			importer.warnings.add("Alguns recursos do Insomnia tinham formato inválido e foram ignorados")
			continue
		}
		resources = append(resources, resource)
	}
	return resources
}

func (importer *insomniaImporter) convertV5Document(content []byte, sourceName string) ([]insomniaResource, error) {
	var document insomniaV5Document
	if err := json.Unmarshal(content, &document); err != nil {
		return nil, fmt.Errorf("não foi possível ler o arquivo do Insomnia %s: %w", sourceName, err)
	}
	if strings.HasPrefix(document.Type, "mock.") {
		return nil, fmt.Errorf("%s é um servidor mock do Insomnia, que não é suportado", sourceName)
	}

	scope := "collection"
	if strings.HasPrefix(document.Type, "environment.") {
		scope = insomniaEnvironment
	}
	workspaceID := fallbackID(document.Meta.ID, "wrk_imported")
	resources := []insomniaResource{{
		ID:          workspaceID,
		Name:        document.Name,
		Type:        insomniaWorkspace,
		Scope:       scope,
		Description: document.Meta.Description,
	}}
	resources = importer.appendV5Items(resources, document.Collection, workspaceID)

	if base := document.Environments; base != nil {
		baseID := fallbackID(base.Meta.ID, workspaceID+"_environment")
		resources = append(resources, insomniaResource{ID: baseID, Name: base.Name, Type: insomniaEnvironment, Data: base.Data, ParentID: workspaceID})
		for position, subEnvironment := range base.SubEnvironments {
			resources = append(resources, insomniaResource{
				ID:          fallbackID(subEnvironment.Meta.ID, fmt.Sprintf("%s_%d", baseID, position)),
				Name:        subEnvironment.Name,
				Type:        insomniaEnvironment,
				Data:        subEnvironment.Data,
				ParentID:    baseID,
				MetaSortKey: float64(position),
			})
		}
	}
	if jar := document.CookieJar; jar != nil {
		resources = append(resources, insomniaResource{
			ID:       fallbackID(jar.Meta.ID, workspaceID+"_jar"),
			Type:     insomniaCookieJar,
			Cookies:  jar.Cookies,
			ParentID: workspaceID,
		})
	}
	return resources, nil
}

func (importer *insomniaImporter) appendV5Items(resources []insomniaResource, rawItems []json.RawMessage, parentID string) []insomniaResource {
	for position, raw := range rawItems {
		var item insomniaV5Item
		if err := json.Unmarshal(raw, &item); err != nil {
			importer.warnings.add("Alguns recursos do Insomnia tinham formato inválido e foram ignorados")
			continue
		}
		resource := item.insomniaResource
		resource.ID = fallbackID(item.Meta.ID, fmt.Sprintf("%s_%d", parentID, position))
		resource.ParentID = parentID
		resource.Description = item.Meta.Description
		resource.MetaSortKey = float64(position)
		if item.Settings != nil {
			resource.SettingFollowRedirects = item.Settings.FollowRedirects
		}
		if item.Scripts != nil {
			resource.PreRequestScript, resource.AfterResponseScript = item.Scripts.PreRequest, item.Scripts.AfterResponse
		}
		switch {
		case item.Children != nil:
			resource.Type = insomniaFolder
		case strings.HasPrefix(resource.ID, "greq_") || resource.ProtoMethodName != "":
			resource.Type = insomniaGrpcRequest
		case strings.HasPrefix(resource.ID, "ws-req_"):
			resource.Type = insomniaWebSocketRequest
		default:
			resource.Type = insomniaRequest
		}
		resources = append(resources, resource)
		if item.Children != nil {
			resources = importer.appendV5Items(resources, item.Children, resource.ID)
		}
	}
	return resources
}

func (importer *insomniaImporter) index(resources []insomniaResource) {
	importer.resources = resources
	importer.oauthTokens = map[string]string{}
	importer.claimedEnvIDs = map[string]bool{}
	importer.byID = make(map[string]*insomniaResource, len(resources))
	importer.children = map[string][]*insomniaResource{}
	for position := range importer.resources {
		resource := &importer.resources[position]
		importer.byID[resource.ID] = resource
		importer.children[resource.ParentID] = append(importer.children[resource.ParentID], resource)
		if resource.Type == insomniaOAuthToken && resource.AccessToken != "" {
			importer.oauthTokens[resource.ParentID] = resource.AccessToken
		}
	}
	for _, siblings := range importer.children {
		sort.SliceStable(siblings, func(left int, right int) bool { return siblings[left].MetaSortKey < siblings[right].MetaSortKey })
	}
}

func (importer *insomniaImporter) build() *ImportedData {
	imported := &ImportedData{}
	workspaces := importer.ofType(insomniaWorkspace)
	orphanParents := importer.orphanItemParents()
	prefixEnvironments := len(workspaces)+len(orphanParents) > 1

	for _, workspace := range workspaces {
		importer.buildWorkspace(imported, workspace, prefixEnvironments)
	}
	for _, parentID := range orphanParents {
		importer.buildWorkspace(imported, &insomniaResource{ID: parentID, Type: insomniaWorkspace}, prefixEnvironments)
	}
	importer.buildOrphanEnvironments(imported)
	return imported
}

func (importer *insomniaImporter) buildWorkspace(imported *ImportedData, workspace *insomniaResource, prefixEnvironments bool) {
	name := strings.TrimSpace(string(workspace.Name))
	if name == "" {
		name = defaultInsomniaCollectionName
	}
	content := vulpesDtos.CollectionContentDto{
		Auth:        vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone},
		Variables:   []vulpesDtos.VariableDto{},
		Description: string(workspace.Description),
	}

	baseEnvironment := importer.firstChild(workspace.ID, insomniaEnvironment)
	if baseEnvironment != nil {
		importer.claimedEnvIDs[baseEnvironment.ID] = true
		content.Variables = importer.environmentVariables(baseEnvironment.Data)
	}
	content.Items = importer.buildItems(workspace.ID, &content, nil)
	if jar := importer.firstChild(workspace.ID, insomniaCookieJar); jar != nil {
		content.Cookies = importer.parseCookies(jar.Cookies)
	}

	environmentOnly := workspace.Scope == insomniaEnvironment && len(content.Items) == 0
	if environmentOnly && baseEnvironment != nil && len(content.Variables) > 0 {
		imported.Environments = append(imported.Environments, vulpesDtos.EnvironmentInputDto{Name: name, Variables: content.Variables})
	}
	if baseEnvironment != nil {
		for _, subEnvironment := range importer.childrenOfType(baseEnvironment.ID, insomniaEnvironment) {
			environmentName := environmentNameOf(subEnvironment)
			if prefixEnvironments {
				environmentName = name + " - " + environmentName
			}
			imported.Environments = append(imported.Environments, vulpesDtos.EnvironmentInputDto{
				Name:      environmentName,
				Variables: importer.environmentVariables(subEnvironment.Data),
			})
		}
	}
	if environmentOnly {
		return
	}
	NormalizeContent(&content)
	imported.Collections = append(imported.Collections, ImportedCollection{Name: name, Content: content})
}

func (importer *insomniaImporter) buildOrphanEnvironments(imported *ImportedData) {
	for _, environment := range importer.ofType(insomniaEnvironment) {
		parent := importer.byID[environment.ParentID]
		if importer.claimedEnvIDs[environment.ID] || (parent != nil && (parent.Type == insomniaWorkspace || parent.Type == insomniaEnvironment)) {
			continue
		}
		variables := importer.environmentVariables(environment.Data)
		subEnvironments := importer.childrenOfType(environment.ID, insomniaEnvironment)
		if len(variables) > 0 || len(subEnvironments) == 0 {
			imported.Environments = append(imported.Environments, vulpesDtos.EnvironmentInputDto{Name: environmentNameOf(environment), Variables: variables})
		}
		for _, subEnvironment := range subEnvironments {
			imported.Environments = append(imported.Environments, vulpesDtos.EnvironmentInputDto{
				Name:      environmentNameOf(subEnvironment),
				Variables: importer.environmentVariables(subEnvironment.Data),
			})
		}
	}
}

func (importer *insomniaImporter) buildItems(parentID string, content *vulpesDtos.CollectionContentDto, inheritedHeaders []vulpesDtos.KeyValueDto) []vulpesDtos.CollectionItemDto {
	items := []vulpesDtos.CollectionItemDto{}
	for _, resource := range importer.children[parentID] {
		switch resource.Type {
		case insomniaFolder:
			items = append(items, importer.parseFolder(resource, content, inheritedHeaders))
		case insomniaRequest, insomniaGrpcRequest, insomniaWebSocketRequest:
			request := importer.parseRequest(resource, inheritedHeaders)
			items = append(items, vulpesDtos.CollectionItemDto{
				Kind:        vulpesDtos.ItemKindRequest,
				Name:        string(resource.Name),
				Request:     &request,
				Scripts:     importer.parseScripts(resource),
				Description: string(resource.Description),
			})
		default:
			importer.noteSkipped(resource.Type)
		}
	}
	return items
}

func (importer *insomniaImporter) noteSkipped(resourceType string) {
	if message, described := describedInsomniaTypes[resourceType]; described {
		importer.warnings.add(message)
		return
	}
	if !silentInsomniaTypes[resourceType] && resourceType != insomniaWorkspace && resourceType != insomniaWebSocketPayload {
		importer.warnings.add(fmt.Sprintf("Itens do tipo %q do Insomnia não são suportados e foram ignorados", resourceType))
	}
}

func (importer *insomniaImporter) parseFolder(resource *insomniaResource, content *vulpesDtos.CollectionContentDto, inheritedHeaders []vulpesDtos.KeyValueDto) vulpesDtos.CollectionItemDto {
	auth := importer.parseAuth(resource.Authentication, resource.ID)
	if variables := importer.environmentVariables(resource.Environment); len(variables) > 0 {
		content.Variables = append(content.Variables, variables...)
		importer.warnings.add("Variáveis de pastas do Insomnia foram movidas para as variáveis da coleção")
	}
	folderHeaders := mergeHeaders(inheritedHeaders, importer.keyValues(resource.Headers))
	return vulpesDtos.CollectionItemDto{
		Kind:        vulpesDtos.ItemKindFolder,
		Name:        string(resource.Name),
		Auth:        &auth,
		Scripts:     importer.parseScripts(resource),
		Children:    importer.buildItems(resource.ID, content, folderHeaders),
		Description: string(resource.Description),
	}
}

func (importer *insomniaImporter) parseRequest(resource *insomniaResource, inheritedHeaders []vulpesDtos.KeyValueDto) vulpesDtos.RequestDto {
	if request := resource.VulpesRequest; request != nil && sameRequestUrl(protocolUrl(*request), importer.nativeUrl(resource)) {
		embedded := *request
		NormalizeRequest(&embedded)
		return embedded
	}
	switch resource.Type {
	case insomniaGrpcRequest:
		return importer.parseGrpcRequest(resource)
	case insomniaWebSocketRequest:
		return importer.parseWebSocketRequest(resource, inheritedHeaders)
	}

	url, params := importer.urlWithParameters(string(resource.Url), resource.Parameters)
	request := vulpesDtos.RequestDto{
		Auth:     importer.parseAuth(resource.Authentication, resource.ID),
		Protocol: vulpesDtos.ProtocolHttp,
		Http: &vulpesDtos.HttpRequestDto{
			Url:           url,
			Body:          importer.parseBody(resource.Body),
			Method:        resource.Method,
			Params:        params,
			Headers:       mergeHeaders(inheritedHeaders, importer.keyValues(resource.Headers)),
			Settings:      vulpesDtos.HttpSettingsDto{DisableRedirects: resource.SettingFollowRedirects == "off"},
			PathVariables: importer.pathVariables(url, resource.PathParameters),
		},
	}
	NormalizeRequest(&request)
	return request
}

func (importer *insomniaImporter) nativeUrl(resource *insomniaResource) string {
	if resource.Type == insomniaWebSocketRequest {
		url, _ := importer.urlWithParameters(string(resource.Url), resource.Parameters)
		return url
	}
	return importer.template(string(resource.Url))
}

func sameRequestUrl(left string, right string) bool {
	withoutScheme := func(url string) string {
		trimmed := strings.TrimSpace(url)
		for _, scheme := range []string{"grpcs://", "grpc://"} {
			if len(trimmed) >= len(scheme) && strings.EqualFold(trimmed[:len(scheme)], scheme) {
				return trimmed[len(scheme):]
			}
		}
		return trimmed
	}
	return withoutScheme(left) == withoutScheme(right)
}

func (importer *insomniaImporter) parseGrpcRequest(resource *insomniaResource) vulpesDtos.RequestDto {
	request := NewRequest(vulpesDtos.ProtocolGrpc)
	grpcRequest := request.Grpc
	grpcRequest.Url = importer.template(string(resource.Url))
	grpcRequest.Method = strings.TrimPrefix(strings.TrimSpace(resource.ProtoMethodName), "/")
	grpcRequest.Message = "{}"
	grpcRequest.Metadata = importer.keyValues(resource.Metadata)
	var body insomniaBody
	if hasJsonValue(resource.Body) && json.Unmarshal(resource.Body, &body) == nil && strings.TrimSpace(string(body.Text)) != "" {
		grpcRequest.Message = importer.template(string(body.Text))
	}
	if resource.ProtoFileID != "" {
		importer.warnings.add("Requisições gRPC do Insomnia com arquivos .proto foram importadas usando reflection; selecione os arquivos .proto na requisição se o servidor não oferecer reflection")
	}
	return request
}

func (importer *insomniaImporter) parseWebSocketRequest(resource *insomniaResource, inheritedHeaders []vulpesDtos.KeyValueDto) vulpesDtos.RequestDto {
	request := NewRequest(vulpesDtos.ProtocolWebSocket)
	request.Auth = importer.parseAuth(resource.Authentication, resource.ID)
	webSocketRequest := request.WebSocket
	webSocketRequest.Url, webSocketRequest.Params = importer.urlWithParameters(string(resource.Url), resource.Parameters)
	webSocketRequest.Headers = mergeHeaders(inheritedHeaders, importer.keyValues(resource.Headers))
	if payload := importer.firstChild(resource.ID, insomniaWebSocketPayload); payload != nil {
		webSocketRequest.Message = importer.template(string(payload.Value))
		if strings.Contains(strings.ToLower(payload.Mode), "json") {
			webSocketRequest.MessageKind = "json"
		}
	}
	NormalizeRequest(&request)
	return request
}

func (importer *insomniaImporter) urlWithParameters(rawUrl string, parameters []insomniaPair) (string, []vulpesDtos.KeyValueDto) {
	url := importer.template(rawUrl)
	params := parseQueryString(url)
	enabledPairs := []string{}
	for _, parameter := range parameters {
		key := queryComponentEscaper.Replace(importer.template(string(parameter.Name)))
		if strings.TrimSpace(key) == "" {
			continue
		}
		param := vulpesDtos.KeyValueDto{
			Key:         key,
			Value:       queryComponentEscaper.Replace(importer.template(string(parameter.Value))),
			Enabled:     !parameter.Disabled,
			Description: string(parameter.Description),
		}
		params = append(params, param)
		if param.Enabled {
			enabledPairs = append(enabledPairs, queryPair(param.Key, param.Value, true))
		}
	}
	if len(enabledPairs) == 0 {
		return url, params
	}
	separator := "?"
	if strings.Contains(url, "?") {
		separator = "&"
		if strings.HasSuffix(url, "?") || strings.HasSuffix(url, "&") {
			separator = ""
		}
	}
	return url + separator + strings.Join(enabledPairs, "&"), params
}

func (importer *insomniaImporter) pathVariables(url string, parameters []insomniaPair) []vulpesDtos.KeyValueDto {
	known := map[string]insomniaPair{}
	for _, parameter := range parameters {
		known[string(parameter.Name)] = parameter
	}
	variables := []vulpesDtos.KeyValueDto{}
	for _, name := range PathVariableNames(url) {
		parameter := known[name]
		variables = append(variables, vulpesDtos.KeyValueDto{
			Key:         name,
			Value:       importer.template(string(parameter.Value)),
			Enabled:     true,
			Description: string(parameter.Description),
		})
	}
	return variables
}

func (importer *insomniaImporter) keyValues(pairs []insomniaPair) []vulpesDtos.KeyValueDto {
	values := make([]vulpesDtos.KeyValueDto, 0, len(pairs))
	for _, pair := range pairs {
		if pair.Name == "" && pair.Value == "" {
			continue
		}
		values = append(values, vulpesDtos.KeyValueDto{
			Key:         importer.template(string(pair.Name)),
			Value:       importer.template(string(pair.Value)),
			Enabled:     !pair.Disabled,
			Description: string(pair.Description),
		})
	}
	return values
}

func (importer *insomniaImporter) parseBody(raw json.RawMessage) vulpesDtos.HttpBodyDto {
	parsed := vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyNone}
	var body insomniaBody
	if !hasJsonValue(raw) || json.Unmarshal(raw, &body) != nil {
		return parsed
	}

	mimeType, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(body.MimeType)), ";")
	text := importer.template(string(body.Text))
	switch {
	case mimeType == "application/x-www-form-urlencoded":
		parsed.Mode = vulpesDtos.BodyUrlEncoded
		parsed.UrlEncoded = importer.keyValues(body.Params)
	case mimeType == "multipart/form-data":
		parsed.Mode = vulpesDtos.BodyFormData
		for _, param := range body.Params {
			field := vulpesDtos.FormFieldDto{Key: importer.template(string(param.Name)), Kind: "text", Enabled: !param.Disabled}
			if param.Type == "file" {
				field.Kind, field.FilePath = "file", param.FileName
			} else {
				field.Value = importer.template(string(param.Value))
			}
			parsed.FormData = append(parsed.FormData, field)
		}
	case mimeType == "application/graphql":
		parsed.Mode = vulpesDtos.BodyGraphql
		parsed.GraphqlQuery, parsed.GraphqlVariables = graphqlFromText(text)
	case mimeType == "application/octet-stream" || (body.FileName != "" && text == ""):
		parsed.Mode = vulpesDtos.BodyBinary
		parsed.BinaryPath = body.FileName
	case text != "" || mimeType != "":
		parsed.Mode = vulpesDtos.BodyRaw
		parsed.Raw = text
		parsed.Language = rawLanguageForMimeType(mimeType, text)
	}
	return parsed
}

func graphqlFromText(text string) (string, string) {
	var payload struct {
		Query     string          `json:"query"`
		Variables json.RawMessage `json:"variables"`
	}
	if json.Unmarshal([]byte(text), &payload) != nil {
		return text, ""
	}
	if !hasJsonValue(payload.Variables) {
		return payload.Query, ""
	}
	var indented bytes.Buffer
	if json.Indent(&indented, payload.Variables, "", "  ") != nil {
		return payload.Query, string(payload.Variables)
	}
	return payload.Query, indented.String()
}

func rawLanguageForMimeType(mimeType string, text string) string {
	switch {
	case strings.Contains(mimeType, "json"):
		return "json"
	case strings.Contains(mimeType, "xml"):
		return "xml"
	case strings.Contains(mimeType, "html"):
		return "html"
	case strings.Contains(mimeType, "javascript"):
		return "javascript"
	case mimeType == "":
		trimmed := strings.TrimSpace(text)
		if (strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[")) && json.Valid([]byte(trimmed)) {
			return "json"
		}
	}
	return "text"
}

func (importer *insomniaImporter) parseAuth(raw json.RawMessage, ownerID string) vulpesDtos.AuthDto {
	var auth insomniaAuth
	if !hasJsonValue(raw) || json.Unmarshal(raw, &auth) != nil || strings.TrimSpace(auth.Type) == "" {
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthInherit}
	}
	if auth.Disabled {
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
	}

	switch strings.ToLower(auth.Type) {
	case "none":
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
	case "bearer":
		token := importer.template(string(auth.Token))
		prefix := strings.TrimSpace(importer.template(string(auth.Prefix)))
		if prefix == "" || strings.EqualFold(prefix, "Bearer") {
			return vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: token}
		}
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthApiKey, Key: "Authorization", Value: prefix + " " + token, Location: "header"}
	case "basic":
		return vulpesDtos.AuthDto{
			Type:     vulpesDtos.AuthBasic,
			Username: importer.template(string(auth.Username)),
			Password: importer.template(string(auth.Password)),
		}
	case "apikey":
		key, value := importer.template(string(auth.Key)), importer.template(string(auth.Value))
		switch auth.AddTo {
		case "queryParams":
			return vulpesDtos.AuthDto{Type: vulpesDtos.AuthApiKey, Key: key, Value: value, Location: "query"}
		case "cookie":
			return vulpesDtos.AuthDto{Type: vulpesDtos.AuthApiKey, Key: "Cookie", Value: key + "=" + value, Location: "header"}
		}
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthApiKey, Key: key, Value: value, Location: "header"}
	case "oauth2":
		if token := importer.oauthTokens[ownerID]; token != "" {
			importer.warnings.add("Autenticações OAuth 2.0 foram convertidas em Bearer Token com o access token salvo")
			return vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: token}
		}
	}
	importer.warnings.add(fmt.Sprintf("Autenticação do tipo %q não é suportada e foi ignorada", auth.Type))
	return vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
}

func (importer *insomniaImporter) parseScripts(resource *insomniaResource) []vulpesDtos.ScriptDto {
	scripts := []vulpesDtos.ScriptDto{}
	for _, script := range []vulpesDtos.ScriptDto{
		{Listen: "prerequest", Source: resource.PreRequestScript},
		{Listen: "test", Source: resource.AfterResponseScript},
	} {
		if strings.TrimSpace(script.Source) == "" {
			continue
		}
		script.Source = insomniaScriptPattern.ReplaceAllString(script.Source, "pm.")
		scripts = append(scripts, script)
	}
	if len(scripts) > 0 {
		importer.warnings.add("Scripts do Insomnia foram preservados, mas não são executados pelo Vulpes")
	}
	return scripts
}

func (importer *insomniaImporter) parseCookies(cookies []insomniaCookie) []vulpesDtos.CookieDto {
	parsed := make([]vulpesDtos.CookieDto, 0, len(cookies))
	for _, cookie := range cookies {
		expires := ""
		if moment, valid := ParseCookieTime(string(cookie.Expires)); valid {
			expires = FormatCookieTime(moment)
		}
		parsed = append(parsed, vulpesDtos.CookieDto{
			Name:     string(cookie.Key),
			Path:     cookie.Path,
			Value:    string(cookie.Value),
			Domain:   cookie.Domain,
			Secure:   cookie.Secure,
			Expires:  expires,
			HostOnly: cookie.HostOnly,
			HttpOnly: cookie.HttpOnly,
			SameSite: cookie.SameSite,
		})
	}
	return parsed
}

func (importer *insomniaImporter) environmentVariables(raw json.RawMessage) []vulpesDtos.VariableDto {
	variables := []vulpesDtos.VariableDto{}
	if hasJsonValue(raw) {
		importer.flattenObject(raw, "", &variables)
	}
	return variables
}

func (importer *insomniaImporter) flattenObject(raw json.RawMessage, prefix string, variables *[]vulpesDtos.VariableDto) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return
	}
	for decoder.More() {
		keyToken, err := decoder.Token()
		if err != nil {
			return
		}
		key, _ := keyToken.(string)
		var value json.RawMessage
		if decoder.Decode(&value) != nil {
			return
		}
		if trimmed := bytes.TrimSpace(value); len(trimmed) > 0 && trimmed[0] == '{' {
			importer.flattenObject(value, prefix+key+".", variables)
			continue
		}
		*variables = append(*variables, vulpesDtos.VariableDto{Key: prefix + key, Value: importer.template(rawText(value)), Enabled: true})
	}
}

func (importer *insomniaImporter) template(text string) string {
	if !strings.Contains(text, "{{") && !strings.Contains(text, "{%") {
		return text
	}
	converted := insomniaBracketPattern.ReplaceAllString(text, "{{${1}}}")
	converted = insomniaVariablePattern.ReplaceAllString(converted, "{{${1}}}")
	return insomniaTagPattern.ReplaceAllStringFunc(converted, importer.convertTag)
}

func (importer *insomniaImporter) convertTag(tag string) string {
	parts := insomniaTagPattern.FindStringSubmatch(tag)
	name, arguments := parts[1], strings.ToLower(parts[2])
	switch {
	case name == "uuid":
		return "{{$guid}}"
	case name == "now" && strings.Contains(arguments, "iso-8601"):
		return "{{$isoTimestamp}}"
	case name == "now" && strings.Contains(arguments, "unix"):
		return "{{$timestamp}}"
	}
	importer.warnings.add(fmt.Sprintf("Tags de template do Insomnia ({%% %s %%}) não são suportadas e foram mantidas como texto", name))
	return tag
}

func (importer *insomniaImporter) ofType(resourceType string) []*insomniaResource {
	matches := []*insomniaResource{}
	for position := range importer.resources {
		if importer.resources[position].Type == resourceType {
			matches = append(matches, &importer.resources[position])
		}
	}
	return matches
}

func (importer *insomniaImporter) childrenOfType(parentID string, resourceType string) []*insomniaResource {
	matches := []*insomniaResource{}
	for _, child := range importer.children[parentID] {
		if child.Type == resourceType {
			matches = append(matches, child)
		}
	}
	return matches
}

func (importer *insomniaImporter) firstChild(parentID string, resourceType string) *insomniaResource {
	if matches := importer.childrenOfType(parentID, resourceType); len(matches) > 0 {
		return matches[0]
	}
	return nil
}

func (importer *insomniaImporter) orphanItemParents() []string {
	seen := map[string]bool{}
	parents := []string{}
	for _, resource := range importer.resources {
		isItem := resource.Type == insomniaFolder || resource.Type == insomniaRequest || resource.Type == insomniaGrpcRequest || resource.Type == insomniaWebSocketRequest
		if !isItem || importer.byID[resource.ParentID] != nil || seen[resource.ParentID] {
			continue
		}
		seen[resource.ParentID] = true
		parents = append(parents, resource.ParentID)
	}
	return parents
}

func mergeHeaders(inherited []vulpesDtos.KeyValueDto, own []vulpesDtos.KeyValueDto) []vulpesDtos.KeyValueDto {
	merged := []vulpesDtos.KeyValueDto{}
	for _, header := range inherited {
		overridden := false
		for _, ownHeader := range own {
			if strings.EqualFold(ownHeader.Key, header.Key) {
				overridden = true
				break
			}
		}
		if !overridden {
			merged = append(merged, header)
		}
	}
	return append(merged, own...)
}

func environmentNameOf(environment *insomniaResource) string {
	if name := strings.TrimSpace(string(environment.Name)); name != "" {
		return name
	}
	return defaultInsomniaEnvironmentName
}

func fallbackID(identifier string, fallback string) string {
	if strings.TrimSpace(identifier) == "" {
		return fallback
	}
	return identifier
}
