package generalConfigsDtos

import (
	"docker-manager-go/src/models"
	"testing"

	"gorm.io/gorm"
)

func TestToDTOAndToThemeProfileDTO(test *testing.T) {
	generalModel := &models.GeneralConfigsModel{
		Model:      gorm.Model{ID: 12},
		Config:     `{"dark":true}`,
		IsActive:   true,
		ConfigType: models.Theme,
		ModuleName: models.Vulpes,
	}

	generalDto := ToDTO(generalModel)
	if generalDto.ID != 12 || generalDto.Config != `{"dark":true}` || !generalDto.IsActive || generalDto.ConfigType != "theme" || generalDto.ModuleName != "vulpes" {
		test.Fatalf("unexpected generalConfig DTO: %+v", generalDto)
	}

	themeModel := &models.ThemeProfileModel{
		Model:  gorm.Model{ID: 5},
		Name:   "Cyberpunk",
		Config: `{"accent":"#ff00ff"}`,
	}

	themeDto := ToThemeProfileDTO(themeModel)
	if themeDto.ID != 5 || themeDto.Name != "Cyberpunk" || themeDto.Config != `{"accent":"#ff00ff"}` {
		test.Fatalf("unexpected themeProfile DTO: %+v", themeDto)
	}
}

