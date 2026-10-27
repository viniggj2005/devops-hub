package vulpesHandlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/glebarez/sqlite"
	"github.com/wailsapp/wails/v3/pkg/application"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

type eventCollector struct {
	events chan vulpesDtos.RealtimeEventDto
}

func (collector *eventCollector) waitFor(test *testing.T, description string, matches func(event vulpesDtos.RealtimeEventDto) bool) vulpesDtos.RealtimeEventDto {
	test.Helper()
	timeout := time.After(5 * time.Second)
	for {
		select {
		case event := <-collector.events:
			if matches(event) {
				return event
			}
		case <-timeout:
			test.Fatalf("timed out waiting for %s", description)
		}
	}
}

type testEnvironment struct {
	token     string
	vulpes    *VulpesHandlerStruct
	client    *VulpesClientHandlerStruct
	collector *eventCollector
}

func setupVulpesTest(test *testing.T) testEnvironment {
	test.Helper()
	if err := types.SetSessionKey(hex.EncodeToString(bytes.Repeat([]byte{0x42}, 32))); err != nil {
		test.Fatalf("unexpected error setting session key: %v", err)
	}
	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(&models.UserModel{}, &models.VulpesCollectionModel{}, &models.VulpesEnvironmentModel{}); err != nil {
		test.Fatalf("unexpected error migrating: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	token, _, err := sessionManager.Create(1)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	vulpesHandler := NewVulpesHandler(dataBase, sessionManager)
	vulpesHandler.ServiceStartup(context.Background(), application.ServiceOptions{})
	clientHandler := NewVulpesClientHandler(vulpesHandler)
	clientHandler.ServiceStartup(context.Background(), application.ServiceOptions{})

	collector := &eventCollector{events: make(chan vulpesDtos.RealtimeEventDto, 256)}
	clientHandler.emitToWindow = func(_ string, _ string, data any) {
		collector.events <- data.(vulpesDtos.RealtimeEventDto)
	}
	test.Cleanup(func() { clientHandler.ServiceShutdown() })

	return testEnvironment{token: token, vulpes: vulpesHandler, client: clientHandler, collector: collector}
}

func requestItem(name string, request vulpesDtos.RequestDto) vulpesDtos.CollectionItemDto {
	return vulpesDtos.CollectionItemDto{Kind: vulpesDtos.ItemKindRequest, Name: name, Request: &request}
}

func TestCollectionsItemsAndEnvironmentsCrud(test *testing.T) {
	environment := setupVulpesTest(test)
	vulpes, token := environment.vulpes, environment.token

	if _, err := vulpes.CreateCollection("invalid", vulpesDtos.CollectionInputDto{Name: "x"}); err == nil {
		test.Fatalf("expected invalid token to fail")
	}
	if _, err := vulpes.CreateCollection(token, vulpesDtos.CollectionInputDto{Name: "   "}); err == nil {
		test.Fatalf("expected empty name to fail")
	}

	api, err := vulpes.CreateCollection(token, vulpesDtos.CollectionInputDto{Name: "API", Variables: []vulpesDtos.VariableDto{{Key: "baseUrl", Value: "http://x", Enabled: true}}})
	if err != nil || api.Auth.Type != vulpesDtos.AuthNone || len(api.Items) != 0 {
		test.Fatalf("unexpected collection: %+v %v", api, err)
	}

	folderResult, err := vulpes.CreateItem(token, api.ID, "", vulpesDtos.CollectionItemDto{ID: "folder", Kind: vulpesDtos.ItemKindFolder, Name: "Usuários"})
	if err != nil || folderResult.ItemID != "folder" {
		test.Fatalf("unexpected folder creation: %+v %v", folderResult, err)
	}
	requestResult, err := vulpes.CreateItem(token, api.ID, "folder", requestItem("Listar", vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)))
	if err != nil || requestResult.ItemID == "" {
		test.Fatalf("unexpected request creation: %v", err)
	}
	if _, err := vulpes.CreateItem(token, api.ID, requestResult.ItemID, requestItem("Inválido", vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp))); err == nil {
		test.Fatalf("expected creating an item inside a request to fail")
	}
	duplicateResult, err := vulpes.CreateItem(token, api.ID, "", vulpesDtos.CollectionItemDto{ID: "folder", Kind: vulpesDtos.ItemKindFolder})
	if err != nil || duplicateResult.ItemID == "folder" {
		test.Fatalf("expected a new ID for a colliding item: %+v %v", duplicateResult, err)
	}

	saved := vulpesFunctions.FindItem(requestResult.Collection.Items, requestResult.ItemID)
	saved.Name = "Listar usuários"
	saved.Request.Http.Url = "{{baseUrl}}/users"
	saved.Children = []vulpesDtos.CollectionItemDto{{Name: "ignored"}}
	afterSave, err := vulpes.SaveItem(token, api.ID, *saved)
	if err != nil {
		test.Fatalf("unexpected save error: %v", err)
	}
	if stored := vulpesFunctions.FindItem(afterSave.Items, requestResult.ItemID); stored.Name != "Listar usuários" || stored.Request.Http.Url != "{{baseUrl}}/users" || len(stored.Children) != 0 {
		test.Fatalf("unexpected saved item: %+v", stored)
	}

	duplicated, err := vulpes.DuplicateItem(token, api.ID, "folder")
	if err != nil {
		test.Fatalf("unexpected duplicate error: %v", err)
	}
	copyFolder := vulpesFunctions.FindItem(duplicated.Collection.Items, duplicated.ItemID)
	if copyFolder == nil || copyFolder.Name != "Usuários (cópia)" || len(copyFolder.Children) != 1 || copyFolder.Children[0].ID == requestResult.ItemID {
		test.Fatalf("unexpected duplicated folder: %+v", copyFolder)
	}
	if duplicated.Collection.Items[1].ID != duplicated.ItemID {
		test.Fatalf("duplicate must be placed right after the original")
	}

	if _, err := vulpes.MoveItem(token, vulpesDtos.MoveItemInputDto{CollectionID: api.ID, ItemID: "folder", TargetParentID: requestResult.ItemID}); err == nil {
		test.Fatalf("expected moving a folder into its own child to fail")
	}
	moved, err := vulpes.MoveItem(token, vulpesDtos.MoveItemInputDto{CollectionID: api.ID, ItemID: requestResult.ItemID, TargetIndex: 0})
	if err != nil || len(moved) != 1 || moved[0].Items[0].ID != requestResult.ItemID {
		test.Fatalf("expected request moved to the root start: %v", err)
	}
	reordered, err := vulpes.MoveItem(token, vulpesDtos.MoveItemInputDto{CollectionID: api.ID, ItemID: requestResult.ItemID, TargetIndex: 2})
	if err != nil || reordered[0].Items[1].ID != requestResult.ItemID {
		test.Fatalf("moving down within the same parent must account for the removed position: %v", err)
	}

	other, err := vulpes.CreateCollection(token, vulpesDtos.CollectionInputDto{Name: "Outra"})
	if err != nil {
		test.Fatalf("unexpected error creating second collection: %v", err)
	}
	acrossCollections, err := vulpes.MoveItem(token, vulpesDtos.MoveItemInputDto{CollectionID: api.ID, ItemID: "folder", TargetCollectionID: other.ID, TargetIndex: -1})
	if err != nil || len(acrossCollections) != 2 || vulpesFunctions.FindItem(acrossCollections[1].Items, "folder") == nil || vulpesFunctions.FindItem(acrossCollections[0].Items, "folder") != nil {
		test.Fatalf("unexpected cross collection move: %v", err)
	}

	afterDelete, err := vulpes.DeleteItem(token, api.ID, requestResult.ItemID)
	if err != nil || vulpesFunctions.FindItem(afterDelete.Items, requestResult.ItemID) != nil {
		test.Fatalf("unexpected delete result: %v", err)
	}
	if _, err := vulpes.DeleteItem(token, api.ID, "missing"); err == nil {
		test.Fatalf("expected deleting a missing item to fail")
	}

	updated, err := vulpes.UpdateCollection(token, api.ID, vulpesDtos.CollectionInputDto{
		Name:        "API v2",
		Auth:        vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: "t"},
		Description: "docs",
	})
	if err != nil || updated.Name != "API v2" || updated.Auth.Token != "t" || len(updated.Variables) != 0 || updated.Description != "docs" {
		test.Fatalf("unexpected collection update: %+v %v", updated, err)
	}

	collections, err := vulpes.FindAllCollections(token)
	if err != nil || len(collections) != 2 || collections[0].Name != "API v2" {
		test.Fatalf("unexpected collections list: %+v %v", collections, err)
	}

	otherToken, _, _ := vulpes.Session.Create(2)
	if _, err := vulpes.SaveItem(otherToken, api.ID, *saved); err == nil {
		test.Fatalf("another user must not access the collection")
	}
	if err := vulpes.DeleteCollection(otherToken, api.ID); err == nil {
		test.Fatalf("another user must not delete the collection")
	}
	if err := vulpes.DeleteCollection(token, api.ID); err != nil {
		test.Fatalf("unexpected delete collection error: %v", err)
	}

	production, err := vulpes.CreateEnvironment(token, vulpesDtos.EnvironmentInputDto{Name: "Produção", Variables: []vulpesDtos.VariableDto{
		{Key: " token ", Value: "abc", Secret: true, Enabled: true},
		{Key: "", Value: ""},
	}})
	if err != nil || len(production.Variables) != 1 || production.Variables[0].Key != "token" {
		test.Fatalf("unexpected environment: %+v %v", production, err)
	}
	renamed, err := vulpes.UpdateEnvironment(token, production.ID, vulpesDtos.EnvironmentInputDto{Name: "Prod", Variables: []vulpesDtos.VariableDto{}})
	if err != nil || renamed.Name != "Prod" || len(renamed.Variables) != 0 {
		test.Fatalf("unexpected environment update: %+v %v", renamed, err)
	}
	environments, err := vulpes.FindAllEnvironments(token)
	if err != nil || len(environments) != 1 {
		test.Fatalf("unexpected environments list: %v", err)
	}
	if err := vulpes.DeleteEnvironment(token, production.ID); err != nil {
		test.Fatalf("unexpected environment delete error: %v", err)
	}
	if err := vulpes.DeleteEnvironment(token, production.ID); err == nil {
		test.Fatalf("expected deleting a missing environment to fail")
	}
}

