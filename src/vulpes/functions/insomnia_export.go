package vulpesFunctions

import (
	"bytes"
	"encoding/json"
	"regexp"
	"strings"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"

	"github.com/google/uuid"
)

const (
	insomniaExportFormat        = 4
	insomniaExportSource        = "vulpes.devops-hub:v1"
	insomniaBaseEnvironmentName = "Base Environment"
	insomniaBaseEnvironmentID   = "__BASE_ENVIRONMENT_ID__"
)

var (
	postmanScriptPattern      = regexp.MustCompile(`\bpm\.`)
	insomniaIdentifierPattern = regexp.MustCompile(`^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$`)
)

var insomniaDynamicVariables = map[string]string{
	"$guid":         "{% uuid 'v4' %}",
	"$timestamp":    "{% now 'unix', '' %}",
	"$randomUUID":   "{% uuid 'v4' %}",
	"$isoTimestamp": "{% now 'iso-8601', '' %}",
}

var rawLanguageMimeTypes = map[string]string{
	"xml":        "application/xml",
	"text":       "text/plain",
	"html":       "text/html",
	"json":       "application/json",
	"javascript": "application/javascript",
}

type insomniaExportFile struct {
	Type         string `json:"_type"`
	Resources    []any  `json:"resources"`
	ExportDate   string `json:"__export_date"`
	ExportFormat int    `json:"__export_format"`
	ExportSource string `json:"__export_source"`
}

type insomniaExportPair struct {
	Name        string `json:"name"`
	Type        string `json:"type,omitempty"`
	Value       string `json:"value"`
	Disabled    bool   `json:"disabled,omitempty"`
	FileName    string `json:"fileName,omitempty"`
	Description string `json:"description,omitempty"`
}

type insomniaExportBody struct {
	Text     string               `json:"text,omitempty"`
	Params   []insomniaExportPair `json:"params,omitempty"`
	MimeType string               `json:"mimeType,omitempty"`
	FileName string               `json:"fileName,omitempty"`
}

type insomniaExportBase struct {
	ID          string `json:"_id"`
	Type        string `json:"_type"`
	Name        string `json:"name"`
	Created     int64  `json:"created"`
	Modified    int64  `json:"modified"`
	ParentID    any    `json:"parentId"`
	MetaSortKey int64  `json:"metaSortKey"`
}

type insomniaWorkspaceExport struct {
	insomniaExportBase
	Scope       string `json:"scope"`
	Description string `json:"description"`
}

type insomniaEnvironmentExport struct {
	insomniaExportBase
	Data              *orderedMap         `json:"data"`
	Color             *string             `json:"color"`
	IsPrivate         bool                `json:"isPrivate"`
	DataPropertyOrder map[string][]string `json:"dataPropertyOrder"`
}

type insomniaCookieExport struct {
	ID           string `json:"id"`
	Key          string `json:"key"`
	Path         string `json:"path"`
	Value        string `json:"value"`
	Domain       string `json:"domain"`
	Secure       bool   `json:"secure"`
	Expires      string `json:"expires,omitempty"`
	HostOnly     bool   `json:"hostOnly"`
	HttpOnly     bool   `json:"httpOnly"`
	SameSite     string `json:"sameSite,omitempty"`
	Creation     string `json:"creation"`
	LastAccessed string `json:"lastAccessed"`
}

type insomniaCookieJarExport struct {
	insomniaExportBase
	Cookies []insomniaCookieExport `json:"cookies"`
}

type insomniaFolderExport struct {
	insomniaExportBase
	Description              string         `json:"description"`
	Environment              map[string]any `json:"environment"`
	Authentication           map[string]any `json:"authentication,omitempty"`
	PreRequestScript         string         `json:"preRequestScript,omitempty"`
	AfterResponseScript      string         `json:"afterResponseScript,omitempty"`
	EnvironmentPropertyOrder any            `json:"environmentPropertyOrder"`
}

