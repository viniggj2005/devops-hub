package vulpesFunctions

import (
	"context"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

func TestVariableResolverLayersNestingAndDynamicValues(test *testing.T) {
	resolver := NewVariableResolver(
		[]vulpesDtos.VariableDto{
			{Key: "host", Value: "collection.local", Enabled: true},
			{Key: "baseUrl", Value: "https://{{host}}/api", Enabled: true},
			{Key: "disabled", Value: "nope", Enabled: false},
		},
		[]vulpesDtos.VariableDto{{Key: "host", Value: "environment.local", Enabled: true}},
	)

	if resolved := resolver.Resolve("{{ baseUrl }}/users"); resolved != "https://environment.local/api/users" {
		test.Fatalf("unexpected nested resolution: %q", resolved)
	}
	if resolved := resolver.Resolve("{{disabled}}-{{missing}}"); resolved != "{{disabled}}-{{missing}}" {
		test.Fatalf("disabled and missing variables must stay untouched, got %q", resolved)
	}
	guidPattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	if resolved := resolver.Resolve("{{$guid}}"); !guidPattern.MatchString(resolved) {
		test.Fatalf("expected a GUID, got %q", resolved)
	}
	if resolved := resolver.Resolve("{{$timestamp}}"); !regexp.MustCompile(`^\d{10}$`).MatchString(resolved) {
		test.Fatalf("expected a unix timestamp, got %q", resolved)
	}

	selfReferencing := NewVariableResolver([]vulpesDtos.VariableDto{{Key: "loop", Value: "x{{loop}}", Enabled: true}})
	if resolved := selfReferencing.Resolve("{{loop}}"); len(resolved) > 64 {
		test.Fatalf("self referencing variables must stop expanding, got %d chars", len(resolved))
	}
}

func TestNormalizeUrlEncodingAndPathVariables(test *testing.T) {
	cases := map[string]string{
		"localhost:8080/items":               "http://localhost:8080/items",
		"https://api.dev/search?q=a b&x=%20": "https://api.dev/search?q=a%20b&x=%20",
		"https://api.dev/caminho/ação":       "https://api.dev/caminho/a%C3%A7%C3%A3o",
		"https://api.dev/list?tags[]=1#frag": "https://api.dev/list?tags%5B%5D=1",
	}
	for input, expected := range cases {
		normalized, err := NormalizeUrl(input, "http")
		if err != nil || normalized != expected {
			test.Fatalf("NormalizeUrl(%q) = %q, %v; expected %q", input, normalized, err, expected)
		}
	}

	if _, err := NormalizeUrl("{{baseUrl}}/users", "http"); err == nil || !strings.Contains(err.Error(), "{{baseUrl}}") {
		test.Fatalf("expected an undefined variable error, got %v", err)
	}
	if _, err := NormalizeUrl("   ", "http"); err == nil {
		test.Fatalf("expected an error for an empty URL")
	}

	withPathVariables := ApplyPathVariables("https://api.dev:8443/users/:id/posts/:postId?expand=:id", []vulpesDtos.KeyValueDto{
		{Key: "id", Value: "42"},
		{Key: "postId", Value: "7"},
	})
	if withPathVariables != "https://api.dev:8443/users/42/posts/7?expand=:id" {
		test.Fatalf("unexpected path variable replacement: %q", withPathVariables)
	}
	if names := PathVariableNames("{{base}}/orgs/:org/repos/:repo"); strings.Join(names, ",") != "org,repo" {
		test.Fatalf("unexpected path variable names: %v", names)
	}
	if appended := AppendQuery("https://api.dev/x?a=1", []vulpesDtos.HeaderDto{{Key: "api key", Value: "v&1"}}); appended != "https://api.dev/x?a=1&api+key=v%261" {
		test.Fatalf("unexpected appended query: %q", appended)
	}
}

func TestBuildHttpRequestBodiesHeadersAndAuth(test *testing.T) {
	ctx := context.Background()

	rawRequest, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{
		Url:     "api.dev/items",
		Method:  "post",
		Headers: []vulpesDtos.KeyValueDto{{Key: "X-Trace", Value: "1", Enabled: true}, {Key: "X-Off", Value: "1"}},
		Body:    vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyRaw, Language: "json", Raw: `{"a":1}`},
	}, vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: "secret"})
	if err != nil {
		test.Fatalf("unexpected error building raw request: %v", err)
	}
	rawBody, _ := io.ReadAll(rawRequest.Body)
	if rawRequest.Method != "POST" || string(rawBody) != `{"a":1}` || rawRequest.Header.Get("Content-Type") != "application/json" {
		test.Fatalf("unexpected raw request: %s %s %q", rawRequest.Method, rawRequest.Header.Get("Content-Type"), rawBody)
	}
	if rawRequest.Header.Get("Authorization") != "Bearer secret" || rawRequest.Header.Get("X-Trace") != "1" || rawRequest.Header.Get("X-Off") != "" {
		test.Fatalf("unexpected headers: %v", rawRequest.Header)
	}

	userAuthorization, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{
		Url:     "https://api.dev",
		Method:  "GET",
		Headers: []vulpesDtos.KeyValueDto{{Key: "Authorization", Value: "Custom abc", Enabled: true}},
	}, vulpesDtos.AuthDto{Type: vulpesDtos.AuthBasic, Username: "user", Password: "pass"})
	if err != nil || userAuthorization.Header.Get("Authorization") != "Custom abc" {
		test.Fatalf("explicit Authorization header must win over auth settings: %v %v", userAuthorization.Header, err)
	}

	apiKeyRequest, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{Url: "https://api.dev/x", Method: "GET"},
		vulpesDtos.AuthDto{Type: vulpesDtos.AuthApiKey, Key: "token", Value: "abc", Location: "query"})
	if err != nil || apiKeyRequest.URL.RawQuery != "token=abc" {
		test.Fatalf("expected api key in query, got %q (%v)", apiKeyRequest.URL.RawQuery, err)
	}

	urlEncodedRequest, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{
		Url:    "https://api.dev/form",
		Method: "POST",
		Body: vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyUrlEncoded, UrlEncoded: []vulpesDtos.KeyValueDto{
			{Key: "name", Value: "Ana Maria", Enabled: true},
			{Key: "skip", Value: "x", Enabled: false},
		}},
	}, vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone})
	if err != nil {
		test.Fatalf("unexpected error building urlencoded request: %v", err)
	}
	urlEncodedBody, _ := io.ReadAll(urlEncodedRequest.Body)
	if string(urlEncodedBody) != "name=Ana+Maria" || urlEncodedRequest.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
		test.Fatalf("unexpected urlencoded body: %q", urlEncodedBody)
	}

	uploadPath := filepath.Join(test.TempDir(), "relatório.txt")
	if err := os.WriteFile(uploadPath, []byte("conteúdo"), 0o600); err != nil {
		test.Fatalf("unexpected error writing upload: %v", err)
	}
	formRequest, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{
		Url:    "https://api.dev/upload",
		Method: "POST",
		Body: vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyFormData, FormData: []vulpesDtos.FormFieldDto{
			{Key: "description", Kind: "text", Value: "anexo", Enabled: true},
			{Key: "file", Kind: "file", FilePath: uploadPath, Enabled: true},
		}},
	}, vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone})
	if err != nil {
		test.Fatalf("unexpected error building multipart request: %v", err)
	}
	_, params, err := mime.ParseMediaType(formRequest.Header.Get("Content-Type"))
	if err != nil {
		test.Fatalf("invalid multipart content type: %v", err)
	}
	reader := multipart.NewReader(formRequest.Body, params["boundary"])
	parts := map[string]string{}
	for {
		part, err := reader.NextPart()
		if err != nil {
			break
		}
		content, _ := io.ReadAll(part)
		parts[part.FormName()+"|"+part.FileName()] = string(content)
	}
	if parts["description|"] != "anexo" || parts["file|relatório.txt"] != "conteúdo" {
		test.Fatalf("unexpected multipart parts: %v", parts)
	}

	binaryRequest, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{
		Url:    "https://api.dev/raw",
		Method: "PUT",
		Body:   vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyBinary, BinaryPath: uploadPath},
	}, vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone})
	if err != nil || binaryRequest.ContentLength != int64(len("conteúdo")) || binaryRequest.GetBody == nil {
		test.Fatalf("unexpected binary request: %v (length %d)", err, binaryRequest.ContentLength)
	}
	binaryRequest.Body.Close()

	graphqlRequest, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{
		Url:    "https://api.dev/graphql",
		Method: "POST",
		Body:   vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyGraphql, GraphqlQuery: "{ me { id } }", GraphqlVariables: `{"id": 1}`},
	}, vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone})
	if err != nil {
		test.Fatalf("unexpected error building graphql request: %v", err)
	}
	var graphqlPayload map[string]any
	if err := json.NewDecoder(graphqlRequest.Body).Decode(&graphqlPayload); err != nil || graphqlPayload["query"] != "{ me { id } }" || graphqlPayload["variables"] == nil {
		test.Fatalf("unexpected graphql payload: %v (%v)", graphqlPayload, err)
	}

	if _, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{
		Url:    "https://api.dev/graphql",
		Method: "POST",
		Body:   vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyGraphql, GraphqlVariables: "{invalid"},
	}, vulpesDtos.AuthDto{}); err == nil {
		test.Fatalf("expected invalid graphql variables to fail")
	}
	if _, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{Url: "https://api.dev", Method: "BAD METHOD"}, vulpesDtos.AuthDto{}); err == nil {
		test.Fatalf("expected invalid method to fail")
	}
	if _, err := BuildHttpRequest(ctx, vulpesDtos.HttpRequestDto{Url: "ftp://api.dev", Method: "GET"}, vulpesDtos.AuthDto{}); err == nil {
		test.Fatalf("expected unsupported scheme to fail")
	}
}

