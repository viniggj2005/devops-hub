package userHandlers

import (
	"context"

	"docker-manager-go/src/appErrors"
	auth "docker-manager-go/src/auth/functions"

	"docker-manager-go/src/models"
	userDtos "docker-manager-go/src/user/dtos"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var errInvalidLanguage = appErrors.New("user.invalidLanguage", "idioma inválido")

type UserHandlerStruct struct {
	DataBase *gorm.DB
	context  context.Context
	Session  *auth.ManagerStruct
}

func NewUserHandler(dataBase *gorm.DB, session *auth.ManagerStruct) *UserHandlerStruct {
	return &UserHandlerStruct{DataBase: dataBase, Session: session}
}
func (handlerStruct *UserHandlerStruct) ServiceStartup(context context.Context, _ application.ServiceOptions) error {
	handlerStruct.context = context
	return nil
}

func (handlerStruct *UserHandlerStruct) Create(body userDtos.CreateUserInputDto) (*userDtos.UserDTO, error) {
	if body.Name == "" || body.Email == "" || body.Password == "" {
		return nil, appErrors.New("user.requiredFields", "nome, email e password são obrigatórios")
	}
	language := body.Language
	if language == "" {
		language = models.DefaultLanguage
	}
	if !language.IsValid() {
		return nil, errInvalidLanguage
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := &models.UserModel{Name: body.Name, Email: body.Email, Password: string(hash), Language: language}
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).Create(user).Error; err != nil {
		return nil, err
	}
	return userDtos.ToDTO(user), nil
}

func (handlerStruct *UserHandlerStruct) GetByID(token string, id uint) (*userDtos.UserDTO, error) {
	if err := auth.MustAuth(handlerStruct.Session, token); err != nil {
		return nil, err
	}
	var userModel models.UserModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).First(&userModel, id).Error; err != nil {
		return nil, err
	}
	return userDtos.ToDTO(&userModel), nil
}

func (handlerStruct *UserHandlerStruct) Update(token string, id uint, body userDtos.UpdateUserInputDto) (*userDtos.UserDTO, error) {
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
	if body.Language != nil {
		if !body.Language.IsValid() {
			return nil, errInvalidLanguage
		}
		userModel.Language = *body.Language
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
	return userDtos.ToDTO(&userModel), nil
}

func (handlerStruct *UserHandlerStruct) UpdateLanguage(token string, language models.Language) (*userDtos.UserDTO, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}
	if !language.IsValid() {
		return nil, errInvalidLanguage
	}

	var userModel models.UserModel
	dataBase := handlerStruct.DataBase.WithContext(handlerStruct.context)
	if err := dataBase.First(&userModel, session.UserID).Error; err != nil {
		return nil, err
	}
	if err := dataBase.Model(&userModel).Update("language", language).Error; err != nil {
		return nil, err
	}
	userModel.Language = language
	return userDtos.ToDTO(&userModel), nil
}

func (handlerStruct *UserHandlerStruct) MyInfo(token string) (*userDtos.UserDTO, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return nil, err
	}

	var userModel models.UserModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.context).First(&userModel, session.UserID).Error; err != nil {
		return nil, err
	}
	return userDtos.ToDTO(&userModel), nil
}
