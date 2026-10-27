package vulpesHandlers

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"docker-manager-go/src/desktop"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const realtimeEventPrefix = "vulpes:realtime:"

var errSessionNotFound = errors.New("conexão não encontrada; conecte novamente")

var protoFilesFilter = desktop.FileFilter{DisplayName: "Protocol Buffers (*.proto)", Pattern: "*.proto"}

type realtimeSession interface {
	close()
}

type transportPair struct {
	secure   *http.Transport
	insecure *http.Transport
}

func newTransportPair(allowHttp2 bool) transportPair {
	build := func(skipVerify bool) *http.Transport {
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: skipVerify}
		if !allowHttp2 {
			transport.ForceAttemptHTTP2 = false
			transport.TLSNextProto = map[string]func(string, *tls.Conn) http.RoundTripper{}
		}
		return transport
	}
	return transportPair{secure: build(false), insecure: build(true)}
}

func (pair transportPair) pick(skipVerify bool) *http.Transport {
	if skipVerify {
		return pair.insecure
	}
	return pair.secure
}

type VulpesClientHandlerStruct struct {
	vulpes            *VulpesHandlerStruct
	context           context.Context
	sessions          map[string]realtimeSession
	emitToWindow      func(windowName string, name string, data any)
	sessionsMutex     sync.Mutex
	httpTransports    transportPair
	upgradeTransports transportPair
}

func NewVulpesClientHandler(vulpesHandler *VulpesHandlerStruct) *VulpesClientHandlerStruct {
	return &VulpesClientHandlerStruct{
		vulpes:            vulpesHandler,
		sessions:          map[string]realtimeSession{},
		emitToWindow:      desktop.EmitToWindow,
		httpTransports:    newTransportPair(true),
		upgradeTransports: newTransportPair(false),
	}
}

func (handlerStruct *VulpesClientHandlerStruct) ServiceStartup(context context.Context, _ application.ServiceOptions) error {
	handlerStruct.context = context
	desktop.OnWindowClosed(handlerStruct.releaseWindowSessions)
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) ServiceShutdown() error {
	for _, session := range handlerStruct.detachSessions(func(string) bool { return true }) {
		session.close()
	}
	handlerStruct.httpTransports.secure.CloseIdleConnections()
	handlerStruct.httpTransports.insecure.CloseIdleConnections()
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) baseContext() context.Context {
	if handlerStruct.context != nil {
		return handlerStruct.context
	}
	return context.Background()
}

type executionPlan struct {
	auth         vulpesDtos.AuthDto
	userID       uint
	request      vulpesDtos.RequestDto
	resolver     *vulpesFunctions.VariableResolver
	cookieJar    *vulpesFunctions.CookieJar
	collectionID uint
}

func (plan *executionPlan) httpCookieJar() http.CookieJar {
	if plan.cookieJar == nil {
		return nil
	}
	return plan.cookieJar
}

func (handlerStruct *VulpesClientHandlerStruct) prepareExecution(token string, input vulpesDtos.ExecutionInputDto) (*executionPlan, error) {
	userID, err := handlerStruct.vulpes.authenticate(token)
	if err != nil {
		return nil, err
	}
	resolver, content, err := handlerStruct.vulpes.loadExecutionScope(userID, input.Scope)
	if err != nil {
		return nil, err
	}
	request := input.Request
	vulpesFunctions.NormalizeRequest(&request)
	plan := &executionPlan{
		auth:         resolver.ResolveAuth(vulpesFunctions.EffectiveAuth(content, input.Scope.ItemID, request.Auth)),
		userID:       userID,
		request:      request,
		resolver:     resolver,
		collectionID: input.Scope.CollectionID,
	}
	if content != nil {
		plan.cookieJar = vulpesFunctions.NewCookieJar(content.Cookies)
	}
	return plan, nil
}

func (handlerStruct *VulpesClientHandlerStruct) persistReceivedCookies(plan *executionPlan) *[]vulpesDtos.CookieDto {
	if plan.cookieJar == nil {
		return nil
	}
	changes := plan.cookieJar.Changes()
	if len(changes) == 0 {
		return nil
	}
	cookies, err := handlerStruct.vulpes.storeReceivedCookies(plan.userID, plan.collectionID, changes)
	if err != nil {
		return nil
	}
	return cookies
}

func requestHeaders(entries []vulpesDtos.KeyValueDto, auth vulpesFunctions.AuthEntries) http.Header {
	headers := http.Header{}
	for _, entry := range entries {
		if key := strings.TrimSpace(entry.Key); entry.Enabled && key != "" {
			headers.Add(key, entry.Value)
		}
	}
	for _, entry := range auth.Headers {
		if headers.Get(entry.Key) == "" {
			headers.Set(entry.Key, entry.Value)
		}
	}
	if headers.Get("User-Agent") == "" {
		headers.Set("User-Agent", vulpesFunctions.DefaultUserAgent)
	}
	return headers
}

func (handlerStruct *VulpesClientHandlerStruct) sessionKey(callContext context.Context, sessionID string) (string, string) {
	windowName := desktop.CallingWindowName(callContext)
	return desktop.ScopedKey(windowName, sessionID), windowName
}