func sampleTree() []vulpesDtos.CollectionItemDto {
	bearer := vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: "folder-token"}
	inherit := vulpesDtos.AuthDto{Type: vulpesDtos.AuthInherit}
	request := NewRequest(vulpesDtos.ProtocolHttp)
	return []vulpesDtos.CollectionItemDto{
		{ID: "users", Kind: vulpesDtos.ItemKindFolder, Name: "Users", Auth: &bearer, Children: []vulpesDtos.CollectionItemDto{
			{ID: "admin", Kind: vulpesDtos.ItemKindFolder, Name: "Admin", Auth: &inherit, Children: []vulpesDtos.CollectionItemDto{
				{ID: "list", Kind: vulpesDtos.ItemKindRequest, Name: "List", Request: &request},
			}},
		}},
		{ID: "health", Kind: vulpesDtos.ItemKindRequest, Name: "Health", Request: &request},
	}
}

func TestCollectionTreeOperationsAndAuthInheritance(test *testing.T) {
	items := sampleTree()

	if found := FindItem(items, "list"); found == nil || found.Name != "List" {
		test.Fatalf("expected to find nested item")
	}
	ancestors, found := ItemAncestors(items, "list")
	if !found || len(ancestors) != 2 || ancestors[0].ID != "users" || ancestors[1].ID != "admin" {
		test.Fatalf("unexpected ancestors: %v", ancestors)
	}
	if parentID, position, found := ItemLocation(items, "list"); !found || parentID != "admin" || position != 0 {
		test.Fatalf("unexpected location: %q %d %v", parentID, position, found)
	}
	if parentID, position, found := ItemLocation(items, "health"); !found || parentID != "" || position != 1 {
		test.Fatalf("unexpected root location: %q %d %v", parentID, position, found)
	}

	content := &vulpesDtos.CollectionContentDto{Items: items, Auth: vulpesDtos.AuthDto{Type: vulpesDtos.AuthBasic, Username: "root"}}
	if auth := EffectiveAuth(content, "list", vulpesDtos.AuthDto{Type: vulpesDtos.AuthInherit}); auth.Token != "folder-token" {
		test.Fatalf("expected folder auth to be inherited, got %+v", auth)
	}
	if auth := EffectiveAuth(content, "health", vulpesDtos.AuthDto{Type: vulpesDtos.AuthInherit}); auth.Username != "root" {
		test.Fatalf("expected collection auth to be inherited, got %+v", auth)
	}
	if auth := EffectiveAuth(nil, "health", vulpesDtos.AuthDto{Type: vulpesDtos.AuthInherit}); auth.Type != vulpesDtos.AuthNone {
		test.Fatalf("expected no auth without collection, got %+v", auth)
	}

	newRequest := vulpesDtos.CollectionItemDto{ID: "new", Kind: vulpesDtos.ItemKindRequest}
	NormalizeItem(&newRequest)
	updated, err := InsertItem(items, "admin", 0, newRequest)
	if err != nil || FindItem(updated, "admin").Children[0].ID != "new" {
		test.Fatalf("expected item inserted at the start of admin: %v", err)
	}
	if _, err := InsertItem(updated, "health", -1, newRequest); err != ErrParentNotFolder {
		test.Fatalf("expected ErrParentNotFolder, got %v", err)
	}
	if _, err := InsertItem(updated, "missing", -1, newRequest); err != ErrParentNotFound {
		test.Fatalf("expected ErrParentNotFound, got %v", err)
	}

	remaining, removed := RemoveItem(updated, "users")
	if removed == nil || len(remaining) != 1 || !ContainsItem(*removed, "list") {
		test.Fatalf("unexpected removal result")
	}

	clone, err := CloneItem(*removed)
	if err != nil {
		test.Fatalf("unexpected clone error: %v", err)
	}
	AssignFreshIDs(&clone)
	if clone.ID == "users" || FindItem(clone.Children, "admin") != nil {
		test.Fatalf("clone must receive fresh IDs")
	}
	clone.Children[0].Name = "changed"
	if removed.Children[0].Name != "Admin" {
		test.Fatalf("clone must not share memory with the original")
	}

	duplicated := vulpesDtos.CollectionItemDto{ID: "health", Kind: vulpesDtos.ItemKindRequest}
	EnsureUniqueIDs(&duplicated, CollectItemIDs(remaining, map[string]bool{}))
	if duplicated.ID == "health" {
		test.Fatalf("expected duplicated ID to be replaced")
	}
}

