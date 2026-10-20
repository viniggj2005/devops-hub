package talpadbDtos

import (
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	"testing"

	"gorm.io/gorm"
)

func TestToConnectionDtoAndList(test *testing.T) {
	connections := []models.TalpadbConnectionModel{
		{
			Model:    gorm.Model{ID: 1},
			Alias:    "Analytics DB",
			Host:     types.EncryptedString{Plaintext: "db.internal"},
			Port:     5432,
			Database: "analytics",
			Username: "analyst",
			Password: types.EncryptedString{Plaintext: "secret"},
			SslMode:  "require",
		},
		{
			Model:    gorm.Model{ID: 2},
			Alias:    "Local DB",
			Host:     types.EncryptedString{Plaintext: "localhost"},
			Port:     5433,
			Database: "postgres",
			Username: "postgres",
			SslMode:  "disable",
		},
	}

	dtoList := ToConnectionDtoList(connections)
	if len(dtoList) != 2 {
		test.Fatalf("expected 2 DTOs, got %d", len(dtoList))
	}
	if dtoList[0].Host != "db.internal" || !dtoList[0].HasPassword || dtoList[0].SslMode != "require" {
		test.Fatalf("unexpected first DTO: %+v", dtoList[0])
	}
	if dtoList[1].HasPassword || dtoList[1].Port != 5433 {
		test.Fatalf("unexpected second DTO: %+v", dtoList[1])
	}
}