func TestImportFromTextPersistsCollectionsAndEnvironments(test *testing.T) {
	environment := setupVulpesTest(test)

	result, err := environment.vulpes.ImportFromText(environment.token, `{
		"info": {"name": "Importada", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
		"item": [{"name": "Ping", "request": {"method": "GET", "url": "https://x.dev/ping"}, "response": [{}]}]
	}`)
	if err != nil || len(result.Collections) != 1 || len(result.Warnings) != 1 {
		test.Fatalf("unexpected collection import: %+v %v", result, err)
	}
	result, err = environment.vulpes.ImportFromText(environment.token, `{"name": "Dev", "values": [{"key": "a", "value": "1", "enabled": true}]}`)
	if err != nil || len(result.Environments) != 1 || result.Environments[0].Variables[0].Value != "1" {
		test.Fatalf("unexpected environment import: %+v %v", result, err)
	}
	if _, err := environment.vulpes.ImportFromText(environment.token, "  "); err == nil {
		test.Fatalf("expected empty import to fail")
	}

	collections, _ := environment.vulpes.FindAllCollections(environment.token)
	environments, _ := environment.vulpes.FindAllEnvironments(environment.token)
	if len(collections) != 1 || collections[0].Items[0].Name != "Ping" || len(environments) != 1 {
		test.Fatalf("imported data was not persisted")
	}
}