func TestNormalizeRequestDefaults(test *testing.T) {
	request := vulpesDtos.RequestDto{Protocol: "SOCKETIO", Http: &vulpesDtos.HttpRequestDto{}}
	NormalizeRequest(&request)
	if request.Http != nil || request.SocketIo == nil || request.SocketIo.Version != "v4" || request.SocketIo.Path != "/socket.io/" {
		test.Fatalf("unexpected normalized socket.io request: %+v", request)
	}
	if request.Auth.Type != vulpesDtos.AuthInherit {
		test.Fatalf("expected inherit auth by default, got %q", request.Auth.Type)
	}

	unknown := vulpesDtos.RequestDto{Protocol: "ftp"}
	NormalizeRequest(&unknown)
	if unknown.Protocol != vulpesDtos.ProtocolHttp || unknown.Http == nil || unknown.Http.Method != "GET" || unknown.Http.Body.Mode != vulpesDtos.BodyNone {
		test.Fatalf("unexpected normalized http request: %+v", unknown.Http)
	}
	if unknown.Http.Headers == nil || unknown.Http.Params == nil || unknown.Http.Body.FormData == nil {
		test.Fatalf("slices must never be nil after normalization")
	}

	folder := vulpesDtos.CollectionItemDto{Kind: vulpesDtos.ItemKindFolder, Request: &request}
	NormalizeItem(&folder)
	if folder.Request != nil || folder.Auth == nil || folder.Auth.Type != vulpesDtos.AuthInherit || folder.Name != DefaultFolderName || folder.ID == "" {
		test.Fatalf("unexpected normalized folder: %+v", folder)
	}
}

