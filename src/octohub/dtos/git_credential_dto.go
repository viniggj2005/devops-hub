package octohubDtos

import "docker-manager-go/src/models"

type GitCredentialDto struct {
	ID          uint   `json:"id"`
	Host        string `json:"host"`
	HasKey      bool   `json:"hasKey"`
	Username    string `json:"username"`
	HasPassword bool   `json:"hasPassword"`
}

type GitCredentialInput struct {
	Host       string `json:"host"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	PrivateKey string `json:"privateKey"`
	Passphrase string `json:"passphrase"`
}

func ToGitCredentialDto(model *models.GitCredentialModel) *GitCredentialDto {
	return &GitCredentialDto{
		ID:          model.ID,
		Host:        model.Host,
		Username:    model.Username,
		HasPassword: model.Password.Plaintext != "",
		HasKey:      model.PrivateKey.Plaintext != "",
	}
}

func ToGitCredentialDtoList(credentials []models.GitCredentialModel) []GitCredentialDto {
	list := make([]GitCredentialDto, 0, len(credentials))
	for _, credential := range credentials {
		list = append(list, *ToGitCredentialDto(&credential))
	}
	return list
}
