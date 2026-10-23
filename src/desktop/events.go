package desktop

import "github.com/wailsapp/wails/v3/pkg/application"

func Broadcast(name string, data ...any) {
	if app := application.Get(); app != nil {
		app.Event.Emit(name, data...)
	}
}

func EmitToWindow(windowName string, name string, data any) {
	app := application.Get()
	if app == nil {
		return
	}
	if windowName == "" {
		app.Event.Emit(name, data)
		return
	}
	if window, exists := app.Window.GetByName(windowName); exists {
		window.DispatchWailsEvent(&application.CustomEvent{Name: name, Data: data})
	}
}
