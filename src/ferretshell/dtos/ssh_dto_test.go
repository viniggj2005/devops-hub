package ferretshellDtos

import (
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	"testing"

	"gorm.io/gorm"
)

func TestToSshDTOAndList(test *testing.T) {
	firstModel := models.SshConnectionModel{
		Model:          gorm.Model{ID: 1},
		Alias:          "Prod Server",
		Host:           types.EncryptedString{Plaintext: "10.0.0.5"},
		Port:           2222,
		SystemUser:     "ubuntu",
		Password:       types.EncryptedString{Plaintext: "secret"},
		Key:            types.EncryptedString{Plaintext: "ssh-rsa AAA"},
		KnownHostsData: types.EncryptedString{Plaintext: "10.0.0.5 ssh-rsa"},
		UserID:         9,
	}

	secondModel := models.SshConnectionModel{
		Model:      gorm.Model{ID: 2},
		Host:       types.EncryptedString{Plaintext: "10.0.0.6"},
		Port:       22,
		SystemUser: "root",
		UserID:     9,
	}

	dtoList := ToSshDTOList([]models.SshConnectionModel{firstModel, secondModel})
	if len(dtoList) != 2 {
		test.Fatalf("expected 2 DTOs, got %d", len(dtoList))
	}

	if dtoList[0].Host != "10.0.0.5" || dtoList[0].Alias == nil || *dtoList[0].Alias != "Prod Server" || dtoList[0].Password == nil || dtoList[0].Key == nil || dtoList[0].KnownHostsData == nil {
		test.Fatalf("unexpected first DTO: %+v", dtoList[0])
	}

	if dtoList[1].Alias != nil || dtoList[1].Password != nil || dtoList[1].Key != nil || dtoList[1].KnownHostsData != nil {
		test.Fatalf("expected nil optional pointers on second DTO, got %+v", dtoList[1])
	}
}

