package desktopHandlers

import (
	"context"
	"net/url"
	"strings"
	"testing"
	"time"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/desktop"
	desktopDtos "docker-manager-go/src/desktop/dtos"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestDetachModule(test *testing.T) {
	sessionManager := auth.NewManager(time.Hour)
	token, _, err := sessionManager.Create(5)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	var moves []string
	var openedWindows []application.WebviewWindowOptions
	handler := NewWindowHandler(sessionManager)
	handler.openWindow = func(options application.WebviewWindowOptions) {
		openedWindows = append(openedWindows, options)
	}
	handler.moveModule = func(module string, fromWindow string, toWindow string) {
		moves = append(moves, module+":"+fromWindow+"->"+toWindow)
	}

	if err := handler.DetachModule(context.Background(), token, desktopDtos.DetachModuleInputDto{Module: "home"}); err == nil {
		test.Fatalf("expected the home module to stay in the main window")
	}
	if err := handler.DetachModule(context.Background(), "invalid-token", desktopDtos.DetachModuleInputDto{Module: "docker"}); err == nil {
		test.Fatalf("expected an invalid token to be rejected")
	}
	if len(openedWindows) != 0 {
		test.Fatalf("expected no window to open for rejected requests, got %d", len(openedWindows))
	}

	if err := handler.DetachModule(context.Background(), token, desktopDtos.DetachModuleInputDto{Module: "talpadb", ScreenX: 900, ScreenY: 400}); err != nil {
		test.Fatalf("unexpected error detaching module: %v", err)
	}
	if len(openedWindows) != 1 {
		test.Fatalf("expected exactly one window, got %d", len(openedWindows))
	}

	options := openedWindows[0]
	if !strings.HasPrefix(options.Name, moduleWindowPrefix) {
		test.Fatalf("expected a module window name, got %q", options.Name)
	}
	parsedURL, err := url.Parse(options.URL)
	if err != nil || parsedURL.Query().Get("module") != "talpadb" {
		test.Fatalf("unexpected module window URL %q", options.URL)
	}
	if options.InitialPosition != application.WindowXY {
		test.Fatalf("expected the window to open where the tab was dropped")
	}

	windowToken, windowSession, err := sessionManager.ClaimForWindow(options.Name)
	if err != nil {
		test.Fatalf("expected the new window to claim its session: %v", err)
	}
	if windowToken == token || windowSession.UserID != 5 {
		test.Fatalf("expected a dedicated session for user 5, got token reuse=%v user=%d", windowToken == token, windowSession.UserID)
	}

	fromMainWindow := desktop.WithWindowName(context.Background(), "main")
	if err := handler.DetachModule(fromMainWindow, token, desktopDtos.DetachModuleInputDto{Module: "ferretshell", Handoff: `{"tabs":[]}`}); err != nil {
		test.Fatalf("unexpected error detaching ferretshell: %v", err)
	}
	ferretWindow := openedWindows[len(openedWindows)-1].Name
	if lastMove := moves[len(moves)-1]; lastMove != "ferretshell:main->"+ferretWindow {
		test.Fatalf("expected ferretshell to move from main to %s, got %q", ferretWindow, lastMove)
	}

	newWindowContext := desktop.WithWindowName(context.Background(), ferretWindow)
	if handoff := handler.ClaimModuleHandoff(newWindowContext); handoff != `{"tabs":[]}` {
		test.Fatalf("expected the new window to claim its handoff, got %q", handoff)
	}
	if handoff := handler.ClaimModuleHandoff(newWindowContext); handoff != "" {
		test.Fatalf("expected the handoff to be claimable only once, got %q", handoff)
	}

	if err := handler.DetachModule(fromMainWindow, token, desktopDtos.DetachModuleInputDto{Module: "ferretshell", Handoff: "abandoned"}); err != nil {
		test.Fatalf("unexpected error detaching ferretshell: %v", err)
	}
	abandonedWindow := openedWindows[len(openedWindows)-1].Name
	handler.discardHandoff(abandonedWindow)
	if handoff := handler.ClaimModuleHandoff(desktop.WithWindowName(context.Background(), abandonedWindow)); handoff != "" {
		test.Fatalf("expected a closed window to drop its handoff, got %q", handoff)
	}
}

type fakeTabWindow struct {
	name      string
	bounds    application.Rect
	minimised bool
	focused   bool
}

func (window *fakeTabWindow) Focus()                   { window.focused = true }
func (window *fakeTabWindow) Name() string             { return window.name }
func (window *fakeTabWindow) IsVisible() bool          { return true }
func (window *fakeTabWindow) IsMinimised() bool        { return window.minimised }
func (window *fakeTabWindow) Bounds() application.Rect { return window.bounds }

type sentWindowEvent struct {
	window string
	name   string
	data   any
}

type mergeFixture struct {
	moves         []string
	events        []sentWindowEvent
	openedWindows []application.WebviewWindowOptions
}

func setupMergeHandler(test *testing.T) (*WindowHandlerStruct, string, []*fakeTabWindow, *mergeFixture) {
	sessionManager := auth.NewManager(time.Hour)
	token, _, err := sessionManager.Create(9)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	windows := []*fakeTabWindow{
		{name: "main", bounds: application.Rect{X: 0, Y: 0, Width: 1200, Height: 800}},
		{name: "module-1", bounds: application.Rect{X: 1300, Y: 100, Width: 900, Height: 700}},
		{name: "module-2", bounds: application.Rect{X: 1300, Y: 100, Width: 900, Height: 700}, minimised: true},
	}
	fixture := &mergeFixture{}

	handler := NewWindowHandler(sessionManager)
	handler.listWindows = func() []desktop.TabWindow {
		tabWindows := make([]desktop.TabWindow, 0, len(windows))
		for _, window := range windows {
			tabWindows = append(tabWindows, window)
		}
		return tabWindows
	}
	handler.notifyWindow = func(windowName string, name string, data any) {
		fixture.events = append(fixture.events, sentWindowEvent{window: windowName, name: name, data: data})
	}
	handler.openWindow = func(options application.WebviewWindowOptions) {
		fixture.openedWindows = append(fixture.openedWindows, options)
	}
	handler.moveModule = func(module string, fromWindow string, toWindow string) {
		fixture.moves = append(fixture.moves, module+":"+fromWindow+"->"+toWindow)
	}
	return handler, token, windows, fixture
}

func TestDropModuleMergesIntoAnotherWindowTabStrip(test *testing.T) {
	handler, token, windows, fixture := setupMergeHandler(test)
	fromModuleWindow := desktop.WithWindowName(context.Background(), "module-1")

	if !handler.PreviewTabDrop(fromModuleWindow, desktopDtos.ScreenPointDto{ScreenX: 400, ScreenY: 20}) {
		test.Fatalf("expected the main window tab strip to be a drop target")
	}
	if handler.PreviewTabDrop(fromModuleWindow, desktopDtos.ScreenPointDto{ScreenX: 400, ScreenY: 300}) {
		test.Fatalf("expected the main window content area not to accept tabs")
	}
	if handler.PreviewTabDrop(fromModuleWindow, desktopDtos.ScreenPointDto{ScreenX: 1500, ScreenY: 120}) {
		test.Fatalf("expected the source window not to be its own drop target")
	}

	result, err := handler.DropModule(fromModuleWindow, token, desktopDtos.DropModuleInputDto{Module: "talpadb", ScreenX: 400, ScreenY: 20, Handoff: "state", AllowNewWindow: true})
	if err != nil || result.Outcome != desktopDtos.TabDropAttached {
		test.Fatalf("expected the tab to merge into the main window, got %+v, err=%v", result, err)
	}
	if !windows[0].focused || len(fixture.openedWindows) != 0 {
		test.Fatalf("expected the main window to receive focus without opening a new window")
	}
	if len(fixture.moves) != 1 || fixture.moves[0] != "talpadb:module-1->main" {
		test.Fatalf("expected the module to move from module-1 to main, got %v", fixture.moves)
	}

	var hoverStates []any
	var attachedTab desktopDtos.AttachedTabDto
	for _, event := range fixture.events {
		if event.window != "main" {
			test.Fatalf("expected events only for the main window, got %+v", event)
		}
		switch event.name {
		case tabDropHoverEvent:
			hoverStates = append(hoverStates, event.data)
		case tabAttachEvent:
			attachedTab = event.data.(desktopDtos.AttachedTabDto)
		}
	}
	if attachedTab.Module != "talpadb" || attachedTab.Handoff != "state" {
		test.Fatalf("expected the main window to receive the talpadb tab with its handoff, got %+v", attachedTab)
	}
	if len(hoverStates) != 2 || hoverStates[0] != true || hoverStates[1] != false {
		test.Fatalf("expected the drop highlight to turn on and off once, got %v", hoverStates)
	}
}

func TestDropModuleOutsideWindows(test *testing.T) {
	handler, token, windows, fixture := setupMergeHandler(test)
	fromMainWindow := desktop.WithWindowName(context.Background(), "main")

	ignored, err := handler.DropModule(fromMainWindow, token, desktopDtos.DropModuleInputDto{Module: "docker", ScreenX: 1500, ScreenY: 900})
	if err != nil || ignored.Outcome != desktopDtos.TabDropIgnored || len(fixture.openedWindows) != 0 || len(fixture.moves) != 0 {
		test.Fatalf("expected a drop on the desktop without new windows to be ignored, got %+v, err=%v", ignored, err)
	}

	detached, err := handler.DropModule(fromMainWindow, token, desktopDtos.DropModuleInputDto{Module: "docker", ScreenX: 1500, ScreenY: 900, Handoff: "state", AllowNewWindow: true})
	if err != nil || detached.Outcome != desktopDtos.TabDropDetached || len(fixture.openedWindows) != 1 {
		test.Fatalf("expected a drop on the desktop to open a new window, got %+v, err=%v", detached, err)
	}
	newWindow := fixture.openedWindows[0].Name
	if handoff := handler.ClaimModuleHandoff(desktop.WithWindowName(context.Background(), newWindow)); handoff != "state" {
		test.Fatalf("expected the detached window to receive the handoff, got %q", handoff)
	}

	windows[1].minimised = true
	if handler.PreviewTabDrop(fromMainWindow, desktopDtos.ScreenPointDto{ScreenX: 1500, ScreenY: 120}) {
		test.Fatalf("expected minimised windows not to accept tabs")
	}
}

func TestMoveModuleToMainWindow(test *testing.T) {
	handler, token, windows, fixture := setupMergeHandler(test)
	fromModuleWindow := desktop.WithWindowName(context.Background(), "module-1")

	if err := handler.MoveModuleToMainWindow(fromModuleWindow, "invalid-token", desktopDtos.MoveModuleInputDto{Module: "docker"}); err == nil {
		test.Fatalf("expected an invalid token to be rejected")
	}
	if err := handler.MoveModuleToMainWindow(fromModuleWindow, token, desktopDtos.MoveModuleInputDto{Module: "ferretshell", Handoff: "state"}); err != nil {
		test.Fatalf("unexpected error moving tab to the main window: %v", err)
	}
	if !windows[0].focused || len(fixture.events) != 1 || fixture.events[0].name != tabAttachEvent {
		test.Fatalf("expected the main window to receive and focus the tab, events=%+v", fixture.events)
	}
	if attachedTab := fixture.events[0].data.(desktopDtos.AttachedTabDto); attachedTab.Handoff != "state" {
		test.Fatalf("expected the handoff to travel with the tab, got %+v", attachedTab)
	}
	if len(fixture.moves) != 1 || fixture.moves[0] != "ferretshell:module-1->main" {
		test.Fatalf("expected ferretshell to move from module-1 to main, got %v", fixture.moves)
	}
}