const postmanCollectionSample = `{
	"info": {
		"_postman_id": "abc",
		"name": "Loja",
		"description": {"content": "API da loja", "type": "text/markdown"},
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"auth": {"type": "apikey", "apikey": [{"key": "key", "value": "X-Api"}, {"key": "value", "value": "{{apiKey}}"}, {"key": "in", "value": "header"}]},
	"variable": [{"key": "baseUrl", "value": "https://loja.dev"}, {"id": "legacy", "value": 10, "disabled": true}],
	"event": [{"listen": "prerequest", "script": {"exec": ["console.log(1)"]}}],
	"item": [
		{
			"name": "Produtos",
			"auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{token}}", "type": "string"}]},
			"item": [
				{
					"name": "Buscar produto",
					"protocolProfileBehavior": {"followRedirects": false, "strictSSL": false},
					"request": {
						"method": "GET",
						"header": [{"key": "Accept", "value": "application/json"}, {"key": "X-Off", "value": "1", "disabled": true}],
						"url": {
							"raw": "{{baseUrl}}/products/:id?expand=true",
							"host": ["{{baseUrl}}"],
							"path": ["products", ":id"],
							"query": [{"key": "expand", "value": "true"}, {"key": "debug", "value": "1", "disabled": true}],
							"variable": [{"key": "id", "value": "10", "description": "Id do produto"}]
						}
					},
					"response": [{"name": "exemplo"}]
				},
				{"name": "Vazia", "item": []}
			]
		},
		{
			"name": "Criar produto",
			"request": {
				"method": "POST",
				"auth": {"type": "oauth2", "oauth2": [{"key": "accessToken", "value": "oauth-token"}]},
				"header": "Content-Type: application/json\nX-Custom: sim",
				"body": {"mode": "raw", "raw": "{\"name\": \"Caneca\"}"},
				"url": "{{baseUrl}}/products"
			}
		},
		{
			"name": "Upload",
			"request": {
				"method": "POST",
				"auth": {"type": "digest", "digest": []},
				"body": {"mode": "formdata", "formdata": [
					{"key": "nome", "value": "foto", "type": "text"},
					{"key": "arquivo", "type": "file", "src": ["/tmp/a.png", "/tmp/b.png"]}
				]},
				"url": {"protocol": "https", "host": ["files", "loja", "dev"], "port": "8443", "path": ["upload"]}
			}
		},
		{
			"name": "Login",
			"request": {
				"method": "POST",
				"auth": {"type": "basic", "basic": {"username": "ana", "password": "123"}},
				"body": {"mode": "urlencoded", "urlencoded": [{"key": "grant", "value": "password"}]},
				"url": "{{baseUrl}}/login"
			}
		},
		{
			"name": "GraphQL",
			"request": {
				"method": "POST",
				"auth": {"type": "noauth"},
				"body": {"mode": "graphql", "graphql": {"query": "{ me }", "variables": {"a": 1}}},
				"url": "{{baseUrl}}/graphql"
			}
		},
		{"name": "Atalho", "request": "https://loja.dev/ping"}
	]
}`