func TestSendHttpRequestUsesScopeVariablesAndInheritedAuth(test *testing.T) {
	environment := setupVulpesTest(test)

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/redirect":
			http.Redirect(writer, request, "/users/7", http.StatusFound)
		case "/binary":
			writer.Header().Set("Content-Type", "image/png")
			writer.Write([]byte{0x89, 'P', 'N', 'G', 0x00})
		case "/slow":
			time.Sleep(300 * time.Millisecond)
		default:
			time.Sleep(20 * time.Millisecond)
			body, _ := io.ReadAll(request.Body)
			http.SetCookie(writer, &http.Cookie{Name: "session", Value: "s1", Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
			writer.Header().Set("Content-Type", "application/json")
			json.NewEncoder(writer).Encode(map[string]string{
				"path":          request.URL.Path,
				"query":         request.URL.RawQuery,
				"method":        request.Method,
				"body":          string(body),
				"authorization": request.Header.Get("Authorization"),
				"userAgent":     request.Header.Get("User-Agent"),
			})
		}
	}))
	defer server.Close()

	collection, err := environment.vulpes.CreateCollection(environment.token, vulpesDtos.CollectionInputDto{
		Name:      "API",
		Variables: []vulpesDtos.VariableDto{{Key: "baseUrl", Value: "http://wrong", Enabled: true}, {Key: "userId", Value: "7", Enabled: true}},
	})
	if err != nil {
		test.Fatalf("unexpected collection error: %v", err)
	}
	folderAuth := vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: "{{token}}"}
	folder, err := environment.vulpes.CreateItem(environment.token, collection.ID, "", vulpesDtos.CollectionItemDto{Kind: vulpesDtos.ItemKindFolder, Name: "Usuários", Auth: &folderAuth})
	if err != nil {
		test.Fatalf("unexpected folder error: %v", err)
	}

	request := vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)
	request.Http.Method = "POST"
	request.Http.Url = "{{baseUrl}}/users/:id?verbose=true"
	request.Http.PathVariables = []vulpesDtos.KeyValueDto{{Key: "id", Value: "{{userId}}", Enabled: true}}
	request.Http.Body = vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyRaw, Language: "json", Raw: `{"id": {{userId}}}`}
	created, err := environment.vulpes.CreateItem(environment.token, collection.ID, folder.ItemID, requestItem("Atualizar", request))
	if err != nil {
		test.Fatalf("unexpected request error: %v", err)
	}

	stage, err := environment.vulpes.CreateEnvironment(environment.token, vulpesDtos.EnvironmentInputDto{Name: "Stage", Variables: []vulpesDtos.VariableDto{
		{Key: "baseUrl", Value: server.URL, Enabled: true},
		{Key: "token", Value: "env-token", Enabled: true},
	}})
	if err != nil {
		test.Fatalf("unexpected environment error: %v", err)
	}

	scope := vulpesDtos.ExecutionScopeDto{ItemID: created.ItemID, CollectionID: collection.ID, EnvironmentID: stage.ID}
	response, err := environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Scope: scope, Request: request})
	if err != nil {
		test.Fatalf("unexpected send error: %v", err)
	}
	var echoed map[string]string
	if err := json.Unmarshal([]byte(response.Body), &echoed); err != nil {
		test.Fatalf("unexpected response body %q: %v", response.Body, err)
	}
	if response.StatusCode != 200 || response.BodyEncoding != vulpesDtos.EncodingText || response.Method != "POST" {
		test.Fatalf("unexpected response: %+v", response)
	}
	if echoed["path"] != "/users/7" || echoed["query"] != "verbose=true" || echoed["body"] != `{"id": 7}` {
		test.Fatalf("variables were not resolved: %v", echoed)
	}
	if echoed["authorization"] != "Bearer env-token" || echoed["userAgent"] != vulpesFunctions.DefaultUserAgent {
		test.Fatalf("expected inherited folder auth with environment token: %v", echoed)
	}
	if len(response.Cookies) != 1 || response.Cookies[0].Name != "session" || !response.Cookies[0].HttpOnly || response.Cookies[0].SameSite != "Lax" {
		test.Fatalf("unexpected cookies: %+v", response.Cookies)
	}
	if response.Timings.TotalMs <= 0 || response.SizeBytes != int64(len(response.Body)) || len(response.RequestHeaders) == 0 || response.RequestHeaders[0].Key != "Host" {
		test.Fatalf("unexpected response metadata: %+v", response)
	}

	binaryRequest := vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)
	binaryRequest.Http.Url = server.URL + "/binary"
	binary, err := environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: binaryRequest})
	if err != nil || binary.BodyEncoding != vulpesDtos.EncodingBase64 || binary.Body != base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', 0x00}) {
		test.Fatalf("unexpected binary response: %+v %v", binary, err)
	}

	redirectRequest := vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)
	redirectRequest.Http.Url = server.URL + "/redirect"
	followed, err := environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: redirectRequest})
	if err != nil || followed.StatusCode != 200 || !strings.HasSuffix(followed.Url, "/users/7") {
		test.Fatalf("expected redirect to be followed: %+v %v", followed, err)
	}
	redirectRequest.Http.Settings.DisableRedirects = true
	notFollowed, err := environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: redirectRequest})
	if err != nil || notFollowed.StatusCode != http.StatusFound {
		test.Fatalf("expected redirect not to be followed: %+v %v", notFollowed, err)
	}

	slowRequest := vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)
	slowRequest.Http.Url = server.URL + "/slow"
	slowRequest.Http.Settings.TimeoutMs = 50
	if _, err := environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: slowRequest}); err == nil || !strings.Contains(err.Error(), "tempo limite") {
		test.Fatalf("expected timeout error, got %v", err)
	}

	cancelledContext, cancel := context.WithCancel(context.Background())
	cancel()
	slowRequest.Http.Settings.TimeoutMs = 0
	if _, err := environment.client.SendHttpRequest(cancelledContext, environment.token, vulpesDtos.ExecutionInputDto{Request: slowRequest}); err == nil || !strings.Contains(err.Error(), "cancelada") {
		test.Fatalf("expected cancellation error, got %v", err)
	}

	undefinedRequest := vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)
	undefinedRequest.Http.Url = "{{missing}}/x"
	if _, err := environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: undefinedRequest}); err == nil || !strings.Contains(err.Error(), "{{missing}}") {
		test.Fatalf("expected undefined variable error, got %v", err)
	}
}