type insomniaRequestExport struct {
	insomniaExportBase
	Url                             string                 `json:"url"`
	Body                            insomniaExportBody     `json:"body"`
	Method                          string                 `json:"method"`
	Headers                         []insomniaExportPair   `json:"headers"`
	IsPrivate                       bool                   `json:"isPrivate"`
	Parameters                      []insomniaExportPair   `json:"parameters"`
	Description                     string                 `json:"description"`
	VulpesRequest                   *vulpesDtos.RequestDto `json:"vulpesRequest,omitempty"`
	PathParameters                  []insomniaExportPair   `json:"pathParameters,omitempty"`
	Authentication                  map[string]any         `json:"authentication"`
	SettingEncodeUrl                bool                   `json:"settingEncodeUrl"`
	PreRequestScript                string                 `json:"preRequestScript,omitempty"`
	SettingSendCookies              bool                   `json:"settingSendCookies"`
	SettingRebuildPath              bool                   `json:"settingRebuildPath"`
	AfterResponseScript             string                 `json:"afterResponseScript,omitempty"`
	SettingStoreCookies             bool                   `json:"settingStoreCookies"`
	SettingFollowRedirects          string                 `json:"settingFollowRedirects"`
	SettingDisableRenderRequestBody bool                   `json:"settingDisableRenderRequestBody"`
}

type insomniaGrpcBody struct {
	Text string `json:"text"`
}

type insomniaGrpcExport struct {
	insomniaExportBase
	Url             string                 `json:"url"`
	Body            insomniaGrpcBody       `json:"body"`
	Metadata        []insomniaExportPair   `json:"metadata"`
	IsPrivate       bool                   `json:"isPrivate"`
	Description     string                 `json:"description"`
	ProtoFileID     string                 `json:"protoFileId"`
	VulpesRequest   *vulpesDtos.RequestDto `json:"vulpesRequest,omitempty"`
	ProtoMethodName string                 `json:"protoMethodName"`
}

type insomniaWebSocketExport struct {
	insomniaExportBase
	Url                    string                 `json:"url"`
	Headers                []insomniaExportPair   `json:"headers"`
	IsPrivate              bool                   `json:"isPrivate"`
	Parameters             []insomniaExportPair   `json:"parameters"`
	Description            string                 `json:"description"`
	VulpesRequest          *vulpesDtos.RequestDto `json:"vulpesRequest,omitempty"`
	Authentication         map[string]any         `json:"authentication"`
	SettingEncodeUrl       bool                   `json:"settingEncodeUrl"`
	SettingSendCookies     bool                   `json:"settingSendCookies"`
	SettingStoreCookies    bool                   `json:"settingStoreCookies"`
	SettingFollowRedirects string                 `json:"settingFollowRedirects"`
}

type insomniaWebSocketPayloadExport struct {
	insomniaExportBase
	Mode  string `json:"mode"`
	Value string `json:"value"`
}

type orderedMap struct {
	keys   []string
	values map[string]any
}

func newOrderedMap() *orderedMap {
	return &orderedMap{values: map[string]any{}}
}

func (object *orderedMap) set(key string, value any) {
	if _, exists := object.values[key]; !exists {
		object.keys = append(object.keys, key)
	}
	object.values[key] = value
}

func (object *orderedMap) MarshalJSON() ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteByte('{')
	for position, key := range object.keys {
		if position > 0 {
			buffer.WriteByte(',')
		}
		encodedKey, err := json.Marshal(key)
		if err != nil {
			return nil, err
		}
		encodedValue, err := json.Marshal(object.values[key])
		if err != nil {
			return nil, err
		}
		buffer.Write(encodedKey)
		buffer.WriteByte(':')
		buffer.Write(encodedValue)
	}
	buffer.WriteByte('}')
	return buffer.Bytes(), nil
}

type insomniaExporter struct {
	now       time.Time
	warnings  *warningCollector
	resources []any
	sortKey   int64
}

func ExportInsomniaCollection(name string, content vulpesDtos.CollectionContentDto) ([]byte, []string, error) {
	exporter := newInsomniaExporter()
	workspaceID := insomniaID("wrk")
	exporter.append(insomniaWorkspaceExport{
		insomniaExportBase: exporter.base(workspaceID, "workspace", name, nil),
		Scope:              "collection",
		Description:        content.Description,
	})
	exporter.append(exporter.environment(insomniaID("env"), workspaceID, insomniaBaseEnvironmentName, content.Variables))
	exporter.append(insomniaCookieJarExport{
		insomniaExportBase: exporter.base(insomniaID("jar"), "cookie_jar", "Default Jar", workspaceID),
		Cookies:            exporter.cookies(content.Cookies),
	})

	if len(content.Scripts) > 0 {
		exporter.warnings.add("Scripts definidos na coleção não são suportados pelo Insomnia e ficaram de fora")
	}
	exporter.items(content.Items, workspaceID, &content.Auth)
	return exporter.encode()
}