func TestParsePostmanCollection(test *testing.T) {
	imported, err := ParsePostmanFile([]byte(postmanCollectionSample), "loja.json")
	if err != nil {
		test.Fatalf("unexpected import error: %v", err)
	}
	if len(imported.Collections) != 1 {
		test.Fatalf("expected one collection, got %d", len(imported.Collections))
	}
	collection := imported.Collections[0]
	content := collection.Content
	if collection.Name != "Loja" || content.Description != "API da loja" {
		test.Fatalf("unexpected collection info: %q %q", collection.Name, content.Description)
	}
	if content.Auth.Type != vulpesDtos.AuthApiKey || content.Auth.Key != "X-Api" || content.Auth.Value != "{{apiKey}}" || content.Auth.Location != "header" {
		test.Fatalf("unexpected collection auth: %+v", content.Auth)
	}
	if len(content.Variables) != 2 || content.Variables[1].Key != "legacy" || content.Variables[1].Value != "10" || content.Variables[1].Enabled {
		test.Fatalf("unexpected collection variables: %+v", content.Variables)
	}
	if len(content.Scripts) != 1 || content.Scripts[0].Source != "console.log(1)" {
		test.Fatalf("unexpected collection scripts: %+v", content.Scripts)
	}

	folder := content.Items[0]
	if folder.Kind != vulpesDtos.ItemKindFolder || folder.Auth.Type != vulpesDtos.AuthBearer || folder.Auth.Token != "{{token}}" || len(folder.Children) != 2 {
		test.Fatalf("unexpected folder: %+v", folder)
	}
	if emptyFolder := folder.Children[1]; emptyFolder.Kind != vulpesDtos.ItemKindFolder || len(emptyFolder.Children) != 0 {
		test.Fatalf("an item with an empty item array must be a folder: %+v", emptyFolder)
	}

	search := folder.Children[0].Request
	if search.Auth.Type != vulpesDtos.AuthInherit || search.Http.Url != "{{baseUrl}}/products/:id?expand=true" {
		test.Fatalf("unexpected search request: %+v %q", search.Auth, search.Http.Url)
	}
	if len(search.Http.Params) != 2 || search.Http.Params[1].Enabled || search.Http.Params[1].Key != "debug" {
		test.Fatalf("unexpected query params: %+v", search.Http.Params)
	}
	if len(search.Http.PathVariables) != 1 || search.Http.PathVariables[0].Value != "10" || search.Http.PathVariables[0].Description != "Id do produto" {
		test.Fatalf("unexpected path variables: %+v", search.Http.PathVariables)
	}
	if len(search.Http.Headers) != 2 || search.Http.Headers[1].Enabled {
		test.Fatalf("unexpected headers: %+v", search.Http.Headers)
	}
	if !search.Http.Settings.DisableRedirects || !search.Http.Settings.SkipTlsVerify {
		test.Fatalf("unexpected settings: %+v", search.Http.Settings)
	}

	create := content.Items[1].Request
	if create.Auth.Type != vulpesDtos.AuthBearer || create.Auth.Token != "oauth-token" {
		test.Fatalf("oauth2 with access token must become bearer: %+v", create.Auth)
	}
	if create.Http.Body.Mode != vulpesDtos.BodyRaw || create.Http.Body.Language != "json" || len(create.Http.Headers) != 2 || create.Http.Headers[1].Value != "sim" {
		test.Fatalf("unexpected create request: %+v", create.Http)
	}

	upload := content.Items[2].Request
	if upload.Http.Url != "https://files.loja.dev:8443/upload" || upload.Auth.Type != vulpesDtos.AuthNone {
		test.Fatalf("unexpected upload request: %q %+v", upload.Http.Url, upload.Auth)
	}
	if fields := upload.Http.Body.FormData; len(fields) != 2 || fields[1].Kind != "file" || fields[1].FilePath != "/tmp/a.png" {
		test.Fatalf("unexpected form data: %+v", fields)
	}

	login := content.Items[3].Request
	if login.Auth.Type != vulpesDtos.AuthBasic || login.Auth.Username != "ana" || login.Http.Body.UrlEncoded[0].Value != "password" {
		test.Fatalf("v2.0 basic auth and urlencoded body must be imported: %+v", login)
	}
	graphql := content.Items[4].Request
	if graphql.Auth.Type != vulpesDtos.AuthNone || graphql.Http.Body.GraphqlVariables != `{"a": 1}` {
		test.Fatalf("unexpected graphql request: %+v %+v", graphql.Auth, graphql.Http.Body)
	}
	shortcut := content.Items[5].Request
	if shortcut.Http.Method != "GET" || shortcut.Http.Url != "https://loja.dev/ping" {
		test.Fatalf("string requests must become GET requests: %+v", shortcut.Http)
	}

	warnings := strings.Join(imported.Warnings, "\n")
	for _, expected := range []string{"Exemplos de resposta", "OAuth 2.0", `"digest"`, "Scripts do Postman", "vários arquivos"} {
		if !strings.Contains(warnings, expected) {
			test.Fatalf("expected warning containing %q, got:\n%s", expected, warnings)
		}
	}
}

