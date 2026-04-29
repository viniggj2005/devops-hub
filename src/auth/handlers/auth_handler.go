package authHandlers

import (
	"context"
	"encoding/hex"
	"errors"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	authDtos "docker-manager-go/src/auth/dtos"
	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	userDtos "docker-manager-go/src/user/dtos"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type AuthHandlerStruct struct {
	DataBase *gorm.DB
	context  context.Context
	Session  *authFunctions.ManagerStruct
}

func NewAuthHandler(dataBase *gorm.DB, sessionManager *authFunctions.ManagerStruct) *AuthHandlerStruct {
	return &AuthHandlerStruct{DataBase: dataBase, Session: sessionManager}
}

func (handlerStruct *AuthHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
}

func (handlerStruct *AuthHandlerStruct) Login(body authDtos.LoginInputDto) (*authDtos.LoginResponseDto, error) {
	var userModel models.UserModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).Where("email = ?", body.Email).First(&userModel).Error; err != nil {
		return nil, errors.New("credenciais inválidas")
	}

	if bcrypt.CompareHashAndPassword([]byte(userModel.Password), []byte(body.Password)) != nil {
		return nil, errors.New("credenciais inválidas")
	}

	key := deriveSessionKey(body.Password, userModel.Email)
	if err := types.SetSessionKey(key); err != nil {
		return nil, err
	}

	token, _, err := handlerStruct.Session.Create(userModel.ID)
	if err != nil {
		return nil, err
	}

	runtime.EventsEmit(handlerStruct.context, "auth:changed", true)
	uDTO := userDtos.ToDTO(&userModel)

	return &authDtos.LoginResponseDto{
		Token: token,
		User:  *uDTO,
	}, nil
}

func (handlerStruct *AuthHandlerStruct) Logout(token string) {
	handlerStruct.Session.Destroy(token)
	runtime.EventsEmit(handlerStruct.context, "auth:changed", false)
}

func deriveSessionKey(password, email string) string {
	salt := []byte(email)
	key := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return hex.EncodeToString(key)
}
