package generalConfigsDtos

import "docker-manager-go/src/models"

type SaveGeneralConfigInputDto struct {
	Config     string `json:"config"`
	ConfigType string `json:"configType"`
	ModuleName string `json:"moduleName"`
}

type GeneralConfigDto struct {
	ID         uint   `json:"id"`
	Config     string `json:"config"`
	IsActive   bool   `json:"isActive"`
	ConfigType string `json:"configType"`
	ModuleName string `json:"moduleName"`
}

func ToDTO(model *models.GeneralConfigsModel) *GeneralConfigDto {
	return &GeneralConfigDto{
		ID:         model.ID,
		Config:     model.Config,
		IsActive:   model.IsActive,
		ConfigType: string(model.ConfigType),
		ModuleName: string(model.ModuleName),
	}
}