func TestParsePostmanEnvironmentsAndErrors(test *testing.T) {
	imported, err := ParsePostmanFile([]byte("\xef\xbb\xbf"+`{
		"name": "Produção",
		"values": [
			{"key": "token", "value": "abc", "type": "secret", "enabled": true},
			{"key": "old", "value": "x", "enabled": false}
		],
		"_postman_variable_scope": "environment"
	}`), "prod.json")
	if err != nil || len(imported.Environments) != 1 {
		test.Fatalf("unexpected environment import: %v", err)
	}
	environment := imported.Environments[0]
	if environment.Name != "Produção" || !environment.Variables[0].Secret || environment.Variables[1].Enabled {
		test.Fatalf("unexpected environment: %+v", environment)
	}

	globals, err := ParsePostmanFile([]byte(`{"values": [], "_postman_variable_scope": "globals"}`), "globals.json")
	if err != nil || globals.Environments[0].Name != "Globals" {
		test.Fatalf("unexpected globals import: %+v %v", globals, err)
	}

	for name, content := range map[string]string{
		"invalid": "{not json",
		"v1":      `{"id": "1", "name": "old", "order": [], "requests": []}`,
		"unknown": `{"hello": "world"}`,
	} {
		if _, err := ParsePostmanFile([]byte(content), name); err == nil {
			test.Fatalf("expected %s to fail", name)
		}
	}
}

func TestPostmanExportRoundTrip(test *testing.T) {
	imported, err := ParsePostmanFile([]byte(postmanCollectionSample), "loja.json")
	if err != nil {
		test.Fatalf("unexpected import error: %v", err)
	}
	content := imported.Collections[0].Content

	socketRequest := NewRequest(vulpesDtos.ProtocolSocketIo)
	socketRequest.SocketIo.Url = "http://localhost:3000"
	socketRequest.SocketIo.Event = "chat"
	content.Items = append(content.Items, vulpesDtos.CollectionItemDto{Kind: vulpesDtos.ItemKindRequest, Name: "Chat", Request: &socketRequest})
	NormalizeContent(&content)

	exported, err := ExportPostmanCollection("Loja", content)
	if err != nil {
		test.Fatalf("unexpected export error: %v", err)
	}
	var schemaProbe struct {
		Info struct {
			Schema string `json:"schema"`
		} `json:"info"`
	}
	if err := json.Unmarshal(exported, &schemaProbe); err != nil || schemaProbe.Info.Schema != PostmanCollectionSchema {
		test.Fatalf("export must declare the v2.1 schema: %v", err)
	}

	reimported, err := ParsePostmanFile(exported, "export.json")
	if err != nil {
		test.Fatalf("unexpected reimport error: %v", err)
	}
	roundTrip := reimported.Collections[0].Content

	stripIDs := func(items []vulpesDtos.CollectionItemDto) string {
		encoded, _ := json.Marshal(items)
		return regexp.MustCompile(`"id":"[^"]*"`).ReplaceAllString(string(encoded), `"id":""`)
	}
	if stripIDs(roundTrip.Items) != stripIDs(content.Items) {
		test.Fatalf("round trip changed the items:\nbefore: %s\nafter:  %s", stripIDs(content.Items), stripIDs(roundTrip.Items))
	}
	if roundTrip.Auth != content.Auth || len(roundTrip.Variables) != len(content.Variables) {
		test.Fatalf("round trip changed collection auth or variables")
	}

	environmentExport, err := ExportPostmanEnvironment("Prod", []vulpesDtos.VariableDto{{Key: "token", Value: "abc", Secret: true, Enabled: true}})
	if err != nil {
		test.Fatalf("unexpected environment export error: %v", err)
	}
	environment, err := ParsePostmanFile(environmentExport, "prod.json")
	if err != nil || environment.Environments[0].Name != "Prod" || !environment.Environments[0].Variables[0].Secret {
		test.Fatalf("unexpected environment round trip: %+v %v", environment, err)
	}
}

