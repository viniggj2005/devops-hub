package vulpesFunctions

import (
	"encoding/json"
	"strings"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"

	"github.com/google/uuid"
)

const PostmanCollectionSchema = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"

type exportEntry struct {
	Key         string `json:"key"`
	Src         string `json:"src,omitempty"`
	Type        string `json:"type,omitempty"`
	Value       string `json:"value"`
	Disabled    bool   `json:"disabled,omitempty"`
	ContentType string `json:"contentType,omitempty"`
	Description string `json:"description,omitempty"`
}

type exportScript struct {
	Type string   `json:"type"`
	Exec []string `json:"exec"`
}

type exportEvent struct {
	Listen string       `json:"listen"`
	Script exportScript `json:"script"`
}

type exportUrl struct {
	Raw      string        `json:"raw"`
	Host     []string      `json:"host,omitempty"`
	Path     []string      `json:"path,omitempty"`
	Port     string        `json:"port,omitempty"`
	Query    []exportEntry `json:"query,omitempty"`
	Protocol string        `json:"protocol,omitempty"`
	Variable []exportEntry `json:"variable,omitempty"`
}

type exportFile struct {
	Src string `json:"src"`
}

type exportGraphql struct {
	Query     string `json:"query"`
	Variables string `json:"variables"`
}

type exportRawOptions struct {
	Language string `json:"language"`
}

type exportBodyOptions struct {
	Raw exportRawOptions `json:"raw"`
}

type exportBody struct {
	Raw        string             `json:"raw,omitempty"`
	Mode       string             `json:"mode"`
	File       *exportFile        `json:"file,omitempty"`
	Graphql    *exportGraphql     `json:"graphql,omitempty"`
	Options    *exportBodyOptions `json:"options,omitempty"`
	Formdata   []exportEntry      `json:"formdata,omitempty"`
	Urlencoded []exportEntry      `json:"urlencoded,omitempty"`
}

type exportRequest struct {
	Url         exportUrl      `json:"url"`
	Auth        map[string]any `json:"auth,omitempty"`
	Body        *exportBody    `json:"body,omitempty"`
	Method      string         `json:"method"`
	Header      []exportEntry  `json:"header"`
	Description string         `json:"description,omitempty"`
}

type exportItem struct {
	Name                    string                 `json:"name"`
	Item                    *[]exportItem          `json:"item,omitempty"`
	Auth                    map[string]any         `json:"auth,omitempty"`
	Event                   []exportEvent          `json:"event,omitempty"`
	Request                 *exportRequest         `json:"request,omitempty"`
	Description             string                 `json:"description,omitempty"`
	VulpesRequest           *vulpesDtos.RequestDto `json:"vulpesRequest,omitempty"`
	ProtocolProfileBehavior map[string]bool        `json:"protocolProfileBehavior,omitempty"`
}

type exportInfo struct {
	Name        string `json:"name"`
	Schema      string `json:"schema"`
	PostmanID   string `json:"_postman_id"`
	Description string `json:"description,omitempty"`
}

type exportCollection struct {
	Info          exportInfo             `json:"info"`
	Item          []exportItem           `json:"item"`
	Auth          map[string]any         `json:"auth,omitempty"`
	Event         []exportEvent          `json:"event,omitempty"`
	Variable      []exportEntry          `json:"variable,omitempty"`
	VulpesCookies []vulpesDtos.CookieDto `json:"vulpesCookies,omitempty"`
}

