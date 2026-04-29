package userDtos

import "docker-manager-go/src/models"

type CreateUserInputDto struct {
	Name     string `json:"nome"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UpdateUserInputDto struct {
	Name     *string `json:"nome,omitempty"`
	Email    *string `json:"email,omitempty"`
	Password *string `json:"password,omitempty"`
}

type UserDTO struct {
	ID    uint   `json:"id"`
	Name  string `json:"nome"`
	Email string `json:"email"`
}

func ToDTO(model *models.UserModel) *UserDTO {
	return &UserDTO{ID: model.ID, Name: model.Name, Email: model.Email}
}
