package ferretshellHandlers

import (
	"context"

	auth "docker-manager-go/src/auth/functions"
	ferretShellDtos "docker-manager-go/src/ferretshell/dtos"
	"errors"
	"fmt"
	"io"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	context      context.Context
	sshSessions  sync.Map
	Session      *auth.ManagerStruct
	SftpSessions sync.Map
}

func (handlerStruct *TerminalHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
}

func NewTerminalHandler(session *auth.ManagerStruct) *TerminalHandlerStruct {
	return &TerminalHandlerStruct{
		Session: session}
}

func (handlerStruct *TerminalHandlerStruct) AddSession(id string, conn *sshConnection) {
	handlerStruct.sshSessions.Store(id, conn)
}
func (handlerStruct *TerminalHandlerStruct) GetSession(id string) (*sshConnection, bool) {
	val, ok := handlerStruct.sshSessions.Load(id)
	if !ok {
		return nil, false
	}
	return val.(*sshConnection), true
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

	addr := fmt.Sprintf("%s:%d", configure.Host, configure.Port)
	return ssh.Dial("tcp", addr, sshConfigure)
}

func (handlerStruct *TerminalHandlerStruct) ConnectWith(configure ferretShellDtos.SSHConnectionDto) error {
	handlerStruct.Disconnect(configure.SshSessionId)

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
	handlerStruct.AddSession(configure.SshSessionId, connection)

	sessionDone := make(chan struct{})
	dataEvent := fmt.Sprintf("ssh:data:%s", configure.SshSessionId)

	var readersGroup sync.WaitGroup
	readersGroup.Add(2)
	go handlerStruct.pipeOutput(stdout, dataEvent, 8192, &readersGroup)
	go handlerStruct.pipeOutput(stderr, dataEvent, 4096, &readersGroup)
	go keepConnectionAlive(sshClient, sessionDone)

	go func() {
		waitError := session.Wait()
		close(sessionDone)
		readersGroup.Wait()

		_ = sshClient.Close()
		handlerStruct.sshSessions.CompareAndDelete(configure.SshSessionId, connection)

		if connection.closedByClient.Load() {
			return
		}
		runtime.EventsEmit(handlerStruct.context, fmt.Sprintf("ssh:exit:%s", configure.SshSessionId), describeSessionExit(waitError))
	}()

	return nil
}

func (handlerStruct *TerminalHandlerStruct) pipeOutput(reader io.Reader, eventName string, bufferSize int, readersGroup *sync.WaitGroup) {
	defer readersGroup.Done()
	buffer := make([]byte, bufferSize)
	for {
		bytesRead, readError := reader.Read(buffer)
		if bytesRead > 0 {
			runtime.EventsEmit(handlerStruct.context, eventName, string(buffer[:bytesRead]))
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

func (handlerStruct *TerminalHandlerStruct) Send(sessionId string, data string) error {
	conn, ok := handlerStruct.GetSession(sessionId)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	_, err := conn.stdin.Write([]byte(data))
	return err
}

func (handlerStruct *TerminalHandlerStruct) Broadcast(sessionIds []string, data string) error {
	for _, sessionId := range sessionIds {
		err := handlerStruct.Send(sessionId, data)
		if err != nil {
			return errors.New("Erro de broadcast")
		}
	}
	return nil
}

func (handlerStruct *TerminalHandlerStruct) Resize(sessionId string, cols, rows int) error {
	conn, ok := handlerStruct.GetSession(sessionId)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	return conn.session.WindowChange(rows, cols)
}

func (handlerStruct *TerminalHandlerStruct) Disconnect(sessionId string) {
	conn, ok := handlerStruct.GetSession(sessionId)
	if !ok {
		return
	}

	conn.closedByClient.Store(true)
	handlerStruct.sshSessions.CompareAndDelete(sessionId, conn)

	_ = conn.session.Close()

	if conn.client != nil {
		_ = conn.client.Close()
	}
}