func ExportInsomniaEnvironment(name string, variables []vulpesDtos.VariableDto) ([]byte, []string, error) {
	exporter := newInsomniaExporter()
	exporter.append(exporter.environment(insomniaID("env"), insomniaBaseEnvironmentID, name, variables))
	return exporter.encode()
}

func newInsomniaExporter() *insomniaExporter {
	return &insomniaExporter{now: time.Now(), warnings: newWarningCollector()}
}

func (exporter *insomniaExporter) append(resource any) {
	exporter.resources = append(exporter.resources, resource)
}

func (exporter *insomniaExporter) encode() ([]byte, []string, error) {
	exported, err := json.MarshalIndent(insomniaExportFile{
		Type:         "export",
		Resources:    exporter.resources,
		ExportDate:   exporter.now.UTC().Format("2006-01-02T15:04:05.000Z"),
		ExportFormat: insomniaExportFormat,
		ExportSource: insomniaExportSource,
	}, "", "\t")
	if err != nil {
		return nil, nil, err
	}
	return exported, exporter.warnings.list(), nil
}

func (exporter *insomniaExporter) base(identifier string, resourceType string, name string, parentID any) insomniaExportBase {
	exporter.sortKey += 100
	timestamp := exporter.now.UnixMilli()
	return insomniaExportBase{
		ID:          identifier,
		Type:        resourceType,
		Name:        name,
		Created:     timestamp,
		Modified:    timestamp,
		ParentID:    parentID,
		MetaSortKey: exporter.sortKey,
	}
}

func (exporter *insomniaExporter) environment(identifier string, parentID string, name string, variables []vulpesDtos.VariableDto) insomniaEnvironmentExport {
	data := newOrderedMap()
	for _, variable := range variables {
		if variable.Enabled && variable.Key != "" {
			placeEnvironmentValue(data, variable.Key, exporter.template(variable.Value))
		}
	}
	return insomniaEnvironmentExport{
		insomniaExportBase: exporter.base(identifier, "environment", name, parentID),
		Data:               data,
		DataPropertyOrder:  propertyOrder(data, "&", map[string][]string{}),
	}
}

func placeEnvironmentValue(data *orderedMap, key string, value string) {
	segments := strings.Split(key, ".")
	target := data
	for _, segment := range segments[:len(segments)-1] {
		existing, found := target.values[segment]
		nested, isObject := existing.(*orderedMap)
		if (found && !isObject) || segment == "" {
			data.set(key, value)
			return
		}
		if !found {
			nested = newOrderedMap()
			target.set(segment, nested)
		}
		target = nested
	}
	leaf := segments[len(segments)-1]
	if _, isObject := target.values[leaf].(*orderedMap); isObject || leaf == "" {
		data.set(key, value)
		return
	}
	target.set(leaf, value)
}

func propertyOrder(object *orderedMap, path string, order map[string][]string) map[string][]string {
	order[path] = append([]string{}, object.keys...)
	for _, key := range object.keys {
		if nested, isObject := object.values[key].(*orderedMap); isObject {
			propertyOrder(nested, path+"~|"+key, order)
		}
	}
	return order
}

func (exporter *insomniaExporter) cookies(cookies []vulpesDtos.CookieDto) []insomniaCookieExport {
	timestamp := FormatCookieTime(exporter.now)
	exported := make([]insomniaCookieExport, 0, len(cookies))
	for _, cookie := range cookies {
		exported = append(exported, insomniaCookieExport{
			ID:           uuid.NewString(),
			Key:          cookie.Name,
			Path:         cookie.Path,
			Value:        cookie.Value,
			Domain:       cookie.Domain,
			Secure:       cookie.Secure,
			Expires:      cookie.Expires,
			HostOnly:     cookie.HostOnly,
			HttpOnly:     cookie.HttpOnly,
			SameSite:     strings.ToLower(cookie.SameSite),
			Creation:     timestamp,
			LastAccessed: timestamp,
		})
	}
	return exported
}

func (exporter *insomniaExporter) items(items []vulpesDtos.CollectionItemDto, parentID string, inheritedAuth *vulpesDtos.AuthDto) {
	for _, item := range items {
		if item.Kind == vulpesDtos.ItemKindFolder {
			exporter.folder(item, parentID, inheritedAuth)
			continue
		}
		if item.Request != nil {
			exporter.request(item, parentID, inheritedAuth)
		}
	}
}

