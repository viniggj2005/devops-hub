package handlers

import (
	"context"
	"encoding/base64"
	"fmt"

	"gorm.io/gorm"

	"docker-manager-go/src/auth"
	"docker-manager-go/src/dtos"
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
)

type SshHandlerStruct struct {
	DataBase *gorm.DB
	Session  *auth.ManagerStruct
	context  context.Context
}

func NewSshHandler(dataBase *gorm.DB, sessionManager *auth.ManagerStruct) *SshHandlerStruct {
	return &SshHandlerStruct{DataBase: dataBase, Session: sessionManager}
}

func (handlerStruct *SshHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
}

func (handlerStruct *SshHandlerStruct) UpdateSshConnection(token string, id uint, body dtos.CreateSshConnectionInputDto) error {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return err
	}

	var existing models.SshConnectionModel
	if err := handlerStruct.DataBase.First(&existing, id).Error; err != nil {
		return fmt.Errorf("conexão não encontrada: %w", err)
	}

	if body.Host != "" {
		existing.Host.Plaintext = body.Host
	}
	if body.SystemUser != "" {
		existing.SystemUser = body.SystemUser
	}
	if body.Port != nil {
		existing.Port = *body.Port
	}
	if body.Alias != nil {
		existing.Alias = *body.Alias
	}

	if body.Key != nil && *body.Key != "" {
		keyBytes, err := base64.StdEncoding.DecodeString(*body.Key)
		if err != nil {
			return fmt.Errorf("erro ao decodificar chave: %w", err)
		}
		existing.Key.Plaintext = string(keyBytes)
	}

	if body.KnownHostsData != nil && *body.KnownHostsData != "" {
		knownBytes, err := base64.StdEncoding.DecodeString(*body.KnownHostsData)
		if err != nil {
			return fmt.Errorf("erro ao decodificar knownHosts: %w", err)
		}
		existing.KnownHostsData.Plaintext = string(knownBytes)
	}

	existing.UserID = body.UserID

	if err := handlerStruct.DataBase.Save(&existing).Error; err != nil {
		return fmt.Errorf("erro ao atualizar conexão: %w", err)
	}

	return nil
}

func (handlerStruct *SshHandlerStruct) CreateSshConnection(token string, body dtos.CreateSshConnectionInputDto) error {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return err
	}

	if body.Host == "" {
		return fmt.Errorf("o campo 'host' é obrigatório")
	}

	var port int64 = 22
	if body.Port != nil {
		port = *body.Port
	}

	var keyString string
	if body.Key != nil && *body.Key != "" {
		keyBytes, err := base64.StdEncoding.DecodeString(*body.Key)
		if err != nil {
			return fmt.Errorf("erro ao decodificar chave: %w", err)
		}
		keyString = string(keyBytes)
	}

	var knownString string
	if body.KnownHostsData != nil && *body.KnownHostsData != "" {
		knownBytes, err := base64.StdEncoding.DecodeString(*body.KnownHostsData)
		if err != nil {
			return fmt.Errorf("erro ao decodificar knownHosts: %w", err)
		}
		knownString = string(knownBytes)
	}

	var alias string
	if body.Alias != nil {
		alias = *body.Alias
	}

	connection := models.SshConnectionModel{
		Alias:          alias,
		Host:           types.EncryptedString{Plaintext: body.Host},
		SystemUser:     body.SystemUser,
		Port:           port,
		Key:            types.EncryptedString{Plaintext: keyString},
		KnownHostsData: types.EncryptedString{Plaintext: knownString},
		UserID:         body.UserID,
	}

	if connection.Host.Plaintext == "" {
		return fmt.Errorf("erro: host está vazio antes do insert")
	}

	if err := handlerStruct.DataBase.Select("*").Create(&connection).Error; err != nil {
		return fmt.Errorf("erro ao criar conexão: %w", err)
	}

	return nil
}

func (handlerStruct *SshHandlerStruct) FindAllConnectionByUser(token string, userId int) ([]dtos.SshDto, error) {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return nil, err
	}

	var connections []models.SshConnectionModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).
		Where("user_id = ?", userId).
		Find(&connections).Error; err != nil {
		return nil, err
	}

	return dtos.ToSshDTOList(connections), nil
}

func (handlerStruct *SshHandlerStruct) GetById(token string, id int) (dtos.SshDto, error) {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return dtos.SshDto{}, err
	}

	var connection models.SshConnectionModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).
		Where("id = ?", id).
		First(&connection).Error; err != nil {
		return dtos.SshDto{}, err
	}

	return *dtos.ToSshDTO(&connection), nil
}

func (handlerStruct *SshHandlerStruct) DeleteConnection(token string, id int) error {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return err
	}

	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).
		Where("id = ?", id).
		Delete(&models.SshConnectionModel{}).Error; err != nil {
		return err
	}

	return nil
}
