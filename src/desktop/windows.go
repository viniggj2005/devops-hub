package desktop

import (
	"context"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const MainWindowName = "main"

const windowScopeSeparator = "/"

type windowNameKey struct{}

type TabWindow interface {
	Focus()
	Name() string
	IsVisible() bool
	IsMinimised() bool
	Bounds() application.Rect
}

func OpenWindows() []TabWindow {
	app := application.Get()
	if app == nil {
		return nil
	}
	windows := app.Window.GetAll()
	tabWindows := make([]TabWindow, 0, len(windows))
	for _, window := range windows {
		tabWindows = append(tabWindows, window)
	}
	return tabWindows
}

var (
	closedListenersMutex sync.RWMutex
	closedListeners      []func(windowName string)
)

func CallingWindow(ctx context.Context) application.Window {
	if ctx == nil {
		return nil
	}
	window, _ := ctx.Value(application.WindowKey).(application.Window)
	return window
}

func WithWindowName(ctx context.Context, windowName string) context.Context {
	return context.WithValue(ctx, windowNameKey{}, windowName)
}

func CallingWindowName(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if windowName, ok := ctx.Value(windowNameKey{}).(string); ok {
		return windowName
	}
	if window := CallingWindow(ctx); window != nil {
		return window.Name()
	}
	return ""
}

func ScopedKey(windowName string, resourceID string) string {
	return windowName + windowScopeSeparator + resourceID
}

func IsScopedTo(key string, windowName string) bool {
	return strings.HasPrefix(key, windowName+windowScopeSeparator)
}

func OnWindowClosed(listener func(windowName string)) {
	closedListenersMutex.Lock()
	defer closedListenersMutex.Unlock()
	closedListeners = append(closedListeners, listener)
}

func TrackWindow(window application.Window) {
	windowName := window.Name()
	window.OnWindowEvent(events.Common.WindowClosing, func(*application.WindowEvent) {
		notifyWindowClosed(windowName)
	})
}

func notifyWindowClosed(windowName string) {
	closedListenersMutex.RLock()
	listeners := append([]func(string){}, closedListeners...)
	closedListenersMutex.RUnlock()

	for _, listener := range listeners {
		listener(windowName)
	}
}