func (exporter *insomniaExporter) folder(item vulpesDtos.CollectionItemDto, parentID string, inheritedAuth *vulpesDtos.AuthDto) {
	folderID := insomniaID("fld")
	auth := vulpesDtos.AuthDto{Type: vulpesDtos.AuthInherit}
	if item.Auth != nil {
		auth = *item.Auth
	}
	preRequest, afterResponse := exporter.scripts(item.Scripts)
	exporter.append(insomniaFolderExport{
		insomniaExportBase:  exporter.base(folderID, "request_group", item.Name, parentID),
		Description:         item.Description,
		Environment:         map[string]any{},
		Authentication:      exporter.authentication(auth, inheritedAuth),
		PreRequestScript:    preRequest,
		AfterResponseScript: afterResponse,
	})
	exporter.items(item.Children, folderID, nil)
}

func (exporter *insomniaExporter) request(item vulpesDtos.CollectionItemDto, parentID string, inheritedAuth *vulpesDtos.AuthDto) {
	request := *item.Request
	switch {
	case request.Protocol == vulpesDtos.ProtocolHttp && request.Http != nil:
		exporter.httpRequest(item, request, parentID, inheritedAuth)
	case request.Protocol == vulpesDtos.ProtocolGrpc && request.Grpc != nil:
		exporter.grpcRequest(item, request, parentID)
	case request.Protocol == vulpesDtos.ProtocolWebSocket && request.WebSocket != nil:
		exporter.webSocketRequest(item, request, parentID, inheritedAuth)
	default:
		exporter.warnings.add("Requisições Socket.IO não são suportadas pelo Insomnia e foram exportadas como requisições GET com a URL")
		exporter.append(insomniaRequestExport{
			insomniaExportBase:     exporter.base(insomniaID("req"), "request", item.Name, parentID),
			Url:                    protocolUrl(request),
			Method:                 "GET",
			Headers:                []insomniaExportPair{},
			Parameters:             []insomniaExportPair{},
			Description:            item.Description,
			VulpesRequest:          &request,
			Authentication:         map[string]any{},
			SettingEncodeUrl:       true,
			SettingSendCookies:     true,
			SettingRebuildPath:     true,
			SettingStoreCookies:    true,
			SettingFollowRedirects: "global",
		})
	}
}

func (exporter *insomniaExporter) httpRequest(item vulpesDtos.CollectionItemDto, request vulpesDtos.RequestDto, parentID string, inheritedAuth *vulpesDtos.AuthDto) {
	httpRequest := request.Http
	url, parameters := exporter.splitUrl(httpRequest.Url, httpRequest.Params)
	headers := exporter.pairs(httpRequest.Headers)
	body := exporter.body(httpRequest.Body)
	if body.MimeType != "" && !hasHeader(httpRequest.Headers, "Content-Type") {
		headers = append(headers, insomniaExportPair{Name: "Content-Type", Value: body.MimeType})
	}
	followRedirects := "global"
	if httpRequest.Settings.DisableRedirects {
		followRedirects = "off"
	}
	if httpRequest.Settings.SkipTlsVerify || httpRequest.Settings.TimeoutMs > 0 {
		exporter.warnings.add("Tempo limite e verificação de certificado TLS por requisição não existem no Insomnia; ajuste-os nas preferências do Insomnia")
	}
	preRequest, afterResponse := exporter.scripts(item.Scripts)
	exporter.append(insomniaRequestExport{
		insomniaExportBase:     exporter.base(insomniaID("req"), "request", item.Name, parentID),
		Url:                    url,
		Body:                   body,
		Method:                 httpRequest.Method,
		Headers:                headers,
		Parameters:             parameters,
		Description:            item.Description,
		PathParameters:         exporter.pathParameters(httpRequest.PathVariables),
		Authentication:         exporter.authentication(request.Auth, inheritedAuth),
		SettingEncodeUrl:       true,
		PreRequestScript:       preRequest,
		SettingSendCookies:     true,
		SettingRebuildPath:     true,
		AfterResponseScript:    afterResponse,
		SettingStoreCookies:    true,
		SettingFollowRedirects: followRedirects,
	})
}

