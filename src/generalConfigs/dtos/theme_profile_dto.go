package generalConfigsDtos

import "docker-manager-go/src/models"

type SaveThemeProfileInputDto struct {
	ID     uint   `json:"id"`
	Name   string `json:"name"`
	Config string `json:"config"`
}

type ThemeProfileDto struct {
	ID     uint   `json:"id"`
	Name   string `json:"name"`
	Config string `json:"config"`
}

func ToThemeProfileDTO(model *models.ThemeProfileModel) *ThemeProfileDto {
	return &ThemeProfileDto{
		ID:     model.ID,
		Name:   model.Name,
		Config: model.Config,
	}
}
