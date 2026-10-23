package ferretshellHandlers

import (
	"bytes"
	"context"
	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/desktop"
	ferretShellDtos "docker-manager-go/src/ferretshell/dtos"
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	"github.com/glebarez/sqlite"
	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/crypto/ssh"
	"gorm.io/gorm"
)

func TestLocalFileHandler(test *testing.T) {
	handler := NewLocalFileHandler()

	homeDirectory, err := handler.GetHomeDir()
	if err != nil || homeDirectory == "" {
		test.Fatalf("unexpected GetHomeDir result: %q, err=%v", homeDirectory, err)
	}

	temporaryDir := test.TempDir()
	firstFile := filepath.Join(temporaryDir, "alpha.txt")
	secondFile := filepath.Join(temporaryDir, "beta.txt")
	subFolder := filepath.Join(temporaryDir, "subdir")

	if err := os.WriteFile(firstFile, []byte("hello"), 0o644); err != nil {
		test.Fatalf("unexpected error writing file: %v", err)
	}
	if err := os.WriteFile(secondFile, []byte("world"), 0o644); err != nil {
		test.Fatalf("unexpected error writing file: %v", err)
	}
	if err := os.Mkdir(subFolder, 0o755); err != nil {
		test.Fatalf("unexpected error creating subdir: %v", err)
	}

	files, err := handler.ListLocalFiles(temporaryDir)
	if err != nil || len(files) != 3 {
		test.Fatalf("expected 3 entries, got %+v, err=%v", files, err)
	}

	if _, err := handler.ListLocalFiles(filepath.Join(temporaryDir, "missing")); err == nil {
		test.Fatalf("expected error listing missing directory")
	}

	renamedFile := filepath.Join(temporaryDir, "alpha_renamed.txt")
	if err := handler.RenameLocalFile(firstFile, renamedFile); err != nil {
		test.Fatalf("unexpected error renaming file: %v", err)
	}

	if err := handler.DeleteLocalFile(renamedFile); err != nil {
		test.Fatalf("unexpected error deleting file: %v", err)
	}

	if err := handler.DeleteLocalFiles([]string{secondFile, subFolder}); err != nil {
		test.Fatalf("unexpected error deleting multiple files: %v", err)
	}

	remaining, err := handler.ListLocalFiles(temporaryDir)
	if err != nil || len(remaining) != 0 {
		test.Fatalf("expected 0 remaining files, got %+v, err=%v", remaining, err)
	}
}

func TestLocalShellsAndTerminalHandler(test *testing.T) {
	shell := newLocalShell("pwsh", shellKindPowerShell, "PowerShell 7", "pwsh.exe", "-NoLogo")
	if shell.description.Id != "pwsh" || shell.description.Kind != shellKindPowerShell || len(shell.arguments) != 1 {
		test.Fatalf("unexpected localShell: %+v", shell)
	}

	marked := markDefaultShell([]localShell{shell}, 5)
	if !marked[0].description.IsDefault {
		test.Fatalf("expected out-of-bounds defaultIndex to mark index 0 as default")
	}

	asciiOutput := decodeWslOutput([]byte("NAME   STATE\r\n* Ubuntu Running\r\n"))
	if !strings.Contains(asciiOutput, "* Ubuntu Running") || strings.Contains(asciiOutput, "\r") {
		test.Fatalf("unexpected decoded ASCII WSL output: %q", asciiOutput)
	}

	utf16Runes := utf16.Encode([]rune("\ufeff* Debian Running\r\n"))
	utf16Bytes := make([]byte, 0, len(utf16Runes)*2)
	for _, codeUnit := range utf16Runes {
		utf16Bytes = append(utf16Bytes, byte(codeUnit), byte(codeUnit>>8))
	}
	decodedUtf16 := decodeWslOutput(utf16Bytes)
	if decodedUtf16 != "* Debian Running\n" {
		test.Fatalf("unexpected decoded UTF-16 WSL output: %q", decodedUtf16)
	}

	localHandler := NewLocalTerminalHandler()
	localHandler.ServiceStartup(context.Background(), application.ServiceOptions{})

	shells := localHandler.ListShells()
	if len(shells) == 0 {
		test.Fatalf("expected at least one detected shell on Windows")
	}

	if _, found := localHandler.findShell(shells[0].Id); !found {
		test.Fatalf("expected to find shell %s", shells[0].Id)
	}

	if err := localHandler.Start(context.Background(), ferretShellDtos.LocalTerminalStartDto{
		SessionId: "s-1",
		ShellId:   "non-existent-shell-id",
	}); err == nil {
		test.Fatalf("expected error starting unknown shell")
	}

	if err := localHandler.Send(context.Background(), "missing-session", "echo hi\n"); err == nil {
		test.Fatalf("expected error sending to missing session")
	}
	if err := localHandler.Resize(context.Background(), "missing-session", 80, 24); err == nil {
		test.Fatalf("expected error resizing missing session")
	}
	localHandler.Disconnect(context.Background(), "missing-session")
}

