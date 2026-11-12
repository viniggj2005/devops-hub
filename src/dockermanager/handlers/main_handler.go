package dockerHandlers

import (
	"context"

	"docker-manager-go/src/appErrors"
	auth "docker-manager-go/src/auth/functions"
	dockerDtos "docker-manager-go/src/dockermanager/dtos"
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	"encoding/base64"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"
)

type DockerHandlerStruct struct {
	DataBase  *gorm.DB
	context   context.Context
	Session   *auth.ManagerStruct
	dockerSdk *DockerSdkHandlerStruct
}

func NewDockerHandler(dataBase *gorm.DB, sessionManager *auth.ManagerStruct) *DockerHandlerStruct {
	return &DockerHandlerStruct{DataBase: dataBase, Session: sessionManager}
}

func (handlerStruct *DockerHandlerStruct) ServiceStartup(context context.Context, _ application.ServiceOptions) error {
	handlerStruct.context = context
	return nil
}

func (handlerStruct *DockerHandlerStruct) registerDockerSdkHandler(sdkHandler *DockerSdkHandlerStruct) {
	handlerStruct.dockerSdk = sdkHandler
}

func (handlerStruct *DockerHandlerStruct) ConnectDockerCredential(token string, credentialID int) error {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return err
	}

	if handlerStruct.dockerSdk == nil {
		return appErrors.New("docker.sdkNotConfigured", "docker sdk handler não configurado")
	}

	if err := handlerStruct.dockerSdk.AddDockerClient(credentialID); err != nil {
		return appErrors.Wrap("docker.connectFailed", "erro ao conectar credencial docker", err)
	}

	return nil
}

func (handlerStruct *DockerHandlerStruct) CreateDockerConnection(token string, body dockerDtos.CreateDockerConnectionDto) error {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return err
	}

	keyBytes, err := base64.StdEncoding.DecodeString(body.Key)
	if err != nil {
		return appErrors.Wrap("docker.decodeKeyFailed", "erro ao decodificar Key", err)
	}

	caBytes, err := base64.StdEncoding.DecodeString(body.Ca)
	if err != nil {
		return appErrors.Wrap("docker.decodeCaFailed", "erro ao decodificar Ca", err)
	}

	certBytes, err := base64.StdEncoding.DecodeString(body.Cert)
	if err != nil {
		return appErrors.Wrap("docker.decodeCertFailed", "erro ao decodificar cert", err)
	}

	connection := models.DockerCredentialsModel{
		Alias:       body.Alias,
		UserID:      body.UserID,
		Description: body.Description,
		Url:         types.EncryptedString{Plaintext: body.Url},
		Ca:          types.EncryptedString{Plaintext: string(caBytes)},
		Key:         types.EncryptedString{Plaintext: string(keyBytes)},
		Cert:        types.EncryptedString{Plaintext: string(certBytes)},
	}

	if connection.Url.Plaintext == "" {
		return appErrors.New("docker.emptyHost", "erro: host está vazio antes do insert")
	}

	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).Create(&connection).Error; err != nil {
		return appErrors.Wrap("docker.createConnectionFailed", "erro ao criar conexão", err)
	}

	return nil
}

func (handlerStruct *DockerHandlerStruct) FindAllByUser(token string, userId int) ([]models.DockerCredentialsModel, error) {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return nil, err
	}
	var dockerConnections []models.DockerCredentialsModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).
		Select("alias,id,description,created_at").
		Where("user_id = ?", userId).
		Find(&dockerConnections).Error; err != nil {
		return nil, err
	}
	return dockerConnections, nil
}

func (handlerStruct *DockerHandlerStruct) GetDockerConnectionById(token string, id int) (models.DockerCredentialsModel, error) {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return models.DockerCredentialsModel{}, err
	}
	var dockerConnections models.DockerCredentialsModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).Where("id = ?", id).First(&dockerConnections).Error; err != nil {
		return models.DockerCredentialsModel{}, err
	}
	return dockerConnections, nil
}

func (handlerStruct *DockerHandlerStruct) getDockerConnectionByIdWithoutToken(id int) (models.DockerCredentialsModel, error) {
	var dockerConnections models.DockerCredentialsModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).Where("id = ?", id).First(&dockerConnections).Error; err != nil {
		return models.DockerCredentialsModel{}, err
	}
	return dockerConnections, nil
}

func (handlerStruct *DockerHandlerStruct) DeleteDockerConnection(token string, id uint) error {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return err
	}

	if err := handlerStruct.DataBase.Delete(&models.DockerCredentialsModel{}, id).Error; err != nil {
		return appErrors.Wrap("docker.deleteConnectionFailed", "erro ao deletar conexão", err)
	}

	return nil
}