func (handlerStruct *VulpesClientHandlerStruct) eventEmitter(windowName string, sessionID string) func(vulpesDtos.RealtimeEventDto) {
	eventName := realtimeEventPrefix + sessionID
	return func(event vulpesDtos.RealtimeEventDto) {
		if event.Timestamp == 0 {
			event.Timestamp = time.Now().UnixMilli()
		}
		if event.Encoding == "" {
			event.Encoding = vulpesDtos.EncodingText
		}
		if event.SizeBytes == 0 {
			event.SizeBytes = len(event.Data)
		}
		handlerStruct.emitToWindow(windowName, eventName, event)
	}
}

func (handlerStruct *VulpesClientHandlerStruct) registerSession(key string, session realtimeSession) {
	handlerStruct.sessionsMutex.Lock()
	previous := handlerStruct.sessions[key]
	handlerStruct.sessions[key] = session
	handlerStruct.sessionsMutex.Unlock()
	if previous != nil {
		previous.close()
	}
}

func (handlerStruct *VulpesClientHandlerStruct) forgetSession(key string, session realtimeSession) {
	handlerStruct.sessionsMutex.Lock()
	defer handlerStruct.sessionsMutex.Unlock()
	if handlerStruct.sessions[key] == session {
		delete(handlerStruct.sessions, key)
	}
}

func (handlerStruct *VulpesClientHandlerStruct) findSession(key string) realtimeSession {
	handlerStruct.sessionsMutex.Lock()
	defer handlerStruct.sessionsMutex.Unlock()
	return handlerStruct.sessions[key]
}

func (handlerStruct *VulpesClientHandlerStruct) detachSessions(matches func(key string) bool) []realtimeSession {
	handlerStruct.sessionsMutex.Lock()
	defer handlerStruct.sessionsMutex.Unlock()
	detached := []realtimeSession{}
	for key, session := range handlerStruct.sessions {
		if matches(key) {
			detached = append(detached, session)
			delete(handlerStruct.sessions, key)
		}
	}
	return detached
}

func (handlerStruct *VulpesClientHandlerStruct) releaseWindowSessions(windowName string) {
	for _, session := range handlerStruct.detachSessions(func(key string) bool { return desktop.IsScopedTo(key, windowName) }) {
		session.close()
	}
}

func (handlerStruct *VulpesClientHandlerStruct) CloseSession(callContext context.Context, token string, sessionID string) error {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return err
	}
	key, _ := handlerStruct.sessionKey(callContext, sessionID)
	for _, session := range handlerStruct.detachSessions(func(candidate string) bool { return candidate == key }) {
		session.close()
	}
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) CloseAllSessions(callContext context.Context, token string) error {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return err
	}
	handlerStruct.releaseWindowSessions(desktop.CallingWindowName(callContext))
	return nil
}

func (handlerStruct *VulpesClientHandlerStruct) ChooseRequestFile(callContext context.Context, token string) (string, error) {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return "", err
	}
	return desktop.ChooseFile(callContext, desktop.FileDialogOptions{
		Title:   "Selecionar arquivo",
		Filters: []desktop.FileFilter{allFilesFilter},
	})
}

func (handlerStruct *VulpesClientHandlerStruct) ChooseProtoFiles(callContext context.Context, token string) ([]string, error) {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return nil, err
	}
	paths, err := desktop.ChooseFiles(callContext, desktop.FileDialogOptions{
		Title:   "Selecionar arquivos .proto",
		Filters: []desktop.FileFilter{protoFilesFilter, allFilesFilter},
	})
	if paths == nil {
		paths = []string{}
	}
	return paths, err
}

func (handlerStruct *VulpesClientHandlerStruct) ChooseImportPath(callContext context.Context, token string) (string, error) {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return "", err
	}
	return desktop.ChooseDirectory(callContext, desktop.FileDialogOptions{Title: "Selecionar diretório de imports"})
}

func (handlerStruct *VulpesClientHandlerStruct) SaveResponseBody(callContext context.Context, token string, defaultFilename string, body string, encoding string) (string, error) {
	if _, err := handlerStruct.vulpes.authenticate(token); err != nil {
		return "", err
	}
	content := []byte(body)
	if encoding == vulpesDtos.EncodingBase64 {
		decoded, err := base64.StdEncoding.DecodeString(body)
		if err != nil {
			return "", fmt.Errorf("corpo da resposta inválido: %w", err)
		}
		content = decoded
	}

	path, err := desktop.ChooseSaveLocation(callContext, desktop.FileDialogOptions{
		Title:           "Salvar resposta",
		Filters:         []desktop.FileFilter{allFilesFilter},
		DefaultFilename: invalidFileChars.Replace(defaultFilename),
	})
	if err != nil || path == "" {
		return "", err
	}
	if filepath.Ext(path) == "" && filepath.Ext(defaultFilename) != "" {
		path += filepath.Ext(defaultFilename)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		return "", err
	}
	return path, nil
}