func TestWebSocketSessionLifecycle(test *testing.T) {
	environment := setupVulpesTest(test)

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer ws-token" || request.URL.Query().Get("room") != "1" {
			http.Error(writer, "unauthorized", http.StatusUnauthorized)
			return
		}
		connection, err := websocket.Accept(writer, request, &websocket.AcceptOptions{Subprotocols: []string{"chat"}})
		if err != nil {
			return
		}
		defer connection.CloseNow()
		for {
			messageType, data, err := connection.Read(context.Background())
			if err != nil {
				return
			}
			if string(data) == "bye" {
				connection.Close(websocket.StatusGoingAway, "até logo")
				return
			}
			connection.Write(context.Background(), messageType, append([]byte("echo:"), data...))
		}
	}))
	defer server.Close()

	request := vulpesFunctions.NewRequest(vulpesDtos.ProtocolWebSocket)
	request.Auth = vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: "ws-token"}
	request.WebSocket.Url = strings.Replace(server.URL, "http://", "ws://", 1) + "/socket?room=1"
	request.WebSocket.Subprotocols = []string{"chat", " "}

	unauthorized := request
	unauthorized.Auth = vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
	if _, err := environment.client.ConnectWebSocket(context.Background(), environment.token, "tab-0", vulpesDtos.ExecutionInputDto{Request: unauthorized}); err == nil || !strings.Contains(err.Error(), "401") {
		test.Fatalf("expected the handshake to be refused, got %v", err)
	}

	callContext, cancelCall := context.WithCancel(context.Background())
	if _, err := environment.client.ConnectWebSocket(callContext, environment.token, "tab-1", vulpesDtos.ExecutionInputDto{Request: request}); err != nil {
		test.Fatalf("unexpected connect error: %v", err)
	}
	cancelCall()
	connected := environment.collector.waitFor(test, "connected", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeConnected })
	if connected.Event != "chat" {
		test.Fatalf("expected negotiated subprotocol, got %q", connected.Event)
	}

	if err := environment.client.SendWebSocketMessage(context.Background(), environment.token, "tab-1", vulpesDtos.RealtimeMessageInputDto{Data: "olá", Kind: "text"}); err != nil {
		test.Fatalf("unexpected send error: %v", err)
	}
	environment.collector.waitFor(test, "outgoing text", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Direction == vulpesDtos.DirectionOutgoing && event.Data == "olá"
	})
	environment.collector.waitFor(test, "echoed text", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Direction == vulpesDtos.DirectionIncoming && event.Data == "echo:olá"
	})

	if err := environment.client.SendWebSocketMessage(context.Background(), environment.token, "tab-1", vulpesDtos.RealtimeMessageInputDto{Data: "{invalid", Kind: "json"}); err == nil {
		test.Fatalf("expected invalid JSON to be rejected")
	}
	binaryPayload := base64.StdEncoding.EncodeToString([]byte{1, 2, 3})
	if err := environment.client.SendWebSocketMessage(context.Background(), environment.token, "tab-1", vulpesDtos.RealtimeMessageInputDto{Data: binaryPayload, Kind: "binary"}); err != nil {
		test.Fatalf("unexpected binary send error: %v", err)
	}
	environment.collector.waitFor(test, "echoed binary", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Direction == vulpesDtos.DirectionIncoming && event.Encoding == vulpesDtos.EncodingBase64 &&
			event.Data == base64.StdEncoding.EncodeToString(append([]byte("echo:"), 1, 2, 3))
	})

	if err := environment.client.SendWebSocketMessage(context.Background(), environment.token, "tab-1", vulpesDtos.RealtimeMessageInputDto{Data: "bye", Kind: "text"}); err != nil {
		test.Fatalf("unexpected send error: %v", err)
	}
	closed := environment.collector.waitFor(test, "server closure", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeClosed })
	if !strings.Contains(closed.Data, "1001") || !strings.Contains(closed.Data, "até logo") {
		test.Fatalf("unexpected closure message: %q", closed.Data)
	}

	if _, err := environment.client.ConnectWebSocket(context.Background(), environment.token, "tab-2", vulpesDtos.ExecutionInputDto{Request: request}); err != nil {
		test.Fatalf("unexpected reconnect error: %v", err)
	}
	environment.collector.waitFor(test, "second connection", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeConnected })
	if err := environment.client.CloseSession(context.Background(), environment.token, "tab-2"); err != nil {
		test.Fatalf("unexpected close error: %v", err)
	}
	clientClosed := environment.collector.waitFor(test, "client closure", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeClosed })
	if clientClosed.Data != "Desconectado" {
		test.Fatalf("unexpected client closure message: %q", clientClosed.Data)
	}
	if err := environment.client.SendWebSocketMessage(context.Background(), environment.token, "tab-2", vulpesDtos.RealtimeMessageInputDto{Data: "x"}); err != errSessionNotFound {
		test.Fatalf("expected closed session to be forgotten, got %v", err)
	}
}