func TestSshHandlerCRUD(test *testing.T) {
	sessionKey := hex.EncodeToString(bytes.Repeat([]byte{0x55}, 32))
	if err := types.SetSessionKey(sessionKey); err != nil {
		test.Fatalf("unexpected error setting session key: %v", err)
	}

	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(&models.UserModel{}, &models.SshConnectionModel{}); err != nil {
		test.Fatalf("unexpected error migrating models: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	token, _, err := sessionManager.Create(1)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	sshHandler := NewSshHandler(dataBase, sessionManager)
	sshHandler.ServiceStartup(context.Background(), application.ServiceOptions{})

	if err := sshHandler.CreateSshConnection("invalid", ferretShellDtos.CreateSshConnectionInputDto{}); err == nil {
		test.Fatalf("expected error with invalid token")
	}

	if err := sshHandler.CreateSshConnection(token, ferretShellDtos.CreateSshConnectionInputDto{Host: ""}); err == nil {
		test.Fatalf("expected error when host is empty")
	}

	invalidBase64 := "!!!not-base64"
	if err := sshHandler.CreateSshConnection(token, ferretShellDtos.CreateSshConnectionInputDto{
		Host: "10.0.0.1",
		Key:  &invalidBase64,
	}); err == nil {
		test.Fatalf("expected error for invalid Key base64")
	}

	if err := sshHandler.CreateSshConnection(token, ferretShellDtos.CreateSshConnectionInputDto{
		Host:     "10.0.0.1",
		Password: &invalidBase64,
	}); err == nil {
		test.Fatalf("expected error for invalid Password base64")
	}

	if err := sshHandler.CreateSshConnection(token, ferretShellDtos.CreateSshConnectionInputDto{
		Host:           "10.0.0.1",
		KnownHostsData: &invalidBase64,
	}); err == nil {
		test.Fatalf("expected error for invalid KnownHostsData base64")
	}

	alias := "Bastion"
	port := int64(2222)
	encodedPassword := base64.StdEncoding.EncodeToString([]byte("my-ssh-pass"))
	encodedKey := base64.StdEncoding.EncodeToString([]byte("my-ssh-key"))
	encodedKnown := base64.StdEncoding.EncodeToString([]byte("known-hosts"))

	if err := sshHandler.CreateSshConnection(token, ferretShellDtos.CreateSshConnectionInputDto{
		UserID:         1,
		Alias:          &alias,
		Host:           "10.0.0.1",
		Port:           &port,
		SystemUser:     "ubuntu",
		Password:       &encodedPassword,
		Key:            &encodedKey,
		KnownHostsData: &encodedKnown,
	}); err != nil {
		test.Fatalf("unexpected error creating ssh connection: %v", err)
	}

	connections, err := sshHandler.FindAllConnectionByUser(token, 1)
	if err != nil || len(connections) != 1 || connections[0].Host != "10.0.0.1" {
		test.Fatalf("unexpected connections list: %+v, err=%v", connections, err)
	}

	connectionID := connections[0].ID

	newAlias := "Updated Bastion"
	if err := sshHandler.UpdateSshConnection(token, connectionID, ferretShellDtos.CreateSshConnectionInputDto{
		UserID:     1,
		Alias:      &newAlias,
		Host:       "10.0.0.2",
		SystemUser: "debian",
	}); err != nil {
		test.Fatalf("unexpected error updating ssh connection: %v", err)
	}

	loaded, err := sshHandler.GetById(token, int(connectionID))
	if err != nil || loaded.Host != "10.0.0.2" || loaded.Alias == nil || *loaded.Alias != "Updated Bastion" {
		test.Fatalf("unexpected loaded ssh connection: %+v, err=%v", loaded, err)
	}

	if err := sshHandler.DeleteConnection(token, int(connectionID)); err != nil {
		test.Fatalf("unexpected error deleting ssh connection: %v", err)
	}
}

type bufferWriteCloser struct {
	bytes.Buffer
}

func (writer *bufferWriteCloser) Close() error {
	return nil
}

func TestTerminalAndSftpHandlers(test *testing.T) {
	sessionManager := authFunctions.NewManager(time.Hour)
	terminalHandler := NewTerminalHandler(sessionManager)
	terminalHandler.ServiceStartup(context.Background(), application.ServiceOptions{})

	if describeSessionExit(nil) != "sessão finalizada" {
		test.Fatalf("unexpected nil exit description")
	}
	if describeSessionExit(io.EOF) != "conexão perdida com o servidor" {
		test.Fatalf("unexpected EOF exit description")
	}
	if !strings.Contains(describeSessionExit(errors.New("timeout")), "timeout") {
		test.Fatalf("unexpected custom error exit description")
	}

	_, err := terminalHandler.createSshClient(ferretShellDtos.SSHConnectionDto{
		InsecureIgnoreHostKey: false,
	})
	if err == nil {
		test.Fatalf("expected error when KnownHostsPath is empty and InsecureIgnoreHostKey is false")
	}

	_, err = terminalHandler.createSshClient(ferretShellDtos.SSHConnectionDto{
		InsecureIgnoreHostKey: true,
	})
	if err == nil {
		test.Fatalf("expected error when no auth method is provided")
	}

	writer := &bufferWriteCloser{}
	terminalHandler.addSession(desktop.ScopedKey("", "sess-1"), &sshConnection{
		stdin:   writer,
		session: &ssh.Session{},
	})

	if _, ok := terminalHandler.getSession(desktop.ScopedKey("", "sess-1")); !ok {
		test.Fatalf("expected session sess-1 to exist")
	}

	if err := terminalHandler.Send(context.Background(), "sess-1", "ls -la\n"); err != nil {
		test.Fatalf("unexpected error sending to session: %v", err)
	}
	if writer.String() != "ls -la\n" {
		test.Fatalf("expected buffer to contain ls -la, got %q", writer.String())
	}

	if err := terminalHandler.Broadcast(context.Background(), []string{"sess-1"}, "uptime\n"); err != nil {
		test.Fatalf("unexpected Broadcast error: %v", err)
	}
	if err := terminalHandler.Broadcast(context.Background(), []string{"missing"}, "uptime\n"); err == nil {
		test.Fatalf("expected Broadcast error for missing session")
	}

	sftpHandler := NewSftpHandler(terminalHandler)
	sftpHandler.ServiceStartup(context.Background(), application.ServiceOptions{})

	if err := sftpHandler.DisconnectSFTP("missing"); err == nil {
		test.Fatalf("expected error disconnecting missing SFTP session")
	}
	if _, err := sftpHandler.ListFiles("missing", "/"); err == nil {
		test.Fatalf("expected error listing files on missing SFTP session")
	}
	if err := sftpHandler.DownloadFile("missing", "/a", "b"); err == nil {
		test.Fatalf("expected error downloading file on missing SFTP session")
	}
	if err := sftpHandler.UploadFile("missing", "/a", "b"); err == nil {
		test.Fatalf("expected error uploading file on missing SFTP session")
	}
}

func TestModuleMoveRescopesTerminalSessions(test *testing.T) {
	terminalHandler := NewTerminalHandler(authFunctions.NewManager(time.Hour))
	localHandler := NewLocalTerminalHandler()

	writer := &bufferWriteCloser{}
	sshOutput := newSessionOutput("main", "ssh-1", "ssh:data:ssh-1")
	connection := &sshConnection{stdin: writer, output: sshOutput, session: &ssh.Session{}}
	terminalHandler.addSession(desktop.ScopedKey("main", "ssh-1"), connection)
	otherWindowOutput := newSessionOutput("module-9", "ssh-2", "ssh:data:ssh-2")
	terminalHandler.addSession(desktop.ScopedKey("module-9", "ssh-2"), &sshConnection{output: otherWindowOutput, session: &ssh.Session{}})
	localOutput := newSessionOutput("main", "local-1", "local:data:local-1")
	localHandler.sessions.Store(desktop.ScopedKey("main", "local-1"), &localTerminal{output: localOutput})

	terminalHandler.moveModuleSessions("docker", "main", "module-1")
	if _, ok := terminalHandler.getSession(desktop.ScopedKey("main", "ssh-1")); !ok {
		test.Fatalf("expected moving another module to leave terminal sessions in place")
	}

	terminalHandler.moveModuleSessions(ferretShellModule, "main", "module-1")
	localHandler.moveModuleSessions(ferretShellModule, "main", "module-1")

	fromMain := desktop.WithWindowName(context.Background(), "main")
	fromModule := desktop.WithWindowName(context.Background(), "module-1")
	if err := terminalHandler.Send(fromMain, "ssh-1", "ls\n"); err == nil {
		test.Fatalf("expected the original window to lose the moved session")
	}
	if err := terminalHandler.Send(fromModule, "ssh-1", "ls\n"); err != nil || writer.String() != "ls\n" {
		test.Fatalf("expected the new window to own the session, err=%v, written=%q", err, writer.String())
	}
	if _, ok := terminalHandler.getSession(desktop.ScopedKey("module-9", "ssh-2")); !ok {
		test.Fatalf("expected sessions from other windows to stay put")
	}

	sshOutput.write([]byte("buffered "))
	sshOutput.write([]byte("output"))
	if string(sshOutput.pending) != "buffered output" {
		test.Fatalf("expected output to be buffered while in transit, got %q", sshOutput.pending)
	}
	if err := terminalHandler.Attach(fromMain, "ssh-1"); err == nil {
		test.Fatalf("expected attaching from the original window to fail")
	}
	if err := terminalHandler.Attach(fromModule, "ssh-1"); err != nil || sshOutput.paused || sshOutput.pending != nil {
		test.Fatalf("expected attach to flush and resume the output, err=%v", err)
	}
	if err := localHandler.Attach(fromModule, "local-1"); err != nil || localOutput.owner() != "module-1" {
		test.Fatalf("expected the local session to follow the module, err=%v owner=%q", err, localOutput.owner())
	}

	forgetSession(&terminalHandler.sshSessions, &terminalHandler.moveMutex, sshOutput, connection)
	if _, ok := terminalHandler.getSession(desktop.ScopedKey("module-1", "ssh-1")); ok {
		test.Fatalf("expected a finished session to be removed under its new window")
	}

	otherWindowOutput.moveTo("module-2")
	otherWindowOutput.write(make([]byte, maxPendingOutputBytes+10))
	if len(otherWindowOutput.pending) != maxPendingOutputBytes {
		test.Fatalf("expected buffered output to be capped at %d bytes, got %d", maxPendingOutputBytes, len(otherWindowOutput.pending))
	}
}

