package cloudSyncHandlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	auth "docker-manager-go/src/auth/functions"
	cloudSyncDtos "docker-manager-go/src/cloudSync/dtos"
	cloudSyncFunctions "docker-manager-go/src/cloudSync/functions"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"
)

const (
	loginTimeout    = 5 * time.Minute
	remoteTimeout   = 10 * time.Second
	restoreTimeout  = 2 * time.Minute
	shutdownTimeout = time.Minute
)

type CloudSyncHandlerStruct struct {
	DataBase           *gorm.DB
	Session            *auth.ManagerStruct
	syncMutex          sync.Mutex
	restartApp         func() error
	openBrowser        func(address string) error
	dataBasePath       string
	skipShutdownUpload bool
}

func NewCloudSyncHandler(dataBase *gorm.DB, session *auth.ManagerStruct, dataBasePath string) *CloudSyncHandlerStruct {
	return &CloudSyncHandlerStruct{
		DataBase:     dataBase,
		Session:      session,
		restartApp:   restartApplication,
		openBrowser:  openInSystemBrowser,
		dataBasePath: dataBasePath,
	}
}

func openInSystemBrowser(address string) error {
	app := application.Get()
	if app == nil {
		return errors.New("navegador indisponível fora da aplicação")
	}
	return app.Browser.OpenURL(address)
}

func restartApplication() error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	command := exec.Command(executable, os.Args[1:]...)
	command.Env = os.Environ()
	if err := command.Start(); err != nil {
		return fmt.Errorf("não foi possível reiniciar o app: %w", err)
	}
	if app := application.Get(); app != nil {
		go app.Quit()
	}
	return nil
}

func (handlerStruct *CloudSyncHandlerStruct) ServiceShutdown() error {
	handlerStruct.syncMutex.Lock()
	defer handlerStruct.syncMutex.Unlock()
	if handlerStruct.skipShutdownUpload {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	uploaded, err := cloudSyncFunctions.UploadDatabase(ctx, handlerStruct.DataBase, handlerStruct.dataBasePath, false)
	switch {
	case errors.Is(err, cloudSyncFunctions.ErrNotConnected):
	case err != nil:
		log.Println("não foi possível enviar o banco para o Google Drive:", err)
	case uploaded:
		log.Println("banco enviado para o Google Drive")
	}
	return nil
}

func (handlerStruct *CloudSyncHandlerStruct) Status(ctx context.Context, token string) (cloudSyncDtos.CloudSyncStatusDto, error) {
	if _, err := handlerStruct.Session.Validate(token); err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}
	return handlerStruct.status(ctx)
}

func (handlerStruct *CloudSyncHandlerStruct) Connect(ctx context.Context, token string) (cloudSyncDtos.CloudSyncStatusDto, error) {
	if _, err := handlerStruct.Session.Validate(token); err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}
	return handlerStruct.connect(ctx)
}

func (handlerStruct *CloudSyncHandlerStruct) LoginScreenStatus(ctx context.Context) (cloudSyncDtos.CloudSyncStatusDto, error) {
	return handlerStruct.status(ctx)
}

func (handlerStruct *CloudSyncHandlerStruct) ConnectFromLoginScreen(ctx context.Context) (cloudSyncDtos.CloudSyncStatusDto, error) {
	return handlerStruct.connect(ctx)
}

func (handlerStruct *CloudSyncHandlerStruct) RestoreAndRestart(ctx context.Context) error {
	handlerStruct.syncMutex.Lock()
	defer handlerStruct.syncMutex.Unlock()

	restoreContext, cancel := context.WithTimeout(ctx, restoreTimeout)
	defer cancel()
	restore, err := cloudSyncFunctions.PrepareRestore(restoreContext, handlerStruct.dataBasePath)
	if err != nil {
		return err
	}
	if restore == nil {
		return errors.New("não há uma versão mais nova na nuvem para restaurar")
	}

	connection, err := handlerStruct.DataBase.DB()
	if err == nil {
		err = connection.Close()
	}
	if err != nil {
		restore.Discard()
		return fmt.Errorf("não foi possível fechar o banco local: %w", err)
	}

	handlerStruct.skipShutdownUpload = true
	applyErr := restore.Apply()
	if applyErr != nil {
		log.Println("não foi possível aplicar o backup do Google Drive:", applyErr)
	}
	return errors.Join(applyErr, handlerStruct.restartApp())
}

