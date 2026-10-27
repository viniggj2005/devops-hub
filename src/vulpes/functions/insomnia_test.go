package vulpesFunctions

import (
	"encoding/json"
	"strings"
	"testing"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const insomniaV4Sample = `{
	"_type": "export",
	"__export_format": 4,
	"__export_source": "insomnia.desktop.app:v2023.5.8",
	"resources": [
		{"_id": "req_list", "_type": "request", "parentId": "fld_users", "name": "Listar", "metaSortKey": -10,
			"url": "{{ _.baseUrl }}/users/:id", "method": "GET", "body": {},
			"parameters": [{"name": "page", "value": "1"}, {"name": "debug", "value": "a&b", "disabled": true}],
			"pathParameters": [{"name": "id", "value": "{{ _.userId }}"}],
			"headers": [{"name": "Accept", "value": "application/json"}, {"name": "X-Off", "value": "1", "disabled": true}],
			"authentication": {}, "settingFollowRedirects": "off", "description": "Lista usuários",
			"preRequestScript": "insomnia.environment.set('a', 1)"},
		{"_id": "wrk_api", "_type": "workspace", "parentId": null, "name": "Loja", "description": "API da loja", "scope": "collection"},
		{"_id": "env_base", "_type": "environment", "parentId": "wrk_api", "name": "Base Environment",
			"data": {"baseUrl": "https://loja.dev", "auth": {"token": "abc", "ttl": 30}}},
		{"_id": "env_prod", "_type": "environment", "parentId": "env_base", "name": "Produção", "data": {"baseUrl": "https://prod.loja.dev"}},
		{"_id": "jar_api", "_type": "cookie_jar", "parentId": "wrk_api", "name": "Default Jar", "cookies": [
			{"key": "session", "value": "s1", "domain": "loja.dev", "path": "/", "hostOnly": true, "httpOnly": true, "expires": "2099-01-01T00:00:00.000Z"},
			{"key": "old", "value": "x", "domain": "loja.dev", "path": "/", "expires": "2001-01-01T00:00:00.000Z"}
		]},
		{"_id": "fld_users", "_type": "request_group", "parentId": "wrk_api", "name": "Usuários", "metaSortKey": -20,
			"authentication": {"type": "bearer", "token": "{{ _.auth.token }}", "prefix": ""},
			"headers": [{"name": "X-Tenant", "value": "loja"}],
			"environment": {"userId": "7"}},
		{"_id": "req_create", "_type": "request", "parentId": "fld_users", "name": "Criar", "metaSortKey": -5,
			"url": "{{ _['base-url'] }}/users", "method": "POST",
			"body": {"mimeType": "application/json", "text": "{\"id\": \"{% uuid 'v4' %}\", \"at\": \"{% now 'iso-8601', '' %}\"}"},
			"headers": [{"name": "X-Tenant", "value": "override"}],
			"authentication": {"type": "bearer", "token": "t", "prefix": "Token"}},
		{"_id": "req_login", "_type": "request", "parentId": "wrk_api", "name": "Login", "metaSortKey": 10, "url": "https://loja.dev/login", "method": "POST",
			"body": {"mimeType": "application/x-www-form-urlencoded", "params": [{"name": "user", "value": "ana"}, {"name": "pass", "value": 123}]},
			"authentication": {"type": "basic", "username": "ana", "password": "{{ _.pass }}"}},
		{"_id": "req_upload", "_type": "request", "parentId": "wrk_api", "name": "Upload", "metaSortKey": 20, "url": "https://loja.dev/upload", "method": "POST",
			"body": {"mimeType": "multipart/form-data", "params": [{"name": "nome", "value": "foto"}, {"name": "arquivo", "type": "file", "fileName": "/tmp/a.png"}]},
			"authentication": {"type": "apikey", "key": "X-Key", "value": "k", "addTo": "queryParams"}},
		{"_id": "req_graphql", "_type": "request", "parentId": "wrk_api", "name": "GraphQL", "metaSortKey": 30, "url": "https://loja.dev/graphql", "method": "POST",
			"body": {"mimeType": "application/graphql", "text": "{\"query\":\"{ me { id } }\",\"variables\":{\"a\":1}}"},
			"authentication": {"type": "oauth2", "grantType": "client_credentials"}},
		{"_id": "oauth_1", "_type": "oauth2_token", "parentId": "req_graphql", "accessToken": "oauth-token"},
		{"_id": "req_file", "_type": "request", "parentId": "wrk_api", "name": "Arquivo", "metaSortKey": 40, "url": "https://loja.dev/file", "method": "PUT",
			"body": {"mimeType": "application/octet-stream", "fileName": "/tmp/b.bin"}, "authentication": {"type": "digest"}},
		{"_id": "greq_health", "_type": "grpc_request", "parentId": "wrk_api", "name": "Health", "metaSortKey": 50, "url": "grpcs://grpc.loja.dev:443",
			"protoMethodName": "/grpc.health.v1.Health/Check", "protoFileId": "pf_1", "body": {"text": "{\"service\": \"\"}"},
			"metadata": [{"name": "x-trace", "value": "1"}]},
		{"_id": "ws-req_chat", "_type": "websocket_request", "parentId": "wrk_api", "name": "Chat", "metaSortKey": 60, "url": "wss://loja.dev/chat",
			"parameters": [{"name": "room", "value": "geral"}], "headers": [], "authentication": {"type": "none"}},
		{"_id": "ws-payload_1", "_type": "websocket_payload", "parentId": "ws-req_chat", "value": "{\"hello\": true}", "mode": "application/json"},
		{"_id": "uts_1", "_type": "unit_test_suite", "parentId": "wrk_api", "name": "Testes"},
		{"_id": "spc_1", "_type": "api_spec", "parentId": "wrk_api", "fileName": "Loja"}
	]
}`

const insomniaV5Sample = `type: collection.insomnia.rest/5.0
name: Pagamentos
meta:
  id: wrk_pay
  description: API de pagamentos
collection:
  - name: Cobranças
    meta:
      id: fld_charges
    authentication:
      type: apikey
      key: X-Api
      value: "{{ _.apiKey }}"
    children:
      - url: "{{ _.host }}/charges"
        name: Criar cobrança
        meta:
          id: req_charge
          description: Cria uma cobrança
        method: POST
        body:
          mimeType: application/json
          text: '{"amount": 10}'
        headers:
          - name: Idempotency-Key
            value: 42
        settings:
          followRedirects: off
        scripts:
          afterResponse: insomnia.test('ok', () => {})
  - url: localhost:50051
    name: Saldo
    meta:
      id: greq_balance
    protoMethodName: /pay.Wallet/Balance
    body:
      text: '{"id": 1}'
cookieJar:
  name: Default Jar
  meta:
    id: jar_pay
  cookies:
    - key: sid
      value: abc
      domain: pay.dev
      path: /
      hostOnly: false
environments:
  name: Base Environment
  meta:
    id: env_pay
  data:
    host: https://pay.dev
    apiKey: segredo
  subEnvironments:
    - name: Homologação
      meta:
        id: env_hml
      data:
        host: https://hml.pay.dev
`

func TestParseInsomniaV4Export(test *testing.T) {
	imported, err := ParseImportFile([]byte(insomniaV4Sample), "loja.insomnia.json")
	if err != nil {
		test.Fatalf("unexpected import error: %v", err)
	}
	if len(imported.Collections) != 1 || len(imported.Environments) != 1 {
		test.Fatalf("expected one collection and one environment: %+v", imported)
	}
	collection := imported.Collections[0]
	content := collection.Content
	if collection.Name != "Loja" || content.Description != "API da loja" || content.Auth.Type != vulpesDtos.AuthNone {
		test.Fatalf("unexpected collection info: %q %+v", collection.Name, content.Auth)
	}
	variables := map[string]string{}
	for _, variable := range content.Variables {
		variables[variable.Key] = variable.Value
	}
	if variables["baseUrl"] != "https://loja.dev" || variables["auth.token"] != "abc" || variables["auth.ttl"] != "30" || variables["userId"] != "7" {
		test.Fatalf("base and folder environments must become collection variables: %+v", content.Variables)
	}
	if environment := imported.Environments[0]; environment.Name != "Produção" || environment.Variables[0].Value != "https://prod.loja.dev" {
		test.Fatalf("unexpected sub environment: %+v", environment)
	}
	if len(content.Cookies) != 1 || content.Cookies[0].Name != "session" || !content.Cookies[0].HostOnly || content.Cookies[0].Expires != "2099-01-01T00:00:00Z" {
		test.Fatalf("expected only the valid cookie of the jar: %+v", content.Cookies)
	}

	names := []string{}
	for _, item := range content.Items {
		names = append(names, item.Name)
	}
	if strings.Join(names, ",") != "Usuários,Login,Upload,GraphQL,Arquivo,Health,Chat" {
		test.Fatalf("items must follow metaSortKey order: %v", names)
	}

	folder := content.Items[0]
	if folder.Kind != vulpesDtos.ItemKindFolder || folder.Auth.Type != vulpesDtos.AuthBearer || folder.Auth.Token != "{{auth.token}}" {
		test.Fatalf("unexpected folder: %+v", folder)
	}
	if folder.Children[0].Name != "Listar" || folder.Children[1].Name != "Criar" {
		test.Fatalf("children must follow metaSortKey order: %+v", folder.Children)
	}

	create := folder.Children[1].Request
	if create.Http.Url != "{{base-url}}/users" || create.Http.Body.Raw != `{"id": "{{$guid}}", "at": "{{$isoTimestamp}}"}` || create.Http.Body.Language != "json" {
		test.Fatalf("templates were not converted: %+v", create.Http)
	}
	if len(create.Http.Headers) != 1 || create.Http.Headers[0].Value != "override" {
		test.Fatalf("request headers must override folder headers: %+v", create.Http.Headers)
	}
	if create.Auth.Type != vulpesDtos.AuthApiKey || create.Auth.Key != "Authorization" || create.Auth.Value != "Token t" {
		test.Fatalf("custom bearer prefix must become an Authorization header: %+v", create.Auth)
	}

	list := folder.Children[0]
	listRequest := list.Request.Http
	if listRequest.Url != "{{baseUrl}}/users/:id?page=1" || list.Request.Auth.Type != vulpesDtos.AuthInherit || !listRequest.Settings.DisableRedirects {
		test.Fatalf("unexpected list request: %+v %+v", listRequest, list.Request.Auth)
	}
	if len(listRequest.Params) != 2 || listRequest.Params[1].Enabled || listRequest.Params[1].Value != "a%26b" {
		test.Fatalf("unexpected params: %+v", listRequest.Params)
	}
	if len(listRequest.PathVariables) != 1 || listRequest.PathVariables[0].Value != "{{userId}}" {
		test.Fatalf("unexpected path variables: %+v", listRequest.PathVariables)
	}
	if len(listRequest.Headers) != 3 || listRequest.Headers[0].Key != "X-Tenant" || listRequest.Headers[2].Enabled {
		test.Fatalf("folder headers must be inherited: %+v", listRequest.Headers)
	}
	if len(list.Scripts) != 1 || list.Scripts[0].Listen != "prerequest" || list.Scripts[0].Source != "pm.environment.set('a', 1)" {
		test.Fatalf("unexpected scripts: %+v", list.Scripts)
	}

	login := content.Items[1].Request
	if login.Auth.Type != vulpesDtos.AuthBasic || login.Auth.Password != "{{pass}}" || login.Http.Body.Mode != vulpesDtos.BodyUrlEncoded || login.Http.Body.UrlEncoded[1].Value != "123" {
		test.Fatalf("unexpected login request: %+v", login)
	}
	upload := content.Items[2].Request
	if fields := upload.Http.Body.FormData; len(fields) != 2 || fields[1].Kind != "file" || fields[1].FilePath != "/tmp/a.png" || upload.Auth.Location != "query" {
		test.Fatalf("unexpected upload request: %+v", upload)
	}
	graphql := content.Items[3].Request
	if graphql.Http.Body.Mode != vulpesDtos.BodyGraphql || graphql.Http.Body.GraphqlQuery != "{ me { id } }" || graphql.Auth.Token != "oauth-token" {
		test.Fatalf("unexpected graphql request: %+v %+v", graphql.Http.Body, graphql.Auth)
	}
	if binary := content.Items[4].Request; binary.Http.Body.Mode != vulpesDtos.BodyBinary || binary.Http.Body.BinaryPath != "/tmp/b.bin" || binary.Auth.Type != vulpesDtos.AuthNone {
		test.Fatalf("unexpected binary request: %+v", binary)
	}
	grpcRequest := content.Items[5].Request
	if grpcRequest.Protocol != vulpesDtos.ProtocolGrpc || grpcRequest.Grpc.Method != "grpc.health.v1.Health/Check" || grpcRequest.Grpc.Url != "grpcs://grpc.loja.dev:443" || grpcRequest.Grpc.Metadata[0].Key != "x-trace" {
		test.Fatalf("unexpected grpc request: %+v", grpcRequest.Grpc)
	}
	webSocket := content.Items[6].Request
	if webSocket.Protocol != vulpesDtos.ProtocolWebSocket || webSocket.WebSocket.Url != "wss://loja.dev/chat?room=geral" || webSocket.WebSocket.MessageKind != "json" || webSocket.Auth.Type != vulpesDtos.AuthNone {
		test.Fatalf("unexpected websocket request: %+v", webSocket)
	}

	warnings := strings.Join(imported.Warnings, "\n")
	for _, expected := range []string{"pastas do Insomnia", "OAuth 2.0", `"digest"`, "Scripts do Insomnia", ".proto", "Testes de unidade"} {
		if !strings.Contains(warnings, expected) {
			test.Fatalf("expected warning containing %q, got:\n%s", expected, warnings)
		}
	}
	if strings.Contains(warnings, "api_spec") {
		test.Fatalf("api specs must be ignored silently:\n%s", warnings)
	}
}

func TestParseInsomniaV5YamlAndV4Yaml(test *testing.T) {
	imported, err := ParseImportFile([]byte(insomniaV5Sample), "pagamentos.yaml")
	if err != nil {
		test.Fatalf("unexpected v5 import error: %v", err)
	}
	if len(imported.Collections) != 1 || len(imported.Environments) != 1 || imported.Environments[0].Name != "Homologação" {
		test.Fatalf("unexpected v5 import: %+v", imported)
	}
	content := imported.Collections[0].Content
	if imported.Collections[0].Name != "Pagamentos" || content.Description != "API de pagamentos" || len(content.Variables) != 2 || content.Cookies[0].Name != "sid" {
		test.Fatalf("unexpected v5 collection: %+v", content)
	}
	folder := content.Items[0]
	if folder.Kind != vulpesDtos.ItemKindFolder || folder.Auth.Type != vulpesDtos.AuthApiKey || folder.Auth.Value != "{{apiKey}}" {
		test.Fatalf("unexpected v5 folder: %+v", folder)
	}
	charge := folder.Children[0]
	if charge.Description != "Cria uma cobrança" || charge.Request.Http.Url != "{{host}}/charges" || charge.Request.Http.Headers[0].Value != "42" || !charge.Request.Http.Settings.DisableRedirects {
		test.Fatalf("unexpected v5 request: %+v", charge)
	}
	if len(charge.Scripts) != 1 || charge.Scripts[0].Listen != "test" || !strings.HasPrefix(charge.Scripts[0].Source, "pm.test") {
		test.Fatalf("unexpected v5 scripts: %+v", charge.Scripts)
	}
	if balance := content.Items[1].Request; balance.Protocol != vulpesDtos.ProtocolGrpc || balance.Grpc.Method != "pay.Wallet/Balance" || balance.Grpc.Message != `{"id": 1}` {
		test.Fatalf("unexpected v5 grpc request: %+v", balance)
	}

	yamlExport := "_type: export\n__export_format: 4\nresources:\n  - _id: wrk_1\n    _type: workspace\n    name: YAML\n  - _id: req_1\n    _type: request\n    parentId: wrk_1\n    name: Ping\n    url: https://x.dev/ping\n    method: GET\n"
	fromYaml, err := ParseImportFile([]byte(yamlExport), "export.yaml")
	if err != nil || fromYaml.Collections[0].Name != "YAML" || fromYaml.Collections[0].Content.Items[0].Request.Http.Url != "https://x.dev/ping" {
		test.Fatalf("unexpected v4 yaml import: %+v %v", fromYaml, err)
	}

	environmentOnly := `{"_type": "export", "__export_format": 4, "resources": [{"_id": "env_1", "_type": "environment", "parentId": "__BASE_ENVIRONMENT_ID__", "name": "Local", "data": {"a": "1"}}]}`
	environments, err := ParseImportFile([]byte(environmentOnly), "local.json")
	if err != nil || len(environments.Collections) != 0 || environments.Environments[0].Name != "Local" {
		test.Fatalf("orphan environments must become Vulpes environments: %+v %v", environments, err)
	}

	for name, content := range map[string]string{
		"invalid json": `{"_type": "export",`,
		"invalid yaml": "a: [1, 2",
		"empty":        `{"_type": "export", "__export_format": 4, "resources": []}`,
	} {
		if _, err := ParseImportFile([]byte(content), name); err == nil {
			test.Fatalf("expected %s to fail", name)
		}
	}
}

func TestInsomniaExportRoundTrip(test *testing.T) {
	imported, err := ParseImportFile([]byte(postmanCollectionSample), "loja.json")
	if err != nil {
		test.Fatalf("unexpected import error: %v", err)
	}
	content := imported.Collections[0].Content
	content.Cookies = []vulpesDtos.CookieDto{{Name: "sid", Value: "1", Domain: "loja.dev", Path: "/", HttpOnly: true, SameSite: "Lax"}}
	content.Variables = append(content.Variables, vulpesDtos.VariableDto{Key: "auth.token", Value: "{{baseUrl}}-x", Enabled: true})

	socketRequest := NewRequest(vulpesDtos.ProtocolSocketIo)
	socketRequest.SocketIo.Url = "http://localhost:3000"
	webSocketRequest := NewRequest(vulpesDtos.ProtocolWebSocket)
	webSocketRequest.WebSocket.Url = "ws://localhost:3000/ws?room=1"
	webSocketRequest.WebSocket.Message = `{"a": 1}`
	webSocketRequest.WebSocket.MessageKind = "json"
	content.Items = append(content.Items,
		vulpesDtos.CollectionItemDto{Kind: vulpesDtos.ItemKindRequest, Name: "Chat", Request: &socketRequest},
		vulpesDtos.CollectionItemDto{Kind: vulpesDtos.ItemKindRequest, Name: "Socket", Request: &webSocketRequest},
	)
	NormalizeContent(&content)

	exported, warnings, err := ExportInsomniaCollection("Loja", content)
	if err != nil {
		test.Fatalf("unexpected export error: %v", err)
	}
	if !strings.Contains(strings.Join(warnings, "\n"), "Socket.IO") {
		test.Fatalf("expected a Socket.IO warning: %v", warnings)
	}
	var envelope struct {
		Type         string `json:"_type"`
		ExportFormat int    `json:"__export_format"`
	}
	if err := json.Unmarshal(exported, &envelope); err != nil || envelope.Type != "export" || envelope.ExportFormat != 4 {
		test.Fatalf("export must be an Insomnia v4 file: %v", err)
	}
	if !strings.Contains(string(exported), `"auth": {`) || !strings.Contains(string(exported), `{{ _.baseUrl }}`) {
		test.Fatalf("variables must use the Insomnia syntax and dotted keys must become nested data")
	}
	if !strings.Contains(strings.Join(warnings, "\n"), "certificado TLS") {
		test.Fatalf("expected a warning about per-request TLS settings: %v", warnings)
	}

	reimported, err := ParseImportFile(exported, "loja.insomnia.json")
	if err != nil {
		test.Fatalf("unexpected reimport error: %v", err)
	}
	roundTrip := reimported.Collections[0].Content
	if len(roundTrip.Items) != len(content.Items) || roundTrip.Items[0].Children[0].Name != content.Items[0].Children[0].Name {
		test.Fatalf("round trip changed the item tree")
	}
	if len(roundTrip.Cookies) != 1 || roundTrip.Cookies[0] != content.Cookies[0] {
		test.Fatalf("round trip changed the cookies: %+v", roundTrip.Cookies)
	}
	variables := map[string]string{}
	for _, variable := range roundTrip.Variables {
		variables[variable.Key] = variable.Value
	}
	if variables["auth.token"] != "{{baseUrl}}-x" || variables["baseUrl"] != "https://loja.dev" {
		test.Fatalf("round trip changed the variables: %+v", roundTrip.Variables)
	}

	original, restored := content.Items[0].Children[0].Request, roundTrip.Items[0].Children[0].Request
	if restored.Http.Url != original.Http.Url || len(restored.Http.Params) != len(original.Http.Params) || restored.Http.Params[1].Enabled {
		test.Fatalf("round trip changed url or params:\nbefore: %+v\nafter:  %+v", original.Http, restored.Http)
	}
	if restored.Http.PathVariables[0] != original.Http.PathVariables[0] || restored.Http.Settings.DisableRedirects != original.Http.Settings.DisableRedirects {
		test.Fatalf("round trip changed path variables or redirect settings")
	}
	if restored.Http.Body.Mode != original.Http.Body.Mode || restored.Auth != original.Auth || len(restored.Http.Headers) != len(original.Http.Headers) {
		test.Fatalf("round trip changed body, auth or headers:\nbefore: %+v\nafter:  %+v", original, restored)
	}

	webSocketItem := roundTrip.Items[len(roundTrip.Items)-1]
	edited := strings.Replace(string(exported), `"url": "ws://localhost:3000/ws"`, `"url": "ws://localhost:4000/ws"`, 1)
	editedImport, err := ParseImportFile([]byte(edited), "edited.json")
	if err != nil || webSocketItem.Request.WebSocket.Url != "ws://localhost:3000/ws?room=1" {
		test.Fatalf("unexpected edited import: %v", err)
	}
	if editedSocket := editedImport.Collections[0].Content.Items[len(roundTrip.Items)-1].Request.WebSocket; editedSocket.Url != "ws://localhost:4000/ws?room=1" || editedSocket.Message != `{"a": 1}` {
		test.Fatalf("edits made in Insomnia must win over the embedded Vulpes request: %+v", editedSocket)
	}
	if rootAuth := roundTrip.Items[2].Request.Auth; rootAuth.Type != vulpesDtos.AuthNone {
		test.Fatalf("explicit auth must be preserved: %+v", rootAuth)
	}
	if inherited := roundTrip.Items[0].Auth; inherited.Type != vulpesDtos.AuthBearer {
		test.Fatalf("folder auth must be preserved: %+v", inherited)
	}
	for position, expected := range []vulpesDtos.RequestDto{socketRequest, webSocketRequest} {
		restoredRequest := roundTrip.Items[len(roundTrip.Items)-2+position].Request
		encodedExpected, _ := json.Marshal(expected)
		encodedRestored, _ := json.Marshal(restoredRequest)
		if string(encodedExpected) != string(encodedRestored) {
			test.Fatalf("realtime requests must round trip losslessly:\nbefore: %s\nafter:  %s", encodedExpected, encodedRestored)
		}
	}

	environmentExport, _, err := ExportInsomniaEnvironment("Prod", []vulpesDtos.VariableDto{{Key: "token", Value: "abc", Enabled: true}, {Key: "off", Value: "x"}})
	if err != nil {
		test.Fatalf("unexpected environment export error: %v", err)
	}
	environment, err := ParseImportFile(environmentExport, "prod.json")
	if err != nil || environment.Environments[0].Name != "Prod" || len(environment.Environments[0].Variables) != 1 {
		test.Fatalf("unexpected environment round trip: %+v %v", environment, err)
	}
}
