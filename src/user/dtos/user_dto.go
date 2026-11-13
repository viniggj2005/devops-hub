package userDtos

import "docker-manager-go/src/models"

type CreateUserInputDto struct {
	Name     string          `json:"nome"`
	Email    string          `json:"email"`
	Password string          `json:"password"`
	Language models.Language `json:"language,omitempty"`
}

type UpdateUserInputDto struct {
	Name     *string          `json:"nome,omitempty"`
	Email    *string          `json:"email,omitempty"`
	Password *string          `json:"password,omitempty"`
	Language *models.Language `json:"language,omitempty"`
}

type UserDTO struct {
	ID       uint            `json:"id"`
	Name     string          `json:"nome"`
	Email    string          `json:"email"`
	Language models.Language `json:"language"`
}

func ToDTO(model *models.UserModel) *UserDTO {
	language := model.Language
	if !language.IsValid() {
		language = models.DefaultLanguage
	}
	return &UserDTO{ID: model.ID, Name: model.Name, Email: model.Email, Language: language}
}