func (exporter *insomniaExporter) grpcRequest(item vulpesDtos.CollectionItemDto, request vulpesDtos.RequestDto, parentID string) {
	grpcRequest := request.Grpc
	url := exporter.template(grpcRequest.Url)
	if grpcRequest.UseTls && !HasScheme(url) {
		url = "grpcs://" + url
	}
	if grpcRequest.DescriptorSource == vulpesDtos.DescriptorProtoFiles {
		exporter.warnings.add("Requisições gRPC com arquivos .proto foram exportadas usando reflection; importe os arquivos .proto pelo Insomnia se o servidor não oferecer reflection")
	}
	methodName := ""
	if method := strings.TrimPrefix(strings.TrimSpace(grpcRequest.Method), "/"); method != "" {
		methodName = "/" + method
	}
	exporter.append(insomniaGrpcExport{
		insomniaExportBase: exporter.base(insomniaID("greq"), "grpc_request", item.Name, parentID),
		Url:                url,
		Body:               insomniaGrpcBody{Text: exporter.template(grpcRequest.Message)},
		Metadata:           exporter.pairs(grpcRequest.Metadata),
		Description:        item.Description,
		VulpesRequest:      &request,
		ProtoMethodName:    methodName,
	})
}

func (exporter *insomniaExporter) webSocketRequest(item vulpesDtos.CollectionItemDto, request vulpesDtos.RequestDto, parentID string, inheritedAuth *vulpesDtos.AuthDto) {
	webSocketRequest := request.WebSocket
	requestID := insomniaID("ws-req")
	url, parameters := exporter.splitUrl(webSocketRequest.Url, webSocketRequest.Params)
	exporter.append(insomniaWebSocketExport{
		insomniaExportBase:     exporter.base(requestID, "websocket_request", item.Name, parentID),
		Url:                    url,
		Headers:                exporter.pairs(webSocketRequest.Headers),
		Parameters:             parameters,
		Description:            item.Description,
		VulpesRequest:          &request,
		Authentication:         exporter.authentication(request.Auth, inheritedAuth),
		SettingEncodeUrl:       true,
		SettingSendCookies:     true,
		SettingStoreCookies:    true,
		SettingFollowRedirects: "global",
	})
	if strings.TrimSpace(webSocketRequest.Message) == "" {
		return
	}
	mode := "text/plain"
	if webSocketRequest.MessageKind == "json" {
		mode = "application/json"
	}
	exporter.append(insomniaWebSocketPayloadExport{
		insomniaExportBase: exporter.base(insomniaID("ws-payload"), "websocket_payload", "Mensagem", requestID),
		Mode:               mode,
		Value:              exporter.template(webSocketRequest.Message),
	})
}

func (exporter *insomniaExporter) splitUrl(rawUrl string, params []vulpesDtos.KeyValueDto) (string, []insomniaExportPair) {
	base, query, _ := strings.Cut(rawUrl, "?")
	descriptions := map[string]string{}
	for _, param := range params {
		if param.Enabled {
			descriptions[param.Key] = param.Description
		}
	}
	parameters := []insomniaExportPair{}
	for _, param := range parseQueryString("?" + query) {
		parameters = append(parameters, insomniaExportPair{
			Name:        exporter.template(param.Key),
			Value:       exporter.template(param.Value),
			Description: descriptions[param.Key],
		})
	}
	for _, param := range params {
		if !param.Enabled && param.Key != "" {
			parameters = append(parameters, insomniaExportPair{
				Name:        exporter.template(param.Key),
				Value:       exporter.template(param.Value),
				Disabled:    true,
				Description: param.Description,
			})
		}
	}
	return exporter.template(base), parameters
}

func (exporter *insomniaExporter) pairs(values []vulpesDtos.KeyValueDto) []insomniaExportPair {
	pairs := make([]insomniaExportPair, 0, len(values))
	for _, entry := range values {
		if entry.Key == "" && entry.Value == "" {
			continue
		}
		pairs = append(pairs, insomniaExportPair{
			Name:        exporter.template(entry.Key),
			Value:       exporter.template(entry.Value),
			Disabled:    !entry.Enabled,
			Description: entry.Description,
		})
	}
	return pairs
}

func (exporter *insomniaExporter) pathParameters(variables []vulpesDtos.KeyValueDto) []insomniaExportPair {
	parameters := make([]insomniaExportPair, 0, len(variables))
	for _, variable := range variables {
		parameters = append(parameters, insomniaExportPair{
			Name:        variable.Key,
			Value:       exporter.template(variable.Value),
			Description: variable.Description,
		})
	}
	return parameters
}

