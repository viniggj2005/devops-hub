package authDtos

import "docker-manager-go/src/dtos"

type LoginInputDto struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponseDto struct {
	Token string       `json:"token"`
	User  dtos.UserDTO `json:"user"`
}
