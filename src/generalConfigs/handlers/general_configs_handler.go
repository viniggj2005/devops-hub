package generalConfigsHandlers

import (
	"context"
	"encoding/json"
	"errors"

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

func (handlerStruct *GeneralConfigsHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
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

func (handlerStruct *GeneralConfigsHandlerStruct) Save(token string, body generalConfigsDtos.SaveGeneralConfigInputDto) (*generalConfigsDtos.GeneralConfigDto, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}

	configType := models.ConfigType(body.ConfigType)
	moduleName := models.ModuleName(body.ModuleName)
	if !moduleName.IsValid() {
		return nil, errors.New("módulo inválido: " + body.ModuleName)
	}
	if !configType.IsValid() {
		return nil, errors.New("tipo de configuração inválido: " + body.ConfigType)
	}

	var configObject map[string]any
	if err := json.Unmarshal([]byte(body.Config), &configObject); err != nil {
		return nil, errors.New("a configuração precisa ser um objeto JSON válido")
	}

	var configModel models.GeneralConfigsModel
	err = handlerStruct.DataBase.WithContext(handlerStruct.context).Transaction(func(transaction *gorm.DB) error {
		findError := transaction.
			Where("user_id = ? AND module_name = ? AND config_type = ?", session.UserID, moduleName, configType).
			First(&configModel).Error
		if errors.Is(findError, gorm.ErrRecordNotFound) {
			configModel = models.GeneralConfigsModel{
				Config:     body.Config,
				IsActive:   true,
				UserID:     session.UserID,
				ConfigType: configType,
				ModuleName: moduleName,
			}
			return transaction.Create(&configModel).Error
		}
		if findError != nil {
			return findError
		}
		configModel.Config = body.Config
		configModel.IsActive = true
		return transaction.Save(&configModel).Error
	})
	if err != nil {
		return nil, err
	}
	return generalConfigsDtos.ToDTO(&configModel), nil
}