func TestSocketIoPacketsAndEndpoint(test *testing.T) {
	packets := map[string]SocketIoPacket{
		`0{"sid":"abc"}`:                         {Type: SocketConnect, Namespace: "/", Data: json.RawMessage(`{"sid":"abc"}`)},
		`2["hello",1]`:                           {Type: SocketEvent, Namespace: "/", Data: json.RawMessage(`["hello",1]`)},
		`2/admin,12["ev"]`:                       {Type: SocketEvent, Namespace: "/admin", AckID: 12, HasAckID: true, Data: json.RawMessage(`["ev"]`)},
		`3/admin,5[]`:                            {Type: SocketAck, Namespace: "/admin", AckID: 5, HasAckID: true, Data: json.RawMessage(`[]`)},
		`1/chat,`:                                {Type: SocketDisconnect, Namespace: "/chat"},
		`51-["f",{"_placeholder":true,"num":0}]`: {Type: SocketBinaryEvent, Namespace: "/", Attachments: 1, Data: json.RawMessage(`["f",{"_placeholder":true,"num":0}]`)},
	}
	for text, expected := range packets {
		parsed, err := ParseSocketIoPacket(text)
		if err != nil {
			test.Fatalf("unexpected error parsing %q: %v", text, err)
		}
		if parsed.Type != expected.Type || parsed.Namespace != expected.Namespace || parsed.AckID != expected.AckID || parsed.HasAckID != expected.HasAckID || parsed.Attachments != expected.Attachments || string(parsed.Data) != string(expected.Data) {
			test.Fatalf("unexpected packet for %q: %+v", text, parsed)
		}
		if encoded := EncodeSocketIoPacket(parsed); encoded != text {
			test.Fatalf("encoding %q produced %q", text, encoded)
		}
	}
	for _, invalid := range []string{"", "9", "5[]", `2["broken`} {
		if _, err := ParseSocketIoPacket(invalid); err == nil {
			test.Fatalf("expected %q to be rejected", invalid)
		}
	}

	arguments := SocketIoArguments([]string{`{"a":1}`, "texto livre", "  ", "42"})
	payload, err := SocketIoEventPayload("message", arguments)
	if err != nil || string(payload) != `["message",{"a":1},"texto livre",42]` {
		test.Fatalf("unexpected event payload: %s (%v)", payload, err)
	}
	event, eventArguments := SplitSocketIoEvent(payload)
	if event != "message" || len(eventArguments) != 3 || DisplayArguments(eventArguments[:1]) != `{"a":1}` {
		test.Fatalf("unexpected split event: %q %v", event, eventArguments)
	}
	if _, err := SocketIoEventPayload("  ", nil); err == nil {
		test.Fatalf("expected empty event name to fail")
	}

	endpoint, namespace, err := SocketIoEndpoint("https://chat.dev/admin?token=1", "/socket.io", "", "v4")
	if err != nil || endpoint != "wss://chat.dev/socket.io/?token=1&EIO=4&transport=websocket" || namespace != "/admin" {
		test.Fatalf("unexpected v4 endpoint: %q %q %v", endpoint, namespace, err)
	}
	endpoint, namespace, err = SocketIoEndpoint("localhost:3000", "custom", "rooms", "v2")
	if err != nil || endpoint != "ws://localhost:3000/custom/?EIO=3&transport=websocket" || namespace != "/rooms" {
		test.Fatalf("unexpected v2 endpoint: %q %q %v", endpoint, namespace, err)
	}
}

