package ferretshellHandlers

import (
	"context"
	ferretShellDtos "docker-manager-go/src/ferretshell/dtos"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"

	"github.com/aymanbagabas/go-pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	context     context.Context
	shellsMutex sync.RWMutex
	sessions    sync.Map
	shells      map[string]localShell
}

func NewLocalTerminalHandler() *LocalTerminalHandlerStruct {
	return &LocalTerminalHandlerStruct{shells: map[string]localShell{}}
}

func (handlerStruct *LocalTerminalHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
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

func (handlerStruct *LocalTerminalHandlerStruct) Start(startDto ferretShellDtos.LocalTerminalStartDto) error {
	shell, found := handlerStruct.findShell(startDto.ShellId)
	if !found {
		return fmt.Errorf("terminal local '%s' não encontrado", startDto.ShellId)
	}

	handlerStruct.Disconnect(startDto.SessionId)

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
	handlerStruct.sessions.Store(startDto.SessionId, terminal)

	readerDone := make(chan struct{})
	go handlerStruct.pipeConsoleOutput(console, fmt.Sprintf("local:data:%s", startDto.SessionId), readerDone)

	go func() {
		waitError := command.Wait()
		terminal.closeConsole()
		<-readerDone

		handlerStruct.sessions.CompareAndDelete(startDto.SessionId, terminal)
		if terminal.closedByClient.Load() {
			return
		}
		runtime.EventsEmit(handlerStruct.context, fmt.Sprintf("local:exit:%s", startDto.SessionId), describeLocalExit(command, waitError))
	}()

	return nil
}

func (handlerStruct *LocalTerminalHandlerStruct) pipeConsoleOutput(console pty.Pty, eventName string, readerDone chan<- struct{}) {
	defer close(readerDone)
	buffer := make([]byte, 8192)
	for {
		bytesRead, readError := console.Read(buffer)
		if bytesRead > 0 {
			runtime.EventsEmit(handlerStruct.context, eventName, string(buffer[:bytesRead]))
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

func (handlerStruct *LocalTerminalHandlerStruct) getSession(sessionId string) (*localTerminal, bool) {
	value, found := handlerStruct.sessions.Load(sessionId)
	if !found {
		return nil, false
	}
	return value.(*localTerminal), true
}

func (handlerStruct *LocalTerminalHandlerStruct) Send(sessionId string, data string) error {
	terminal, found := handlerStruct.getSession(sessionId)
	if !found {
		return errors.New("sessão não encontrada")
	}
	_, writeError := terminal.console.Write([]byte(data))
	return writeError
}

func (handlerStruct *LocalTerminalHandlerStruct) Resize(sessionId string, cols, rows int) error {
	terminal, found := handlerStruct.getSession(sessionId)
	if !found {
		return errors.New("sessão não encontrada")
	}
	return terminal.console.Resize(cols, rows)
}

func (handlerStruct *LocalTerminalHandlerStruct) Disconnect(sessionId string) {
	terminal, found := handlerStruct.getSession(sessionId)
	if !found {
		return
	}

	terminal.closedByClient.Store(true)
	handlerStruct.sessions.CompareAndDelete(sessionId, terminal)

	if terminal.command.Process != nil {
		_ = terminal.command.Process.Kill()
	}
	terminal.closeConsole()
}
