package userDtos

import (
	"docker-manager-go/src/models"
	"testing"

	"gorm.io/gorm"
)

func TestToDTO(test *testing.T) {
	model := &models.UserModel{
		Model:    gorm.Model{ID: 7},
		Name:     "Vinicius",
		Email:    "vini@example.com",
		Password: "hashed-password",
	}

	dto := ToDTO(model)
	if dto.ID != 7 || dto.Name != "Vinicius" || dto.Email != "vini@example.com" {
		test.Fatalf("unexpected DTO values: %+v", dto)
	}
}

