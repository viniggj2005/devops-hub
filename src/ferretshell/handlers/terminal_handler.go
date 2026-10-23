package ferretshellHandlers

import (
	"context"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/desktop"
	ferretShellDtos "docker-manager-go/src/ferretshell/dtos"
	"errors"
	"fmt"
	"io"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

type sshConnection struct {
	stdin          io.WriteCloser
	client         *ssh.Client
	session        *ssh.Session
	closedByClient atomic.Bool
}

type TerminalHandlerStruct struct {
	Session      *auth.ManagerStruct
	sshSessions  sync.Map
	SftpSessions sync.Map
}

func (handlerStruct *TerminalHandlerStruct) ServiceStartup(_ context.Context, _ application.ServiceOptions) error {
	desktop.OnWindowClosed(handlerStruct.releaseWindowResources)
	return nil
}

func NewTerminalHandler(session *auth.ManagerStruct) *TerminalHandlerStruct {
	return &TerminalHandlerStruct{
		Session: session}
}

func (handlerStruct *TerminalHandlerStruct) addSession(sessionKey string, connection *sshConnection) {
	handlerStruct.sshSessions.Store(sessionKey, connection)
}

func (handlerStruct *TerminalHandlerStruct) getSession(sessionKey string) (*sshConnection, bool) {
	value, ok := handlerStruct.sshSessions.Load(sessionKey)
	if !ok {
		return nil, false
	}
	return value.(*sshConnection), true
}

func (handlerStruct *TerminalHandlerStruct) releaseWindowResources(windowName string) {
	handlerStruct.sshSessions.Range(func(key, _ any) bool {
		if sessionKey := key.(string); desktop.IsScopedTo(sessionKey, windowName) {
			handlerStruct.disconnect(sessionKey)
		}
		return true
	})
}

func (handlerStruct *TerminalHandlerStruct) createSshClient(configure ferretShellDtos.SSHConnectionDto) (*ssh.Client, error) {
	var hostKeyCallBack ssh.HostKeyCallback
	if configure.KnownHostsPath != "" {
		callBack, err := knownhosts.New(configure.KnownHostsPath)
		if err != nil {
			return nil, err
		}
		hostKeyCallBack = callBack
	} else if configure.InsecureIgnoreHostKey {
		hostKeyCallBack = ssh.InsecureIgnoreHostKey()
	} else {
		return nil, errors.New("sem KnownHostsPath e InsecureIgnoreHostKey=false")
	}

	methods := []ssh.AuthMethod{}
	if len(configure.Key) > 0 || configure.KeyPath != "" {
		key := configure.Key
		if len(key) == 0 {
			documentInBytes, err := os.ReadFile(configure.KeyPath)
			if err != nil {
				return nil, err
			}
			key = documentInBytes
		}
		var signer ssh.Signer
		var err error
		if configure.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(key, []byte(configure.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(key)
		}
		if err != nil {
			return nil, err
		}
		methods = append(methods, ssh.PublicKeys(signer))
	} else if configure.Password != "" {
		methods = append(methods, ssh.Password(configure.Password))
	} else {
		return nil, errors.New("nenhum método de autenticação fornecido")
	}

	if configure.Timeout == 0 {
		configure.Timeout = 10 * time.Second
	}
	if configure.Port == 0 {
		configure.Port = 22
	}

	sshConfigure := &ssh.ClientConfig{
		User:            configure.User,
		Auth:            methods,
		HostKeyCallback: hostKeyCallBack,
		Timeout:         configure.Timeout,
	}

	address := fmt.Sprintf("%s:%d", configure.Host, configure.Port)
	return ssh.Dial("tcp", address, sshConfigure)
}

func (handlerStruct *TerminalHandlerStruct) ConnectWith(ctx context.Context, configure ferretShellDtos.SSHConnectionDto) error {
	windowName := desktop.CallingWindowName(ctx)
	sessionKey := desktop.ScopedKey(windowName, configure.SshSessionId)
	handlerStruct.disconnect(sessionKey)

	sshClient, err := handlerStruct.createSshClient(configure)
	if err != nil {
		return err
	}

	if configure.Cols == 0 {
		configure.Cols = 80
	}
	if configure.Rows == 0 {
		configure.Rows = 24
	}

	session, err := sshClient.NewSession()
	if err != nil {
		sshClient.Close()
		return err
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", configure.Rows, configure.Cols, modes); err != nil {
		session.Close()
		sshClient.Close()
		return err
	}

	standardInput, _ := session.StdinPipe()
	stdout, _ := session.StdoutPipe()
	stderr, _ := session.StderrPipe()

	if err := session.Shell(); err != nil {
		session.Close()
		sshClient.Close()
		return err
	}
	connection := &sshConnection{
		client:  sshClient,
		session: session,
		stdin:   standardInput,
	}
	handlerStruct.addSession(sessionKey, connection)

	sessionDone := make(chan struct{})
	dataEvent := fmt.Sprintf("ssh:data:%s", configure.SshSessionId)

	var readersGroup sync.WaitGroup
	readersGroup.Add(2)
	go pipeOutput(stdout, windowName, dataEvent, 8192, &readersGroup)
	go pipeOutput(stderr, windowName, dataEvent, 4096, &readersGroup)
	go keepConnectionAlive(sshClient, sessionDone)

	go func() {
		waitError := session.Wait()
		close(sessionDone)
		readersGroup.Wait()

		_ = sshClient.Close()
		handlerStruct.sshSessions.CompareAndDelete(sessionKey, connection)

		if connection.closedByClient.Load() {
			return
		}
		desktop.EmitToWindow(windowName, fmt.Sprintf("ssh:exit:%s", configure.SshSessionId), describeSessionExit(waitError))
	}()

	return nil
}

func pipeOutput(reader io.Reader, windowName string, eventName string, bufferSize int, readersGroup *sync.WaitGroup) {
	defer readersGroup.Done()
	buffer := make([]byte, bufferSize)
	for {
		bytesRead, readError := reader.Read(buffer)
		if bytesRead > 0 {
			desktop.EmitToWindow(windowName, eventName, string(buffer[:bytesRead]))
		}
		if readError != nil {
			return
		}
	}
}

func keepConnectionAlive(sshClient *ssh.Client, sessionDone <-chan struct{}) {
	const maxFailures = 3
	const interval = 30 * time.Second

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	failures := 0
	for {
		select {
		case <-sessionDone:
			return
		case <-ticker.C:
			if _, _, requestError := sshClient.SendRequest("keepalive@openssh.com", true, nil); requestError != nil {
				failures++
				if failures >= maxFailures {
					_ = sshClient.Close()
					return
				}
				continue
			}
			failures = 0
		}
	}
}

func describeSessionExit(waitError error) string {
	if waitError == nil {
		return "sessão finalizada"
	}

	var exitError *ssh.ExitError
	if errors.As(waitError, &exitError) {
		if exitError.Signal() != "" {
			return fmt.Sprintf("sessão finalizada pelo sinal %s", exitError.Signal())
		}
		return fmt.Sprintf("sessão finalizada com código %d", exitError.ExitStatus())
	}

	var exitMissingError *ssh.ExitMissingError
	if errors.As(waitError, &exitMissingError) || errors.Is(waitError, io.EOF) {
		return "conexão perdida com o servidor"
	}

	return fmt.Sprintf("conexão perdida: %s", waitError.Error())
}

func (handlerStruct *TerminalHandlerStruct) Send(ctx context.Context, sessionId string, data string) error {
	return handlerStruct.send(desktop.ScopedKey(desktop.CallingWindowName(ctx), sessionId), data)
}

func (handlerStruct *TerminalHandlerStruct) send(sessionKey string, data string) error {
	connection, ok := handlerStruct.getSession(sessionKey)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	_, err := connection.stdin.Write([]byte(data))
	return err
}

func (handlerStruct *TerminalHandlerStruct) Broadcast(ctx context.Context, sessionIds []string, data string) error {
	windowName := desktop.CallingWindowName(ctx)
	for _, sessionId := range sessionIds {
		err := handlerStruct.send(desktop.ScopedKey(windowName, sessionId), data)
		if err != nil {
			return errors.New("Erro de broadcast")
		}
	}
	return nil
}

func (handlerStruct *TerminalHandlerStruct) Resize(ctx context.Context, sessionId string, cols, rows int) error {
	connection, ok := handlerStruct.getSession(desktop.ScopedKey(desktop.CallingWindowName(ctx), sessionId))
	if !ok {
		return errors.New("sessão não encontrada")
	}
	return connection.session.WindowChange(rows, cols)
}

func (handlerStruct *TerminalHandlerStruct) Disconnect(ctx context.Context, sessionId string) {
	handlerStruct.disconnect(desktop.ScopedKey(desktop.CallingWindowName(ctx), sessionId))
}

func (handlerStruct *TerminalHandlerStruct) disconnect(sessionKey string) {
	connection, ok := handlerStruct.getSession(sessionKey)
	if !ok {
		return
	}

	connection.closedByClient.Store(true)
	handlerStruct.sshSessions.CompareAndDelete(sessionKey, connection)

	_ = connection.session.Close()

	if connection.client != nil {
		_ = connection.client.Close()
	}
}
