package ferretshellHandlers

import (
	"context"
	"docker-manager-go/src/desktop"
	ferretShellDtos "docker-manager-go/src/ferretshell/dtos"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"

	"github.com/aymanbagabas/go-pty"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type localTerminal struct {
	console        pty.Pty
	command        *pty.Cmd
	closeOnce      sync.Once
	closedByClient atomic.Bool
}

func (terminal *localTerminal) closeConsole() {
	terminal.closeOnce.Do(func() {
		_ = terminal.console.Close()
	})
}

type LocalTerminalHandlerStruct struct {
	shells      map[string]localShell
	sessions    sync.Map
	shellsMutex sync.RWMutex
}

func NewLocalTerminalHandler() *LocalTerminalHandlerStruct {
	return &LocalTerminalHandlerStruct{shells: map[string]localShell{}}
}

func (handlerStruct *LocalTerminalHandlerStruct) ServiceStartup(_ context.Context, _ application.ServiceOptions) error {
	desktop.OnWindowClosed(handlerStruct.releaseWindowResources)
	return nil
}

func (handlerStruct *LocalTerminalHandlerStruct) releaseWindowResources(windowName string) {
	handlerStruct.sessions.Range(func(key, _ any) bool {
		if sessionKey := key.(string); desktop.IsScopedTo(sessionKey, windowName) {
			handlerStruct.disconnect(sessionKey)
		}
		return true
	})
}

func (handlerStruct *LocalTerminalHandlerStruct) ListShells() []ferretShellDtos.LocalShellDto {
	detectedShells := detectLocalShells()

	shellsById := make(map[string]localShell, len(detectedShells))
	descriptions := make([]ferretShellDtos.LocalShellDto, 0, len(detectedShells))
	for _, shell := range detectedShells {
		shellsById[shell.description.Id] = shell
		descriptions = append(descriptions, shell.description)
	}

	handlerStruct.shellsMutex.Lock()
	handlerStruct.shells = shellsById
	handlerStruct.shellsMutex.Unlock()

	return descriptions
}

func (handlerStruct *LocalTerminalHandlerStruct) findShell(shellId string) (localShell, bool) {
	handlerStruct.shellsMutex.RLock()
	shell, found := handlerStruct.shells[shellId]
	handlerStruct.shellsMutex.RUnlock()
	if found {
		return shell, true
	}

	handlerStruct.ListShells()

	handlerStruct.shellsMutex.RLock()
	defer handlerStruct.shellsMutex.RUnlock()
	shell, found = handlerStruct.shells[shellId]
	return shell, found
}

func (handlerStruct *LocalTerminalHandlerStruct) Start(ctx context.Context, startDto ferretShellDtos.LocalTerminalStartDto) error {
	shell, found := handlerStruct.findShell(startDto.ShellId)
	if !found {
		return fmt.Errorf("terminal local '%s' não encontrado", startDto.ShellId)
	}

	windowName := desktop.CallingWindowName(ctx)
	sessionKey := desktop.ScopedKey(windowName, startDto.SessionId)
	handlerStruct.disconnect(sessionKey)

	console, ptyError := pty.New()
	if ptyError != nil {
		return ptyError
	}

	if startDto.Cols > 0 && startDto.Rows > 0 {
		_ = console.Resize(startDto.Cols, startDto.Rows)
	}

	command := console.Command(shell.path, shell.arguments...)
	command.Env = append(os.Environ(), "TERM=xterm-256color", "COLORTERM=truecolor")
	if homeDirectory, homeError := os.UserHomeDir(); homeError == nil {
		command.Dir = homeDirectory
	}

	if startError := command.Start(); startError != nil {
		_ = console.Close()
		return startError
	}

	terminal := &localTerminal{command: command, console: console}
	handlerStruct.sessions.Store(sessionKey, terminal)

	readerDone := make(chan struct{})
	go pipeConsoleOutput(console, windowName, fmt.Sprintf("local:data:%s", startDto.SessionId), readerDone)

	go func() {
		waitError := command.Wait()
		terminal.closeConsole()
		<-readerDone

		handlerStruct.sessions.CompareAndDelete(sessionKey, terminal)
		if terminal.closedByClient.Load() {
			return
		}
		desktop.EmitToWindow(windowName, fmt.Sprintf("local:exit:%s", startDto.SessionId), describeLocalExit(command, waitError))
	}()

	return nil
}

func pipeConsoleOutput(console pty.Pty, windowName string, eventName string, readerDone chan<- struct{}) {
	defer close(readerDone)
	buffer := make([]byte, 8192)
	for {
		bytesRead, readError := console.Read(buffer)
		if bytesRead > 0 {
			desktop.EmitToWindow(windowName, eventName, string(buffer[:bytesRead]))
		}
		if readError != nil {
			return
		}
	}
}

func describeLocalExit(command *pty.Cmd, waitError error) string {
	if waitError != nil {
		return fmt.Sprintf("processo encerrado: %s", waitError.Error())
	}
	if command.ProcessState != nil && command.ProcessState.ExitCode() != 0 {
		return fmt.Sprintf("sessão finalizada com código %d", command.ProcessState.ExitCode())
	}
	return "sessão finalizada"
}

func (handlerStruct *LocalTerminalHandlerStruct) getSession(sessionKey string) (*localTerminal, bool) {
	value, found := handlerStruct.sessions.Load(sessionKey)
	if !found {
		return nil, false
	}
	return value.(*localTerminal), true
}

func (handlerStruct *LocalTerminalHandlerStruct) Send(ctx context.Context, sessionId string, data string) error {
	terminal, found := handlerStruct.getSession(desktop.ScopedKey(desktop.CallingWindowName(ctx), sessionId))
	if !found {
		return errors.New("sessão não encontrada")
	}
	_, writeError := terminal.console.Write([]byte(data))
	return writeError
}

func (handlerStruct *LocalTerminalHandlerStruct) Resize(ctx context.Context, sessionId string, cols, rows int) error {
	terminal, found := handlerStruct.getSession(desktop.ScopedKey(desktop.CallingWindowName(ctx), sessionId))
	if !found {
		return errors.New("sessão não encontrada")
	}
	return terminal.console.Resize(cols, rows)
}

func (handlerStruct *LocalTerminalHandlerStruct) Disconnect(ctx context.Context, sessionId string) {
	handlerStruct.disconnect(desktop.ScopedKey(desktop.CallingWindowName(ctx), sessionId))
}

func (handlerStruct *LocalTerminalHandlerStruct) disconnect(sessionKey string) {
	terminal, found := handlerStruct.getSession(sessionKey)
	if !found {
		return
	}

	terminal.closedByClient.Store(true)
	handlerStruct.sessions.CompareAndDelete(sessionKey, terminal)

	if terminal.command.Process != nil {
		_ = terminal.command.Process.Kill()
	}
	terminal.closeConsole()
}