func startSocketIoServer(test *testing.T, refuse bool) (*httptest.Server, chan string) {
	received := make(chan string, 32)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/socket.io/" || request.URL.Query().Get("EIO") != "4" || request.URL.Query().Get("transport") != "websocket" {
			http.Error(writer, "bad engine request", http.StatusBadRequest)
			return
		}
		connection, err := websocket.Accept(writer, request, nil)
		if err != nil {
			return
		}
		defer connection.CloseNow()
		ctx := context.Background()
		write := func(text string) { connection.Write(ctx, websocket.MessageText, []byte(text)) }

		write(`0{"sid":"engine-1","upgrades":[],"pingInterval":25000,"pingTimeout":20000}`)
		for {
			messageType, data, err := connection.Read(ctx)
			if err != nil {
				return
			}
			if messageType != websocket.MessageText {
				continue
			}
			text := string(data)
			received <- text
			switch {
			case strings.HasPrefix(text, "40/admin,"):
				if refuse {
					write(`44/admin,{"message":"não autorizado"}`)
					continue
				}
				write(`40/admin,{"sid":"socket-1"}`)
				write("2")
			case text == `42/admin,["hello",{"a":1}]`:
				write(`42/admin,["reply","ok",2]`)
				write(`42/other,["ignored"]`)
			case strings.HasPrefix(text, `42/admin,1["ask"`):
				write(`43/admin,1["answer"]`)
				write(`451-/admin,["file",{"_placeholder":true,"num":0}]`)
				connection.Write(ctx, websocket.MessageBinary, []byte{9, 8, 7})
			case text == "41/admin,":
				return
			}
		}
	}))
	return server, received
}

