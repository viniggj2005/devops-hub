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
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

type sshConnection struct {
	client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
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
	handlerStruct.AddSession(configure.SshSessionId, &sshConnection{
		client:  sshClient,
		session: session,
		stdin:   standardInput,
	})
	go func() {
		standardOutputBuffer := make([]byte, 8192)
		for {
			n, err := stdout.Read(standardOutputBuffer)
			if n > 0 {
				runtime.EventsEmit(handlerStruct.context, fmt.Sprintf("ssh:data:%s", configure.SshSessionId), string(standardOutputBuffer[:n]))
			}
			if err != nil {
				break
			}
		}
	}()
	go func() {
		standardErrorBuffer := make([]byte, 4096)
		for {
			n, err := stderr.Read(standardErrorBuffer)
			if n > 0 {
				runtime.EventsEmit(handlerStruct.context, fmt.Sprintf("ssh:data:%s", configure.SshSessionId), string(standardErrorBuffer[:n]))
			}
			if err != nil {
				break
			}
		}
	}()
	go func() {
		err := session.Wait()
		message := ""
		if err != nil {
			message = err.Error()
		}
		runtime.EventsEmit(handlerStruct.context, fmt.Sprintf("ssh:exit:%s", configure.SshSessionId), message)
	}()

	return nil
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

	_ = conn.session.Close()

	if conn.client != nil {
		_ = conn.client.Close()
	}

	handlerStruct.sshSessions.Delete(sessionId)
}
