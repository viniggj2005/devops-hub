package authDtos

import userDtos "docker-manager-go/src/user/dtos"

type LoginInputDto struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponseDto struct {
	Token string           `json:"token"`
	User  userDtos.UserDTO `json:"user"`
}
