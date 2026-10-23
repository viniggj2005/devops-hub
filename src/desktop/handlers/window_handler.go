package desktopHandlers

import (
	"context"
	"errors"
	"fmt"
	"sync"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/desktop"
	desktopDtos "docker-manager-go/src/desktop/dtos"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	tabStripHeight     = 56
	tabAttachEvent     = "app:tab-attach"
	tabDropHoverEvent  = "app:tab-drop-hover"
	moduleWindowPrefix = "module-"
)

var detachableModules = map[string]bool{
	"docker":      true,
	"vulpes":      true,
	"octohub":     true,
	"talpadb":     true,
	"settings":    true,
	"ferretshell": true,
}

type WindowHandlerStruct struct {
	Session       *auth.ManagerStruct
	hoverMutex    sync.Mutex
	openWindow    func(options application.WebviewWindowOptions)
	listWindows   func() []desktop.TabWindow
	notifyWindow  func(windowName string, name string, data any)
	hoveredWindow string
}

func NewWindowHandler(session *auth.ManagerStruct) *WindowHandlerStruct {
	return &WindowHandlerStruct{
		Session:      session,
		openWindow:   desktop.OpenWindow,
		listWindows:  desktop.OpenWindows,
		notifyWindow: desktop.EmitToWindow,
	}
}

func (handlerStruct *WindowHandlerStruct) DetachModule(ctx context.Context, token string, input desktopDtos.DetachModuleInputDto) error {
	if err := validateModule(input.Module); err != nil {
		return err
	}
	if handlerStruct.openWindow == nil {
		return errors.New("abertura de janelas indisponível")
	}

	windowName := moduleWindowPrefix + uuid.NewString()
	if err := handlerStruct.Session.OfferToWindow(windowName, token); err != nil {
		return err
	}

	handlerStruct.openWindow(desktop.ModuleWindowOptions(windowName, input.Module, desktop.WindowPlacement{
		ScreenX: input.ScreenX,
		ScreenY: input.ScreenY,
		Origin:  desktop.CallingWindow(ctx),
	}))
	return nil
}

func (handlerStruct *WindowHandlerStruct) PreviewTabDrop(ctx context.Context, point desktopDtos.ScreenPointDto) bool {
	target := handlerStruct.dropTarget(desktop.CallingWindowName(ctx), point.ScreenX, point.ScreenY)
	if target == nil {
		handlerStruct.setHoveredWindow("")
		return false
	}
	handlerStruct.setHoveredWindow(target.Name())
	return true
}

func (handlerStruct *WindowHandlerStruct) ClearTabDropPreview() {
	handlerStruct.setHoveredWindow("")
}

func (handlerStruct *WindowHandlerStruct) DropModule(ctx context.Context, token string, input desktopDtos.DropModuleInputDto) (desktopDtos.TabDropResultDto, error) {
	defer handlerStruct.setHoveredWindow("")
	if err := validateModule(input.Module); err != nil {
		return desktopDtos.TabDropResultDto{}, err
	}

	if target := handlerStruct.dropTarget(desktop.CallingWindowName(ctx), input.ScreenX, input.ScreenY); target != nil {
		if _, err := handlerStruct.Session.Validate(token); err != nil {
			return desktopDtos.TabDropResultDto{}, err
		}
		handlerStruct.attach(target, input.Module)
		return desktopDtos.TabDropResultDto{Outcome: desktopDtos.TabDropAttached}, nil
	}

	if !input.AllowNewWindow {
		return desktopDtos.TabDropResultDto{Outcome: desktopDtos.TabDropIgnored}, nil
	}
	if err := handlerStruct.DetachModule(ctx, token, desktopDtos.DetachModuleInputDto{
		Module:  input.Module,
		ScreenX: input.ScreenX,
		ScreenY: input.ScreenY,
	}); err != nil {
		return desktopDtos.TabDropResultDto{}, err
	}
	return desktopDtos.TabDropResultDto{Outcome: desktopDtos.TabDropDetached}, nil
}

func (handlerStruct *WindowHandlerStruct) MoveModuleToMainWindow(token string, module string) error {
	if err := validateModule(module); err != nil {
		return err
	}
	if _, err := handlerStruct.Session.Validate(token); err != nil {
		return err
	}
	for _, window := range handlerStruct.listWindows() {
		if window.Name() == desktop.MainWindowName {
			handlerStruct.attach(window, module)
			return nil
		}
	}
	return errors.New("a janela principal não está aberta")
}

func (handlerStruct *WindowHandlerStruct) attach(target desktop.TabWindow, module string) {
	handlerStruct.notifyWindow(target.Name(), tabAttachEvent, desktopDtos.AttachedTabDto{Module: module})
	target.Focus()
}

func (handlerStruct *WindowHandlerStruct) dropTarget(sourceWindow string, screenX int, screenY int) desktop.TabWindow {
	for _, window := range handlerStruct.listWindows() {
		if window.Name() == sourceWindow || window.IsMinimised() || !window.IsVisible() {
			continue
		}
		bounds := window.Bounds()
		insideHorizontally := screenX >= bounds.X && screenX < bounds.X+bounds.Width
		insideTabStrip := screenY >= bounds.Y && screenY < bounds.Y+tabStripHeight
		if insideHorizontally && insideTabStrip {
			return window
		}
	}
	return nil
}

func (handlerStruct *WindowHandlerStruct) setHoveredWindow(windowName string) {
	handlerStruct.hoverMutex.Lock()
	previousWindow := handlerStruct.hoveredWindow
	handlerStruct.hoveredWindow = windowName
	handlerStruct.hoverMutex.Unlock()

	if previousWindow != "" && previousWindow != windowName {
		handlerStruct.notifyWindow(previousWindow, tabDropHoverEvent, false)
	}
	if windowName != "" {
		handlerStruct.notifyWindow(windowName, tabDropHoverEvent, true)
	}
}

func validateModule(module string) error {
	if !detachableModules[module] {
		return fmt.Errorf("o módulo %q não pode ser aberto em outra janela", module)
	}
	return nil
}