func (exporter *insomniaExporter) body(body vulpesDtos.HttpBodyDto) insomniaExportBody {
	switch body.Mode {
	case vulpesDtos.BodyRaw:
		mimeType := rawLanguageMimeTypes[body.Language]
		if mimeType == "" {
			mimeType = "text/plain"
		}
		return insomniaExportBody{Text: exporter.template(body.Raw), MimeType: mimeType}
	case vulpesDtos.BodyUrlEncoded:
		return insomniaExportBody{Params: exporter.pairs(body.UrlEncoded), MimeType: "application/x-www-form-urlencoded"}
	case vulpesDtos.BodyBinary:
		return insomniaExportBody{MimeType: "application/octet-stream", FileName: body.BinaryPath}
	case vulpesDtos.BodyGraphql:
		return insomniaExportBody{Text: exporter.graphqlText(body), MimeType: "application/graphql"}
	case vulpesDtos.BodyFormData:
		params := make([]insomniaExportPair, 0, len(body.FormData))
		for _, field := range body.FormData {
			param := insomniaExportPair{Name: exporter.template(field.Key), Type: "text", Value: exporter.template(field.Value), Disabled: !field.Enabled}
			if field.Kind == "file" {
				param = insomniaExportPair{Name: exporter.template(field.Key), Type: "file", FileName: field.FilePath, Disabled: !field.Enabled}
			}
			params = append(params, param)
		}
		return insomniaExportBody{Params: params, MimeType: "multipart/form-data"}
	}
	return insomniaExportBody{}
}

func (exporter *insomniaExporter) graphqlText(body vulpesDtos.HttpBodyDto) string {
	payload := newOrderedMap()
	payload.set("query", exporter.template(body.GraphqlQuery))
	if variables := strings.TrimSpace(body.GraphqlVariables); variables != "" {
		if json.Valid([]byte(variables)) {
			payload.set("variables", json.RawMessage(variables))
		} else {
			payload.set("variables", exporter.template(variables))
		}
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func (exporter *insomniaExporter) authentication(auth vulpesDtos.AuthDto, inheritedAuth *vulpesDtos.AuthDto) map[string]any {
	if auth.Type == vulpesDtos.AuthInherit && inheritedAuth != nil {
		auth = *inheritedAuth
	}
	switch auth.Type {
	case vulpesDtos.AuthNone:
		return map[string]any{"type": "none"}
	case vulpesDtos.AuthBearer:
		return map[string]any{"type": "bearer", "token": exporter.template(auth.Token), "prefix": "", "disabled": false}
	case vulpesDtos.AuthBasic:
		return map[string]any{
			"type":        "basic",
			"username":    exporter.template(auth.Username),
			"password":    exporter.template(auth.Password),
			"disabled":    false,
			"useISO88591": false,
		}
	case vulpesDtos.AuthApiKey:
		addTo := "header"
		if auth.Location == "query" {
			addTo = "queryParams"
		}
		return map[string]any{"type": "apikey", "key": exporter.template(auth.Key), "value": exporter.template(auth.Value), "addTo": addTo, "disabled": false}
	}
	return map[string]any{}
}

func (exporter *insomniaExporter) scripts(scripts []vulpesDtos.ScriptDto) (string, string) {
	var preRequest, afterResponse []string
	for _, script := range scripts {
		source := postmanScriptPattern.ReplaceAllString(script.Source, "insomnia.")
		switch script.Listen {
		case "prerequest":
			preRequest = append(preRequest, source)
		case "test":
			afterResponse = append(afterResponse, source)
		}
	}
	if len(preRequest)+len(afterResponse) > 0 {
		exporter.warnings.add("Scripts foram exportados como texto; revise-os no Insomnia, pois a API de scripts pode ser diferente")
	}
	return strings.Join(preRequest, "\n\n"), strings.Join(afterResponse, "\n\n")
}

func (exporter *insomniaExporter) template(text string) string {
	if !strings.Contains(text, "{{") {
		return text
	}
	return variablePattern.ReplaceAllStringFunc(text, func(match string) string {
		name := strings.TrimSpace(match[2 : len(match)-2])
		if tag, isDynamic := insomniaDynamicVariables[name]; isDynamic {
			return tag
		}
		if strings.HasPrefix(name, "$") {
			return match
		}
		if insomniaIdentifierPattern.MatchString(name) {
			return "{{ _." + name + " }}"
		}
		return "{{ _['" + strings.ReplaceAll(name, "'", `\'`) + "'] }}"
	})
}

func hasHeader(headers []vulpesDtos.KeyValueDto, key string) bool {
	for _, header := range headers {
		if header.Enabled && strings.EqualFold(strings.TrimSpace(header.Key), key) {
			return true
		}
	}
	return false
}

func insomniaID(prefix string) string {
	return prefix + "_" + strings.ReplaceAll(uuid.NewString(), "-", "")
}
