package octohubDtos

import "docker-manager-go/src/models"

type DeviceCodeDto struct {
	UserCode        string `json:"userCode"`
	ExpiresIn       int    `json:"expiresIn"`
	VerificationUri string `json:"verificationUri"`
}

type GithubAccountDto struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	Login     string `json:"login"`
	GithubID  int64  `json:"githubId"`
	IsActive  bool   `json:"isActive"`
	AvatarURL string `json:"avatarUrl"`
}

func ToGithubAccountDto(model *models.GithubAccountModel) *GithubAccountDto {
	return &GithubAccountDto{
		ID:        model.ID,
		Name:      model.Name,
		Login:     model.Login,
		GithubID:  model.GithubID,
		IsActive:  model.IsActive,
		AvatarURL: model.AvatarURL,
	}
}

func ToGithubAccountDtoList(accounts []models.GithubAccountModel) []GithubAccountDto {
	list := make([]GithubAccountDto, 0, len(accounts))
	for _, account := range accounts {
		list = append(list, *ToGithubAccountDto(&account))
	}
	return list
}
