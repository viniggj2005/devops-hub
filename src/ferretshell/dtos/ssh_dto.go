package ferretShellDtos

import (
	"docker-manager-go/src/models"
	"time"
)

type CreateSshConnectionInputDto struct {
	Host           string  `json:"host" binding:"required"`
	SystemUser     string  `json:"systemUser" binding:"required"`
	Alias          *string `json:"alias,omitempty"`
	Port           *int64  `json:"port,omitempty"`
	Key            *string `json:"key,omitempty"`
	KnownHostsData *string `json:"knownHosts,omitempty"`
	UserID         uint    `json:"userId" binding:"required"`
}

type SshDto struct {
	ID             uint    `json:"id"`
	Host           string  `json:"host"`
	Alias          *string `json:"alias,omitempty"`
	SystemUser     string  `json:"systemUser"`
	Port           *int64  `json:"port,omitempty"`
	Key            *string `json:"key,omitempty"`
	KnownHostsData *string `json:"knownHosts,omitempty"`
	UserID         uint    `json:"userId"`
}
type SSHConnectionDto struct {
	SshSessionId string
	Host         string
	Port         int
	User         string

	Password   string
	Key        []byte
	KeyPath    string
	Passphrase string

	KnownHostsPath        string
	InsecureIgnoreHostKey bool

	Cols, Rows int
	Timeout    time.Duration
}

func ToSshDTO(model *models.SshConnectionModel) *SshDto {
	host := model.Host.Plaintext

	var keyPointer *string
	if model.Key.Plaintext != "" {
		keyPointer = &model.Key.Plaintext
	}

	var knownPointer *string
	if model.KnownHostsData.Plaintext != "" {
		knownPointer = &model.KnownHostsData.Plaintext
	}

	return &SshDto{
		ID:             model.ID,
		Host:           host,
		Alias:          &model.Alias,
		SystemUser:     model.SystemUser,
		Port:           &model.Port,
		Key:            keyPointer,
		KnownHostsData: knownPointer,
		UserID:         model.UserID,
	}
}

func ToSshDTOList(connections []models.SshConnectionModel) []SshDto {
	list := make([]SshDto, 0, len(connections))
	for _, connection := range connections {
		list = append(list, *ToSshDTO(&connection))
	}
	return list
}
