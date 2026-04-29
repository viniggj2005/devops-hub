package ferretShellHandlers

import (
	"context"
	ferretShellDtos "docker-manager-go/src/ferretshell/dtos"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type SftpHandlerStruct struct {
	*TerminalHandlerStruct
}

type SftpFileInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"isDir"`
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
	sshConfig := &ssh.ClientConfig{
		User:            configure.User,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         configure.Timeout,
	}

	if len(configure.Key) > 0 {
		signer, err := ssh.ParsePrivateKey(configure.Key)
		if err != nil {
			return "", err
		}
		sshConfig.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else {
		sshConfig.Auth = []ssh.AuthMethod{ssh.Password(configure.Password)}
	}

	addr := fmt.Sprintf("%s:%d", configure.Host, configure.Port)
	sshClient, err := ssh.Dial("tcp", addr, sshConfig)
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

func (handlerStruct *SftpHandlerStruct) DisconnectSFTP(sessionId string) error {
	value, ok := handlerStruct.SftpSessions.Load(sessionId)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	session := value.(*sftpSession)
	session.sftpClient.Close()
	session.sshClient.Close()
	handlerStruct.SftpSessions.Delete(sessionId)
	return nil
}

func (handlerStruct *SftpHandlerStruct) getSftpClient(sessionId string) (*sftp.Client, error) {
	value, ok := handlerStruct.SftpSessions.Load(sessionId)
	if !ok {
		return nil, errors.New("sessão não encontrada")
	}
	return value.(*sftpSession).sftpClient, nil
}

func (handlerStruct *SftpHandlerStruct) ListFiles(sessionId string, path string) ([]SftpFileInfo, error) {
	client, err := handlerStruct.getSftpClient(sessionId)
	if err != nil {
		return nil, err
	}

	files, err := client.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var fileInfos []SftpFileInfo
	for _, file := range files {
		fileInfos = append(fileInfos, SftpFileInfo{
			Name:  file.Name(),
			IsDir: file.IsDir(),
			Size:  file.Size(),
		})
	}

	return fileInfos, nil
}

func (handlerStruct *SftpHandlerStruct) DownloadFile(sessionId string, remotePath string, localPath string) error {
	client, err := handlerStruct.getSftpClient(sessionId)
	if err != nil {
		return err
	}

	sourceFile, err := client.Open(remotePath)
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

func (handlerStruct *SftpHandlerStruct) UploadDirectory(sessionId string, remoteDir string, localPath string) error {
	value, ok := handlerStruct.SftpSessions.Load(sessionId)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	session := value.(*sftpSession)

	localTar := filepath.Join(os.TempDir(), "upload_"+uuid.New().String()+".tar.gz")
	tarCmd := exec.Command("tar", "-czf", localTar, "-C", filepath.Dir(localPath), filepath.Base(localPath))
	if err := tarCmd.Run(); err != nil {
		return fmt.Errorf("falha ao compactar localmente: %w", err)
	}
	defer os.Remove(localTar)

	remoteTarPath := "/tmp/" + filepath.Base(localTar)
	err := handlerStruct.UploadFile(sessionId, remoteTarPath, localTar)
	if err != nil {
		return err
	}
	defer session.sftpClient.Remove(remoteTarPath)

	sshSession, err := session.sshClient.NewSession()
	if err != nil {
		return err
	}
	defer sshSession.Close()

	extractCmd := fmt.Sprintf("mkdir -p %s && tar -xzf %s -C %s", remoteDir, remoteTarPath, remoteDir)
	if err := sshSession.Run(extractCmd); err != nil {
		return fmt.Errorf("falha ao extrair no servidor: %w", err)
	}

	return nil
}

func (handlerStruct *SftpHandlerStruct) DownloadDirectory(sessionId string, remotePath string, localDir string) error {
	value, ok := handlerStruct.SftpSessions.Load(sessionId)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	session := value.(*sftpSession)

	remoteBase := path.Base(remotePath)
	remoteTarPath := "/tmp/download_" + uuid.New().String() + ".tar.gz"

	sshSession, err := session.sshClient.NewSession()
	if err != nil {
		return err
	}
	defer sshSession.Close()

	compressCmd := fmt.Sprintf("tar -czf %s -C %s %s", remoteTarPath, path.Dir(remotePath), remoteBase)
	if err := sshSession.Run(compressCmd); err != nil {
		return fmt.Errorf("falha ao compactar no servidor: %w", err)
	}
	defer session.sftpClient.Remove(remoteTarPath)

	localTar := filepath.Join(os.TempDir(), path.Base(remoteTarPath))
	err = handlerStruct.DownloadFile(sessionId, remoteTarPath, localTar)
	if err != nil {
		return err
	}
	defer os.Remove(localTar)

	extractCmd := exec.Command("tar", "-xzf", localTar, "-C", localDir)
	if err := extractCmd.Run(); err != nil {
		return fmt.Errorf("falha ao extrair localmente: %w", err)
	}

	return nil
}