func TestSocketIoSessionProtocol(test *testing.T) {
	environment := setupVulpesTest(test)
	server, received := startSocketIoServer(test, false)
	defer server.Close()

	request := vulpesFunctions.NewRequest(vulpesDtos.ProtocolSocketIo)
	request.SocketIo.Url = server.URL + "/admin"
	request.SocketIo.HandshakeAuth = `{"token":"abc"}`

	callContext, cancelCall := context.WithCancel(context.Background())
	if _, err := environment.client.ConnectSocketIo(callContext, environment.token, "sio", vulpesDtos.ExecutionInputDto{Request: request}); err != nil {
		test.Fatalf("unexpected connect error: %v", err)
	}
	cancelCall()
	if connectPacket := <-received; connectPacket != `40/admin,{"token":"abc"}` {
		test.Fatalf("unexpected connect packet: %q", connectPacket)
	}
	connected := environment.collector.waitFor(test, "connected", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeConnected })
	if connected.Event != "engine-1" {
		test.Fatalf("unexpected engine sid: %q", connected.Event)
	}
	if pong := <-received; pong != "3" {
		test.Fatalf("expected pong after ping, got %q", pong)
	}

	if err := environment.client.EmitSocketIo(context.Background(), environment.token, "sio", vulpesDtos.SocketIoEmitInputDto{Event: "hello", Arguments: []string{`{"a":1}`}}); err != nil {
		test.Fatalf("unexpected emit error: %v", err)
	}
	reply := environment.collector.waitFor(test, "reply event", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Direction == vulpesDtos.DirectionIncoming && event.Kind == vulpesDtos.RealtimeMessage
	})
	if reply.Event != "reply" || reply.Data != `["ok",2]` || reply.HasAck {
		test.Fatalf("unexpected reply: %+v", reply)
	}

	if err := environment.client.EmitSocketIo(context.Background(), environment.token, "sio", vulpesDtos.SocketIoEmitInputDto{Event: "ask", WithAck: true}); err != nil {
		test.Fatalf("unexpected emit with ack error: %v", err)
	}
	outgoing := environment.collector.waitFor(test, "outgoing ask", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Direction == vulpesDtos.DirectionOutgoing && event.Event == "ask"
	})
	if !outgoing.HasAck || outgoing.AckID != 1 {
		test.Fatalf("expected ack id 1, got %+v", outgoing)
	}
	ack := environment.collector.waitFor(test, "ack", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeAck })
	if ack.AckID != 1 || ack.Data != `"answer"` {
		test.Fatalf("unexpected ack: %+v", ack)
	}
	binary := environment.collector.waitFor(test, "binary event", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Kind == vulpesDtos.RealtimeMessage && event.Event == "file"
	})
	if binary.Data != fmt.Sprintf("%q", base64.StdEncoding.EncodeToString([]byte{9, 8, 7})) {
		test.Fatalf("unexpected binary event data: %q", binary.Data)
	}

	if err := environment.client.EmitSocketIo(context.Background(), environment.token, "sio", vulpesDtos.SocketIoEmitInputDto{Event: " "}); err == nil {
		test.Fatalf("expected empty event to fail")
	}
	if err := environment.client.CloseSession(context.Background(), environment.token, "sio"); err != nil {
		test.Fatalf("unexpected close error: %v", err)
	}
	environment.collector.waitFor(test, "closed", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeClosed })
}

