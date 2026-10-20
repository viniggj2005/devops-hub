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
	"docker-manager-go/src/desktop"
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	userDtos "docker-manager-go/src/user/dtos"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type UpdateChecker interface {
	AutoCheckForUpdates()
}

type AuthHandlerStruct struct {
	DataBase      *gorm.DB
	updateChecker UpdateChecker
	context       context.Context
	Session       *authFunctions.ManagerStruct
}

func NewAuthHandler(dataBase *gorm.DB, sessionManager *authFunctions.ManagerStruct, updateChecker UpdateChecker) *AuthHandlerStruct {
	return &AuthHandlerStruct{
		DataBase:      dataBase,
		updateChecker: updateChecker,
		Session:       sessionManager,
	}
}

func (handlerStruct *AuthHandlerStruct) ServiceStartup(context context.Context, _ application.ServiceOptions) error {
	handlerStruct.context = context
	return nil
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

	desktop.Broadcast("auth:changed", true)
	uDTO := userDtos.ToDTO(&userModel)

	if handlerStruct.updateChecker != nil {
		go handlerStruct.updateChecker.AutoCheckForUpdates()
	}

	return &authDtos.LoginResponseDto{
		Token: token,
		User:  *uDTO,
	}, nil
}

func (handlerStruct *AuthHandlerStruct) Logout(token string) {
	handlerStruct.Session.Destroy(token)
	desktop.Broadcast("auth:changed", false)
}

func (handlerStruct *AuthHandlerStruct) ClaimWindowSession(ctx context.Context) (*authDtos.LoginResponseDto, error) {
	windowName := desktop.CallingWindowName(ctx)
	if windowName == "" {
		return nil, errors.New("janela de origem desconhecida")
	}

	token, session, err := handlerStruct.Session.ClaimForWindow(windowName)
	if err != nil {
		return nil, err
	}

	var userModel models.UserModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).First(&userModel, session.UserID).Error; err != nil {
		handlerStruct.Session.Destroy(token)
		return nil, err
	}

	return &authDtos.LoginResponseDto{
		Token: token,
		User:  *userDtos.ToDTO(&userModel),
	}, nil
}

func deriveSessionKey(password, email string) string {
	salt := []byte(email)
	key := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return hex.EncodeToString(key)
}
