package ferretShellHandlers

import (
	"context"
	ferretShellDtos "docker-manager-go/src/ferretshell/dtos"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type SftpHandlerStruct struct {
	*TerminalHandlerStruct
}

type sftpSession struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
}

func NewSftpHandler(terminalHandler *TerminalHandlerStruct) *SftpHandlerStruct {
	return &SftpHandlerStruct{
		TerminalHandlerStruct: terminalHandler,
	}
}

func (handlerStruct *SftpHandlerStruct) Startup(ctx context.Context) {}

func (handlerStruct *SftpHandlerStruct) ConnectSFTP(configure ferretShellDtos.SSHConnectionDto) (string, error) {
	sshClient, err := handlerStruct.createSshClient(configure)
	if err != nil {
		return "", err
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return "", err
	}

	sessionId := uuid.New().String()
	handlerStruct.SftpSessions.Store(sessionId, &sftpSession{
		sshClient:  sshClient,
		sftpClient: sftpClient,
	})

	return sessionId, nil
}

func (handlerStruct *SftpHandlerStruct) DisconnectSFTP(sessionId string) {
	value, ok := handlerStruct.SftpSessions.Load(sessionId)
	if !ok {
		return
	}

	session := value.(*sftpSession)
	if session.sftpClient != nil {
		_ = session.sftpClient.Close()
	}
	if session.sshClient != nil {
		_ = session.sshClient.Close()
	}

	handlerStruct.SftpSessions.Delete(sessionId)
}

func (handlerStruct *SftpHandlerStruct) getSftpClient(sessionId string) (*sftp.Client, error) {
	value, ok := handlerStruct.SftpSessions.Load(sessionId)
	if !ok {
		return nil, errors.New("sessão SFTP não encontrada ou já encerrada")
	}
	return value.(*sftpSession).sftpClient, nil
}

type SftpFileInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"isDir"`
	Mode  string `json:"mode"`
}

func (handlerStruct *SftpHandlerStruct) ListFiles(sessionId string, path string) ([]SftpFileInfo, error) {
	sftpClient, err := handlerStruct.getSftpClient(sessionId)
	if err != nil {
		return nil, err
	}

	files, err := sftpClient.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var fileInfos []SftpFileInfo
	for _, f := range files {
		fileInfos = append(fileInfos, SftpFileInfo{
			Name:  f.Name(),
			Size:  f.Size(),
			IsDir: f.IsDir(),
			Mode:  f.Mode().String(),
		})
	}

	return fileInfos, nil
}

func (handlerStruct *SftpHandlerStruct) DownloadFile(sessionId string, remotePath string, localPath string) error {
	sftpClient, err := handlerStruct.getSftpClient(sessionId)
	if err != nil {
		return err
	}

	sourceFile, err := sftpClient.Open(remotePath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destinationFile, err := os.Create(localPath)
	if err != nil {
		return err
	}
	defer destinationFile.Close()

	_, err = io.Copy(destinationFile, sourceFile)
	if err != nil {
		return err
	}

	return nil
}

func (handlerStruct *SftpHandlerStruct) DownloadMultipleFiles(sessionId string, remotePaths []string, localPath string) error {
	for _, remotePath := range remotePaths {
		fileName := path.Base(remotePath)
		dest := filepath.Join(localPath, fileName)
		err := handlerStruct.DownloadFile(sessionId, remotePath, dest)
		if err != nil {
			return err
		}
	}

	return nil
}

func (handlerStruct *SftpHandlerStruct) DownloadDirectory(sessionId string, remoteDir string, localPath string) error {
	value, ok := handlerStruct.SftpSessions.Load(sessionId)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	session := value.(*sftpSession)

	remoteTarPath := "/tmp/ferret_download_" + uuid.New().String() + ".tar.gz"

	sshSession, err := session.sshClient.NewSession()
	if err != nil {
		return err
	}
	defer sshSession.Close()

	cmd := "tar -czf " + remoteTarPath + " -C $(dirname " + remoteDir + ") $(basename " + remoteDir + ")"
	if err := sshSession.Run(cmd); err != nil {
		return errors.New("falha ao compactar pasta no servidor: " + err.Error())
	}

	defer func() {
		_ = session.sftpClient.Remove(remoteTarPath)
	}()
	err = handlerStruct.DownloadFile(sessionId, remoteTarPath, localPath)
	if err != nil {
		return err
	}

	return nil
}

func (handlerStruct *SftpHandlerStruct) UploadFile(sessionId string, remotePath string, localPath string) error {
	sftpClient, err := handlerStruct.getSftpClient(sessionId)
	if err != nil {
		return err
	}

	sourceFile, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destinationFile, err := sftpClient.Create(remotePath)
	if err != nil {
		return err
	}
	defer destinationFile.Close()

	_, err = io.Copy(destinationFile, sourceFile)
	if err != nil {
		return err
	}

	return nil
}

func (handlerStruct *SftpHandlerStruct) UploadMultipleFiles(sessionId string, remoteDir string, localPaths []string) error {
	for _, localPath := range localPaths {
		fileName := filepath.Base(localPath)
		separator := "/"
		dest := remoteDir
		if dest == "" || dest[len(dest)-1:] != "/" {
			dest += separator
		}
		dest += fileName

		err := handlerStruct.UploadFile(sessionId, dest, localPath)
		if err != nil {
			return err
		}
	}

	return nil
}
