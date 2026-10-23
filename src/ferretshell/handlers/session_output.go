package ferretshellHandlers

import (
	"sync"

	"docker-manager-go/src/desktop"
)

const (
	ferretShellModule     = "ferretshell"
	maxPendingOutputBytes = 1 << 20
)

type sessionOutput struct {
	mutex     sync.Mutex
	window    string
	paused    bool
	pending   []byte
	sessionId string
	dataEvent string
}

func newSessionOutput(window string, sessionId string, dataEvent string) *sessionOutput {
	return &sessionOutput{window: window, sessionId: sessionId, dataEvent: dataEvent}
}

func (output *sessionOutput) owner() string {
	output.mutex.Lock()
	defer output.mutex.Unlock()
	return output.window
}

func (output *sessionOutput) key() string {
	return desktop.ScopedKey(output.owner(), output.sessionId)
}

func (output *sessionOutput) write(chunk []byte) {
	output.mutex.Lock()
	defer output.mutex.Unlock()
	if !output.paused {
		desktop.EmitToWindow(output.window, output.dataEvent, string(chunk))
		return
	}
	output.pending = append(output.pending, chunk...)
	if overflow := len(output.pending) - maxPendingOutputBytes; overflow > 0 {
		output.pending = output.pending[overflow:]
	}
}

func (output *sessionOutput) notify(eventName string, data string) {
	desktop.EmitToWindow(output.owner(), eventName, data)
}

func (output *sessionOutput) moveTo(window string) {
	output.mutex.Lock()
	defer output.mutex.Unlock()
	output.window = window
	output.paused = true
}

func (output *sessionOutput) resume() {
	output.mutex.Lock()
	defer output.mutex.Unlock()
	output.paused = false
	if len(output.pending) == 0 {
		return
	}
	desktop.EmitToWindow(output.window, output.dataEvent, string(output.pending))
	output.pending = nil
}

func moveWindowSessions(sessions *sync.Map, moveMutex *sync.Mutex, outputOf func(value any) *sessionOutput, fromWindow string, toWindow string) {
	moveMutex.Lock()
	defer moveMutex.Unlock()
	sessions.Range(func(key, value any) bool {
		if !desktop.IsScopedTo(key.(string), fromWindow) {
			return true
		}
		output := outputOf(value)
		sessions.Delete(key)
		output.moveTo(toWindow)
		sessions.Store(output.key(), value)
		return true
	})
}

func forgetSession(sessions *sync.Map, moveMutex *sync.Mutex, output *sessionOutput, value any) {
	moveMutex.Lock()
	defer moveMutex.Unlock()
	sessions.CompareAndDelete(output.key(), value)
}