func TestSocketIoConnectErrorAndInvalidAuth(test *testing.T) {
	environment := setupVulpesTest(test)
	server, _ := startSocketIoServer(test, true)
	defer server.Close()

	request := vulpesFunctions.NewRequest(vulpesDtos.ProtocolSocketIo)
	request.SocketIo.Url = server.URL
	request.SocketIo.Namespace = "admin"
	_, err := environment.client.ConnectSocketIo(context.Background(), environment.token, "sio", vulpesDtos.ExecutionInputDto{Request: request})
	if err == nil || !strings.Contains(err.Error(), "não autorizado") {
		test.Fatalf("expected connect error from the server, got %v", err)
	}

	request.SocketIo.HandshakeAuth = `["not","object"]`
	if _, err := environment.client.ConnectSocketIo(context.Background(), environment.token, "sio", vulpesDtos.ExecutionInputDto{Request: request}); err == nil {
		test.Fatalf("expected non-object handshake auth to fail")
	}
}

func startGrpcServer(test *testing.T) string {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		test.Fatalf("unexpected listen error: %v", err)
	}
	server := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("shop", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(server, healthServer)
	reflection.Register(server)
	go server.Serve(listener)
	test.Cleanup(server.Stop)
	return listener.Addr().String()
}

func TestGrpcReflectionUnaryAndStreaming(test *testing.T) {
	environment := setupVulpesTest(test)
	address := startGrpcServer(test)

	request := vulpesFunctions.NewRequest(vulpesDtos.ProtocolGrpc)
	request.Grpc.Url = "grpc://" + address
	request.Grpc.Metadata = []vulpesDtos.KeyValueDto{{Key: "X-Tenant", Value: "loja", Enabled: true}}

	services, err := environment.client.ListGrpcServices(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: request})
	if err != nil {
		test.Fatalf("unexpected list error: %v", err)
	}
	var healthService *vulpesDtos.GrpcServiceDto
	for index := range services {
		if strings.Contains(services[index].Name, "ServerReflection") {
			test.Fatalf("reflection services must be hidden")
		}
		if services[index].Name == "grpc.health.v1.Health" {
			healthService = &services[index]
		}
	}
	if healthService == nil {
		test.Fatalf("expected the health service, got %+v", services)
	}
	methods := map[string]vulpesDtos.GrpcMethodDto{}
	for _, method := range healthService.Methods {
		methods[method.Name] = method
	}
	if methods["Check"].ServerStreaming || !methods["Watch"].ServerStreaming || methods["Check"].FullName != "grpc.health.v1.Health/Check" {
		test.Fatalf("unexpected methods: %+v", methods)
	}
	if !strings.Contains(methods["Check"].ExampleMessage, `"service"`) {
		test.Fatalf("unexpected example message: %s", methods["Check"].ExampleMessage)
	}

	request.Grpc.Method = "grpc.health.v1.Health/Check"
	request.Grpc.Message = `{"service": "shop"}`
	response, err := environment.client.InvokeGrpc(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: request})
	if err != nil {
		test.Fatalf("unexpected invoke error: %v", err)
	}
	if response.Code != "OK" || !strings.Contains(response.Message, "SERVING") || response.DurationMs < 0 {
		test.Fatalf("unexpected unary response: %+v", response)
	}

	request.Grpc.Message = `{"service": "missing"}`
	notFound, err := environment.client.InvokeGrpc(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: request})
	if err != nil || notFound.Code != "NotFound" || notFound.Message != "" {
		test.Fatalf("expected NotFound status in the response, got %+v %v", notFound, err)
	}

	request.Grpc.Message = `{"unknownField": 1}`
	if _, err := environment.client.InvokeGrpc(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: request}); err == nil {
		test.Fatalf("expected an invalid message to fail")
	}

	request.Grpc.Method = "grpc.health.v1.Health/Watch"
	request.Grpc.Message = `{"service": "shop"}`
	if _, err := environment.client.InvokeGrpc(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: request}); err == nil {
		test.Fatalf("expected unary invoke of a streaming method to fail")
	}
	callContext, cancelCall := context.WithCancel(context.Background())
	if err := environment.client.StartGrpcStream(callContext, environment.token, "stream", vulpesDtos.ExecutionInputDto{Request: request}); err != nil {
		test.Fatalf("unexpected stream error: %v", err)
	}
	cancelCall()
	environment.collector.waitFor(test, "outgoing message", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Direction == vulpesDtos.DirectionOutgoing && strings.Contains(event.Data, "shop")
	})
	environment.collector.waitFor(test, "streamed status", func(event vulpesDtos.RealtimeEventDto) bool {
		return event.Direction == vulpesDtos.DirectionIncoming && event.Kind == vulpesDtos.RealtimeMessage && strings.Contains(event.Data, "SERVING")
	})
	if err := environment.client.SendGrpcStreamMessage(context.Background(), environment.token, "stream", "{}"); err == nil {
		test.Fatalf("expected sending after the server-streaming request to fail")
	}
	if err := environment.client.CloseSession(context.Background(), environment.token, "stream"); err != nil {
		test.Fatalf("unexpected close error: %v", err)
	}
	closed := environment.collector.waitFor(test, "stream closed", func(event vulpesDtos.RealtimeEventDto) bool { return event.Kind == vulpesDtos.RealtimeClosed })
	if closed.Event != "Canceled" {
		test.Fatalf("expected Canceled status, got %+v", closed)
	}

	request.Grpc.Url = "grpc://127.0.0.1:1"
	if _, err := environment.client.ListGrpcServices(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: request}); err == nil {
		test.Fatalf("expected an unreachable server to fail")
	}
}
