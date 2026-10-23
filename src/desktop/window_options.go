package desktop

import (
	"net/url"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	applicationTitle   = "Devops Hub"
	moduleWindowWidth  = 1280
	moduleWindowHeight = 800
	cursorOffsetX      = 140
	cursorOffsetY      = 18
)

type WindowPlacement struct {
	ScreenX int
	ScreenY int
	Origin  application.Window
}

func baseWindowOptions(name string, windowURL string) application.WebviewWindowOptions {
	return application.WebviewWindowOptions{
		Name:             name,
		Title:            applicationTitle,
		URL:              windowURL,
		Frameless:        true,
		BackgroundType:   application.BackgroundTypeTranslucent,
		BackgroundColour: application.RGBA{Red: 0, Green: 0, Blue: 0, Alpha: 0},
		Windows: application.WindowsWindow{
			BackdropType: application.Mica,
		},
	}
}

func OpenWindow(options application.WebviewWindowOptions) {
	if app := application.Get(); app != nil {
		app.Window.NewWithOptions(options)
	}
}

func MainWindowOptions() application.WebviewWindowOptions {
	options := baseWindowOptions(MainWindowName, "/")
	options.Width = 1024
	options.Height = 768
	options.StartState = application.WindowStateMaximised
	return options
}

func ModuleWindowOptions(name string, module string, placement WindowPlacement) application.WebviewWindowOptions {
	options := baseWindowOptions(name, "/?"+url.Values{"module": {module}}.Encode())
	options.Width = moduleWindowWidth
	options.Height = moduleWindowHeight

	if placement.ScreenX != 0 || placement.ScreenY != 0 {
		options.InitialPosition = application.WindowXY
		options.X = placement.ScreenX - cursorOffsetX
		options.Y = placement.ScreenY - cursorOffsetY
		return options
	}

	options.InitialPosition = application.WindowCentered
	if placement.Origin != nil {
		if screen, err := placement.Origin.GetScreen(); err == nil {
			options.Screen = screen
		}
	}
	return options
}
