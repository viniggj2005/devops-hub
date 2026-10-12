package generalConfigsHandlers

import (
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"

	"docker-manager-go/src/models"
	generalConfigsDtos "docker-manager-go/src/generalConfigs/dtos"
)

const maxThemeProfileNameLength = 60

func validateThemeProfile(body *generalConfigsDtos.SaveThemeProfileInputDto) error {
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" {
		return errors.New("dê um nome ao perfil de tema")
	}
	if utf8.RuneCountInString(body.Name) > maxThemeProfileNameLength {
		return errors.New("o nome do perfil pode ter no máximo 60 caracteres")
	}
	var configObject map[string]any
	if err := json.Unmarshal([]byte(body.Config), &configObject); err != nil {
		return errors.New("o perfil precisa ser um objeto JSON válido")
	}
	return nil
}

func (handlerStruct *GeneralConfigsHandlerStruct) FindAllThemeProfiles(token string) ([]generalConfigsDtos.ThemeProfileDto, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}

	var profileModels []models.ThemeProfileModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).
		Where("user_id = ?", session.UserID).
		Order("name COLLATE NOCASE").
		Find(&profileModels).Error; err != nil {
		return nil, err
	}

	profiles := make([]generalConfigsDtos.ThemeProfileDto, 0, len(profileModels))
	for index := range profileModels {
		profiles = append(profiles, *generalConfigsDtos.ToThemeProfileDTO(&profileModels[index]))
	}
	return profiles, nil
}

func (handlerStruct *GeneralConfigsHandlerStruct) SaveThemeProfile(token string, body generalConfigsDtos.SaveThemeProfileInputDto) (*generalConfigsDtos.ThemeProfileDto, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}
	if err := validateThemeProfile(&body); err != nil {
		return nil, err
	}

	var profileModel models.ThemeProfileModel
	err = handlerStruct.DataBase.WithContext(handlerStruct.context).Transaction(func(transaction *gorm.DB) error {
		var duplicates int64
		if err := transaction.Model(&models.ThemeProfileModel{}).
			Where("user_id = ? AND name = ? AND id <> ?", session.UserID, body.Name, body.ID).
			Count(&duplicates).Error; err != nil {
			return err
		}
		if duplicates > 0 {
			return errors.New("já existe um perfil de tema com o nome " + body.Name)
		}

		if body.ID == 0 {
			profileModel = models.ThemeProfileModel{Name: body.Name, Config: body.Config, UserID: session.UserID}
			return transaction.Create(&profileModel).Error
		}
		if err := transaction.Where("id = ? AND user_id = ?", body.ID, session.UserID).First(&profileModel).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("perfil de tema não encontrado")
			}
			return err
		}
		profileModel.Name = body.Name
		profileModel.Config = body.Config
		return transaction.Save(&profileModel).Error
	})
	if err != nil {
		return nil, err
	}
	return generalConfigsDtos.ToThemeProfileDTO(&profileModel), nil
}

func (handlerStruct *GeneralConfigsHandlerStruct) DeleteThemeProfile(token string, profileID uint) error {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return err
	}
	result := handlerStruct.DataBase.WithContext(handlerStruct.context).
		Unscoped().
		Where("id = ? AND user_id = ?", profileID, session.UserID).
		Delete(&models.ThemeProfileModel{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("perfil de tema não encontrado")
	}
	return nil
}