const grpcTestProto = `syntax = "proto3";
package shop.v1;
import "google/protobuf/timestamp.proto";

enum Status { STATUS_UNKNOWN = 0; STATUS_ACTIVE = 1; }

message Node { string name = 1; Node child = 2; }

message Order {
  string id = 1;
  int64 total_cents = 2;
  repeated string tags = 3;
  map<string, int32> quantities = 4;
  Status status = 5;
  google.protobuf.Timestamp created_at = 6;
  oneof payment { string card = 7; string pix = 8; }
  Node tree = 9;
}

service Orders {
  rpc Get(Order) returns (Order);
  rpc Watch(Order) returns (stream Order);
}`

func TestGrpcProtoFilesTargetsAndExamples(test *testing.T) {
	directory := filepath.Join(test.TempDir(), "protos", "shop")
	if err := os.MkdirAll(directory, 0o700); err != nil {
		test.Fatalf("unexpected error creating proto dir: %v", err)
	}
	protoPath := filepath.Join(directory, "orders.proto")
	if err := os.WriteFile(protoPath, []byte(grpcTestProto), 0o600); err != nil {
		test.Fatalf("unexpected error writing proto: %v", err)
	}

	source, err := LoadProtoFiles([]string{protoPath}, []string{filepath.Dir(directory)})
	if err != nil {
		test.Fatalf("unexpected error loading proto: %v", err)
	}
	if len(source.Services()) != 1 || source.Services()[0].FullName() != "shop.v1.Orders" {
		test.Fatalf("unexpected services: %v", source.Services())
	}
	for _, name := range []string{"shop.v1.Orders/Get", "/shop.v1.Orders/Watch", "shop.v1.Orders.Get"} {
		if _, err := source.FindMethod(name); err != nil {
			test.Fatalf("expected to find %s: %v", name, err)
		}
	}
	if _, err := source.FindMethod("shop.v1.Orders/Missing"); err == nil {
		test.Fatalf("expected missing method to fail")
	}
	method, _ := source.FindMethod("shop.v1.Orders/Get")
	if MethodPath(method) != "/shop.v1.Orders/Get" {
		test.Fatalf("unexpected method path: %s", MethodPath(method))
	}
	if source.Types() == nil {
		test.Fatalf("expected dynamic types")
	}

	var example map[string]any
	if err := json.Unmarshal([]byte(ExampleMessageJson(method.Input())), &example); err != nil {
		test.Fatalf("example must be valid JSON: %v", err)
	}
	if example["totalCents"] != "0" || example["status"] != "STATUS_UNKNOWN" || example["createdAt"] != "1970-01-01T00:00:00Z" {
		test.Fatalf("unexpected example scalars: %v", example)
	}
	if _, hasCard := example["card"]; !hasCard {
		test.Fatalf("expected the first oneof field in the example: %v", example)
	}
	if _, hasPix := example["pix"]; hasPix {
		test.Fatalf("only one field of a oneof may be in the example: %v", example)
	}
	if tags, isList := example["tags"].([]any); !isList || len(tags) != 1 {
		test.Fatalf("unexpected repeated example: %v", example["tags"])
	}
	if quantities, isMap := example["quantities"].(map[string]any); !isMap || quantities["key"] != float64(0) {
		test.Fatalf("unexpected map example: %v", example["quantities"])
	}

	if _, err := LoadProtoFiles(nil, nil); err == nil {
		test.Fatalf("expected an error without proto files")
	}

	targets := []struct {
		url     string
		useTls  bool
		address string
		secure  bool
	}{
		{"localhost:50051", false, "localhost:50051", false},
		{"grpcs://api.dev", false, "api.dev:443", true},
		{"grpc://api.dev:9000/ignored", true, "api.dev:9000", false},
		{"api.dev", true, "api.dev:443", true},
	}
	for _, target := range targets {
		address, secure, err := ParseGrpcTarget(target.url, target.useTls)
		if err != nil || address != target.address || secure != target.secure {
			test.Fatalf("ParseGrpcTarget(%q) = %q %v %v", target.url, address, secure, err)
		}
	}
	if _, _, err := ParseGrpcTarget("ftp://api.dev", false); err == nil {
		test.Fatalf("expected unsupported scheme to fail")
	}
}
