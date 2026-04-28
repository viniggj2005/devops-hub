package handlers

import (
	"context"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/dtos"
	"docker-manager-go/src/models"
	"errors"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserHandlerStruct struct {
	DataBase *gorm.DB
	context  context.Context
	Session  *auth.ManagerStruct
}

func NewUserHandler(dataBase *gorm.DB, session *auth.ManagerStruct) *UserHandlerStruct {
	return &UserHandlerStruct{DataBase: dataBase, Session: session}
}
func (handlerStruct *UserHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
}

func (handlerStruct *UserHandlerStruct) Create(body dtos.CreateUserInputDto) (*dtos.UserDTO, error) {
	if body.Name == "" || body.Email == "" || body.Password == "" {
		return nil, errors.New("nome, email e password são obrigatórios")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := &models.UserModel{Name: body.Name, Email: body.Email, Password: string(hash)}
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).Create(user).Error; err != nil {
		return nil, err
	}
	return dtos.ToDTO(user), nil
}

func (handlerStruct *UserHandlerStruct) GetByID(token string, id uint) (*dtos.UserDTO, error) {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return nil, err
	}
	var userModel models.UserModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).First(&userModel, id).Error; err != nil {
		return nil, err
	}
	return dtos.ToDTO(&userModel), nil
}

func (handlerStruct *UserHandlerStruct) Update(token string, id uint, body dtos.UpdateUserInputDto) (*dtos.UserDTO, error) {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return nil, err
	}

	var userModel models.UserModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).First(&userModel, id).Error; err != nil {
		return nil, err
	}
	if body.Name != nil {
		userModel.Name = *body.Name
	}
	if body.Email != nil {
		userModel.Email = *body.Email
	}
	if body.Password != nil && *body.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(*body.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		userModel.Password = string(hash)
	}
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).Save(&userModel).Error; err != nil {
		return nil, err
	}
	return dtos.ToDTO(&userModel), nil
}

func (handlerStruct *UserHandlerStruct) MyInfo(token string) (*dtos.UserDTO, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}

	var userModel models.UserModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).First(&userModel, session.UserID).Error; err != nil {
		return nil, err
	}
	return dtos.ToDTO(&userModel), nil
}
