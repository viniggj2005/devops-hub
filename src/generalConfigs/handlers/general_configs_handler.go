package generalConfigsHandlers

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"docker-manager-go/src/models"
	auth "docker-manager-go/src/auth/functions"
	generalConfigsDtos "docker-manager-go/src/generalConfigs/dtos"
)

type GeneralConfigsHandlerStruct struct {
	DataBase *gorm.DB
	context  context.Context
	Session  *auth.ManagerStruct
}

func NewGeneralConfigsHandler(dataBase *gorm.DB, session *auth.ManagerStruct) *GeneralConfigsHandlerStruct {
	return &GeneralConfigsHandlerStruct{DataBase: dataBase, Session: session}
}

func (handlerStruct *GeneralConfigsHandlerStruct) ServiceStartup(context context.Context, _ application.ServiceOptions) error {
	handlerStruct.context = context
	return nil
}

func (handlerStruct *GeneralConfigsHandlerStruct) FindAll(token string) ([]generalConfigsDtos.GeneralConfigDto, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}

	var configModels []models.GeneralConfigsModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).
		Where("user_id = ? AND is_active = ?", session.UserID, true).
		Find(&configModels).Error; err != nil {
		return nil, err
	}

	configs := make([]generalConfigsDtos.GeneralConfigDto, 0, len(configModels))
	for index := range configModels {
		configs = append(configs, *generalConfigsDtos.ToDTO(&configModels[index]))
	}
	return configs, nil
}

func validateGeneralConfig(body generalConfigsDtos.SaveGeneralConfigInputDto) error {
	if !models.ModuleName(body.ModuleName).IsValid() {
		return errors.New("módulo inválido: " + body.ModuleName)
	}
	if !models.ConfigType(body.ConfigType).IsValid() {
		return errors.New("tipo de configuração inválido: " + body.ConfigType)
	}
	var configObject map[string]any
	if err := json.Unmarshal([]byte(body.Config), &configObject); err != nil {
		return errors.New("a configuração precisa ser um objeto JSON válido")
	}
	return nil
}

func upsertGeneralConfig(transaction *gorm.DB, userID uint, body generalConfigsDtos.SaveGeneralConfigInputDto) (models.GeneralConfigsModel, error) {
	var configModel models.GeneralConfigsModel
	configType := models.ConfigType(body.ConfigType)
	moduleName := models.ModuleName(body.ModuleName)
	findError := transaction.
		Where("user_id = ? AND module_name = ? AND config_type = ?", userID, moduleName, configType).
		First(&configModel).Error
	if errors.Is(findError, gorm.ErrRecordNotFound) {
		configModel = models.GeneralConfigsModel{
			Config:     body.Config,
			IsActive:   true,
			UserID:     userID,
			ConfigType: configType,
			ModuleName: moduleName,
		}
		return configModel, transaction.Create(&configModel).Error
	}
	if findError != nil {
		return configModel, findError
	}
	configModel.Config = body.Config
	configModel.IsActive = true
	return configModel, transaction.Save(&configModel).Error
}

func (handlerStruct *GeneralConfigsHandlerStruct) Save(token string, body generalConfigsDtos.SaveGeneralConfigInputDto) (*generalConfigsDtos.GeneralConfigDto, error) {
	configs, err := handlerStruct.SaveMany(token, []generalConfigsDtos.SaveGeneralConfigInputDto{body})
	if err != nil {
		return nil, err
	}
	return &configs[0], nil
}

func (handlerStruct *GeneralConfigsHandlerStruct) SaveMany(token string, bodies []generalConfigsDtos.SaveGeneralConfigInputDto) ([]generalConfigsDtos.GeneralConfigDto, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}
	if len(bodies) == 0 {
		return []generalConfigsDtos.GeneralConfigDto{}, nil
	}
	for _, body := range bodies {
		if err := validateGeneralConfig(body); err != nil {
			return nil, err
		}
	}

	configs := make([]generalConfigsDtos.GeneralConfigDto, 0, len(bodies))
	err = handlerStruct.DataBase.WithContext(handlerStruct.context).Transaction(func(transaction *gorm.DB) error {
		for _, body := range bodies {
			configModel, err := upsertGeneralConfig(transaction, session.UserID, body)
			if err != nil {
				return err
			}
			configs = append(configs, *generalConfigsDtos.ToDTO(&configModel))
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return configs, nil
}