func (handlerStruct *CloudSyncHandlerStruct) connect(ctx context.Context) (cloudSyncDtos.CloudSyncStatusDto, error) {
	if !cloudSyncFunctions.IsConfigured() {
		return cloudSyncDtos.CloudSyncStatusDto{}, errors.New("o login com Google não está configurado nesta versão do app")
	}

	loginContext, cancel := context.WithTimeout(ctx, loginTimeout)
	defer cancel()
	googleToken, err := cloudSyncFunctions.Login(loginContext, handlerStruct.openBrowser)
	if err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}
	accountEmail, err := cloudSyncFunctions.AccountEmail(loginContext, googleToken)
	if err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}

	handlerStruct.syncMutex.Lock()
	state, err := cloudSyncFunctions.LoadState(handlerStruct.dataBasePath)
	if err == nil {
		if state.AccountEmail != accountEmail {
			state = cloudSyncFunctions.SyncState{}
		}
		state.Token, state.AccountEmail = googleToken, accountEmail
		err = cloudSyncFunctions.SaveState(handlerStruct.dataBasePath, state)
	}
	handlerStruct.syncMutex.Unlock()
	if err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}
	return handlerStruct.status(ctx)
}

func (handlerStruct *CloudSyncHandlerStruct) Disconnect(ctx context.Context, token string) error {
	if _, err := handlerStruct.Session.Validate(token); err != nil {
		return err
	}

	handlerStruct.syncMutex.Lock()
	defer handlerStruct.syncMutex.Unlock()
	state, err := cloudSyncFunctions.LoadState(handlerStruct.dataBasePath)
	if err != nil {
		return err
	}
	if state.Connected() {
		revokeContext, cancel := context.WithTimeout(ctx, remoteTimeout)
		defer cancel()
		if revokeErr := cloudSyncFunctions.RevokeToken(revokeContext, state.Token); revokeErr != nil {
			log.Println("não foi possível revogar o acesso ao Google Drive:", revokeErr)
		}
	}
	return cloudSyncFunctions.ClearState(handlerStruct.dataBasePath)
}

func (handlerStruct *CloudSyncHandlerStruct) UploadNow(ctx context.Context, token string) (cloudSyncDtos.CloudSyncStatusDto, error) {
	if _, err := handlerStruct.Session.Validate(token); err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}

	handlerStruct.syncMutex.Lock()
	_, err := cloudSyncFunctions.UploadDatabase(ctx, handlerStruct.DataBase, handlerStruct.dataBasePath, true)
	handlerStruct.syncMutex.Unlock()
	if err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}
	return handlerStruct.status(ctx)
}

func (handlerStruct *CloudSyncHandlerStruct) status(ctx context.Context) (cloudSyncDtos.CloudSyncStatusDto, error) {
	handlerStruct.syncMutex.Lock()
	state, err := cloudSyncFunctions.LoadState(handlerStruct.dataBasePath)
	handlerStruct.syncMutex.Unlock()
	if err != nil {
		return cloudSyncDtos.CloudSyncStatusDto{}, err
	}

	status := cloudSyncDtos.CloudSyncStatusDto{
		Connected:    state.Connected(),
		Configured:   cloudSyncFunctions.IsConfigured(),
		AccountEmail: state.AccountEmail,
		LastSyncedAt: formatTime(state.LastSyncedAt),
	}
	if !status.Connected {
		return status, nil
	}

	remoteContext, cancel := context.WithTimeout(ctx, remoteTimeout)
	defer cancel()
	remote, err := cloudSyncFunctions.FindRemoteBackup(remoteContext, state.Token)
	if err != nil {
		status.RemoteError = err.Error()
		return status, nil
	}
	if remote != nil {
		status.RemoteSyncedAt = formatTime(remote.SyncedAt)
		status.RestorePending = remote.SyncedAt.After(state.LastSyncedAt)
	}
	return status, nil
}

func formatTime(moment time.Time) string {
	if moment.IsZero() {
		return ""
	}
	return moment.UTC().Format(time.RFC3339)
}
