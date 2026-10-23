package desktop

import (
	"context"
	"errors"
	"net/url"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestScopedKeys(test *testing.T) {
	key := ScopedKey("module-1", "session-9")
	if key != "module-1/session-9" {
		test.Fatalf("unexpected scoped key %q", key)
	}
	if !IsScopedTo(key, "module-1") {
		test.Fatalf("expected key to belong to module-1")
	}
	if IsScopedTo(key, "module") {
		test.Fatalf("expected a window name prefix not to match a different window")
	}
	if IsScopedTo(ScopedKey("main", "session-9"), "module-1") {
		test.Fatalf("expected key of another window not to match")
	}
}

func TestCallingWindowName(test *testing.T) {
	if CallingWindowName(nil) != "" {
		test.Fatalf("expected empty window name for nil context")
	}
	if CallingWindowName(context.Background()) != "" {
		test.Fatalf("expected empty window name without window information")
	}
	if name := CallingWindowName(WithWindowName(context.Background(), "module-7")); name != "module-7" {
		test.Fatalf("expected module-7, got %q", name)
	}
	if CallingWindow(context.Background()) != nil {
		test.Fatalf("expected no calling window without window information")
	}
}

func TestWindowClosedListeners(test *testing.T) {
	var closedWindows []string
	OnWindowClosed(func(windowName string) {
		closedWindows = append(closedWindows, windowName)
	})

	notifyWindowClosed("module-3")

	if len(closedWindows) != 1 || closedWindows[0] != "module-3" {
		test.Fatalf("expected listener to receive module-3, got %v", closedWindows)
	}
}

func TestModuleMovedListeners(test *testing.T) {
	var moves []string
	OnModuleMoved(func(module string, fromWindow string, toWindow string) {
		moves = append(moves, module+":"+fromWindow+"->"+toWindow)
	})

	NotifyModuleMoved("ferretshell", "main", "module-4")
	NotifyModuleMoved("ferretshell", "main", "main")

	if len(moves) != 1 || moves[0] != "ferretshell:main->module-4" {
		test.Fatalf("expected a single move notification to module-4, got %v", moves)
	}
}

func TestIgnoreCancellation(test *testing.T) {
	if path, err := ignoreCancellation("", errors.New(dialogCancelledMessage)); path != "" || err != nil {
		test.Fatalf("expected cancellation to become an empty selection, got %q, %v", path, err)
	}
	if _, err := ignoreCancellation("", errors.New("acesso negado")); err == nil {
		test.Fatalf("expected real dialog errors to be preserved")
	}
	if path, err := ignoreCancellation("C:/repo", nil); path != "C:/repo" || err != nil {
		test.Fatalf("expected selection to pass through, got %q, %v", path, err)
	}
	if _, err := ChooseFile(context.Background(), FileDialogOptions{}); err == nil {
		test.Fatalf("expected dialogs to be unavailable without a running application")
	}
}

func TestWindowOptions(test *testing.T) {
	mainOptions := MainWindowOptions()
	if mainOptions.Name != MainWindowName || mainOptions.URL != "/" || !mainOptions.Frameless {
		test.Fatalf("unexpected main window options: %+v", mainOptions)
	}
	if mainOptions.StartState != application.WindowStateMaximised {
		test.Fatalf("expected main window to start maximised")
	}

	centered := ModuleWindowOptions("module-1", "talpadb", WindowPlacement{})
	parsedURL, err := url.Parse(centered.URL)
	if err != nil || parsedURL.Path != "/" || parsedURL.Query().Get("module") != "talpadb" {
		test.Fatalf("unexpected module window URL %q", centered.URL)
	}
	if centered.Name != "module-1" || centered.InitialPosition != application.WindowCentered {
		test.Fatalf("expected a centered window named module-1, got %+v", centered)
	}

	dropped := ModuleWindowOptions("module-2", "docker", WindowPlacement{ScreenX: -600, ScreenY: 300})
	if dropped.InitialPosition != application.WindowXY {
		test.Fatalf("expected a window positioned at the drop point")
	}
	if dropped.X != -600-cursorOffsetX || dropped.Y != 300-cursorOffsetY {
		test.Fatalf("expected the window to follow the cursor on secondary monitors, got %d,%d", dropped.X, dropped.Y)
	}
}