type exportEnvironmentValue struct {
	Key     string `json:"key"`
	Type    string `json:"type"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type exportEnvironment struct {
	ID            string                   `json:"id"`
	Name          string                   `json:"name"`
	Values        []exportEnvironmentValue `json:"values"`
	Scope         string                   `json:"_postman_variable_scope"`
	ExportedAt    string                   `json:"_postman_exported_at"`
	ExportedUsing string                   `json:"_postman_exported_using"`
}

func ExportPostmanCollection(name string, content vulpesDtos.CollectionContentDto) ([]byte, error) {
	collection := exportCollection{
		Info: exportInfo{
			Name:        name,
			Schema:      PostmanCollectionSchema,
			PostmanID:   uuid.NewString(),
			Description: content.Description,
		},
		Item:          exportItems(content.Items),
		Auth:          exportAuth(content.Auth),
		Event:         exportEvents(content.Scripts),
		VulpesCookies: content.Cookies,
	}
	for _, variable := range content.Variables {
		collection.Variable = append(collection.Variable, exportEntry{
			Key:      variable.Key,
			Type:     "string",
			Value:    variable.Value,
			Disabled: !variable.Enabled,
		})
	}
	return json.MarshalIndent(collection, "", "\t")
}

func ExportPostmanEnvironment(name string, variables []vulpesDtos.VariableDto) ([]byte, error) {
	environment := exportEnvironment{
		ID:            uuid.NewString(),
		Name:          name,
		Values:        make([]exportEnvironmentValue, 0, len(variables)),
		Scope:         "environment",
		ExportedAt:    time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		ExportedUsing: DefaultUserAgent,
	}
	for _, variable := range variables {
		variableType := "default"
		if variable.Secret {
			variableType = "secret"
		}
		environment.Values = append(environment.Values, exportEnvironmentValue{
			Key:     variable.Key,
			Type:    variableType,
			Value:   variable.Value,
			Enabled: variable.Enabled,
		})
	}
	return json.MarshalIndent(environment, "", "\t")
}

func exportItems(items []vulpesDtos.CollectionItemDto) []exportItem {
	exported := make([]exportItem, 0, len(items))
	for _, item := range items {
		exported = append(exported, exportCollectionItem(item))
	}
	return exported
}

func exportCollectionItem(item vulpesDtos.CollectionItemDto) exportItem {
	exported := exportItem{
		Name:        item.Name,
		Event:       exportEvents(item.Scripts),
		Description: item.Description,
	}
	if item.Kind == vulpesDtos.ItemKindFolder {
		children := exportItems(item.Children)
		exported.Item = &children
		if item.Auth != nil {
			exported.Auth = exportAuth(*item.Auth)
		}
		return exported
	}
	if item.Request == nil {
		return exported
	}

	if item.Request.Protocol != vulpesDtos.ProtocolHttp || item.Request.Http == nil {
		request := *item.Request
		exported.VulpesRequest = &request
		exported.Request = &exportRequest{
			Url:    exportUrl{Raw: protocolUrl(request)},
			Method: "GET",
			Header: []exportEntry{},
		}
		return exported
	}

	httpRequest := item.Request.Http
	exported.Request = &exportRequest{
		Url:    exportHttpUrl(*httpRequest),
		Auth:   exportAuth(item.Request.Auth),
		Body:   exportHttpBody(httpRequest.Body),
		Method: httpRequest.Method,
		Header: exportKeyValues(httpRequest.Headers),
	}
	behavior := map[string]bool{}
	if httpRequest.Settings.DisableRedirects {
		behavior["followRedirects"] = false
	}
	if httpRequest.Settings.SkipTlsVerify {
		behavior["strictSSL"] = false
	}
	if len(behavior) > 0 {
		exported.ProtocolProfileBehavior = behavior
	}
	return exported
}

func protocolUrl(request vulpesDtos.RequestDto) string {
	switch {
	case request.Grpc != nil:
		return request.Grpc.Url
	case request.SocketIo != nil:
		return request.SocketIo.Url
	case request.WebSocket != nil:
		return request.WebSocket.Url
	}
	return ""
}

func exportHttpUrl(httpRequest vulpesDtos.HttpRequestDto) exportUrl {
	exported := exportUrl{Raw: httpRequest.Url}
	base, _, _ := strings.Cut(httpRequest.Url, "?")
	if schemeEnd := strings.Index(base, "://"); schemeEnd >= 0 {
		exported.Protocol = base[:schemeEnd]
		base = base[schemeEnd+3:]
	}

	authority, path, hasPath := strings.Cut(base, "/")
	if portStart := strings.LastIndex(authority, ":"); portStart >= 0 && isNumeric(authority[portStart+1:]) {
		exported.Port = authority[portStart+1:]
		authority = authority[:portStart]
	}
	if authority != "" {
		if strings.Contains(authority, "{{") {
			exported.Host = []string{authority}
		} else {
			exported.Host = strings.Split(authority, ".")
		}
	}
	if hasPath {
		exported.Path = strings.Split(path, "/")
	}

	for _, param := range httpRequest.Params {
		exported.Query = append(exported.Query, exportEntry{
			Key:         param.Key,
			Value:       param.Value,
			Disabled:    !param.Enabled,
			Description: param.Description,
		})
	}
	for _, variable := range httpRequest.PathVariables {
		exported.Variable = append(exported.Variable, exportEntry{
			Key:         variable.Key,
			Value:       variable.Value,
			Description: variable.Description,
		})
	}
	return exported
}

func exportHttpBody(body vulpesDtos.HttpBodyDto) *exportBody {
	switch body.Mode {
	case vulpesDtos.BodyRaw:
		return &exportBody{Raw: body.Raw, Mode: "raw", Options: &exportBodyOptions{Raw: exportRawOptions{Language: body.Language}}}
	case vulpesDtos.BodyUrlEncoded:
		return &exportBody{Mode: "urlencoded", Urlencoded: exportKeyValues(body.UrlEncoded)}
	case vulpesDtos.BodyBinary:
		return &exportBody{Mode: "file", File: &exportFile{Src: body.BinaryPath}}
	case vulpesDtos.BodyGraphql:
		return &exportBody{Mode: "graphql", Graphql: &exportGraphql{Query: body.GraphqlQuery, Variables: body.GraphqlVariables}}
	case vulpesDtos.BodyFormData:
		fields := make([]exportEntry, 0, len(body.FormData))
		for _, field := range body.FormData {
			entry := exportEntry{Key: field.Key, Type: "text", Value: field.Value, Disabled: !field.Enabled, ContentType: field.ContentType}
			if field.Kind == "file" {
				entry = exportEntry{Key: field.Key, Src: field.FilePath, Type: "file", Disabled: !field.Enabled, ContentType: field.ContentType}
			}
			fields = append(fields, entry)
		}
		return &exportBody{Mode: "formdata", Formdata: fields}
	}
	return nil
}

func exportKeyValues(values []vulpesDtos.KeyValueDto) []exportEntry {
	exported := make([]exportEntry, 0, len(values))
	for _, entry := range values {
		exported = append(exported, exportEntry{
			Key:         entry.Key,
			Type:        "text",
			Value:       entry.Value,
			Disabled:    !entry.Enabled,
			Description: entry.Description,
		})
	}
	return exported
}

func exportAuth(auth vulpesDtos.AuthDto) map[string]any {
	stringEntry := func(key string, value string) exportEntry {
		return exportEntry{Key: key, Type: "string", Value: value}
	}
	switch auth.Type {
	case vulpesDtos.AuthNone:
		return map[string]any{"type": "noauth"}
	case vulpesDtos.AuthBearer:
		return map[string]any{"type": "bearer", "bearer": []exportEntry{stringEntry("token", auth.Token)}}
	case vulpesDtos.AuthBasic:
		return map[string]any{"type": "basic", "basic": []exportEntry{
			stringEntry("username", auth.Username),
			stringEntry("password", auth.Password),
		}}
	case vulpesDtos.AuthApiKey:
		return map[string]any{"type": "apikey", "apikey": []exportEntry{
			stringEntry("key", auth.Key),
			stringEntry("value", auth.Value),
			stringEntry("in", auth.Location),
		}}
	}
	return nil
}

func exportEvents(scripts []vulpesDtos.ScriptDto) []exportEvent {
	events := make([]exportEvent, 0, len(scripts))
	for _, script := range scripts {
		events = append(events, exportEvent{
			Listen: script.Listen,
			Script: exportScript{Type: "text/javascript", Exec: strings.Split(script.Source, "\n")},
		})
	}
	return events
}

func isNumeric(text string) bool {
	if text == "" {
		return false
	}
	for _, character := range text {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}
