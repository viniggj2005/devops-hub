package userHandlers

import (
	"context"
	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	userDtos "docker-manager-go/src/user/dtos"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func setupUserTestHandler(test *testing.T) (*UserHandlerStruct, string, uint) {
	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(&models.UserModel{}); err != nil {
		test.Fatalf("unexpected error migrating UserModel: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	handler := NewUserHandler(dataBase, sessionManager)
	handler.ServiceStartup(context.Background(), application.ServiceOptions{})

	created, err := handler.Create(userDtos.CreateUserInputDto{
		Name:     "Admin",
		Email:    "admin@example.com",
		Password: "secretPassword123",
	})
	if err != nil {
		test.Fatalf("unexpected error creating user: %v", err)
	}

	token, _, err := sessionManager.Create(created.ID)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	return handler, token, created.ID
}

func TestUserHandlerCreateValidationAndDuplicate(test *testing.T) {
	handler, _, _ := setupUserTestHandler(test)

	_, err := handler.Create(userDtos.CreateUserInputDto{Name: "", Email: "a@b.com", Password: "123"})
	if err == nil {
		test.Fatalf("expected error when name is empty")
	}

	_, err = handler.Create(userDtos.CreateUserInputDto{Name: "Name", Email: "", Password: "123"})
	if err == nil {
		test.Fatalf("expected error when email is empty")
	}

	_, err = handler.Create(userDtos.CreateUserInputDto{Name: "Name", Email: "a@b.com", Password: ""})
	if err == nil {
		test.Fatalf("expected error when password is empty")
	}

	_, err = handler.Create(userDtos.CreateUserInputDto{
		Name:     "Duplicate",
		Email:    "admin@example.com",
		Password: "secretPassword123",
	})
	if err == nil {
		test.Fatalf("expected error when creating user with duplicate email")
	}
}

func TestUserHandlerGetUpdateAndMyInfo(test *testing.T) {
	handler, token, userID := setupUserTestHandler(test)

	_, err := handler.GetByID("invalid-token", userID)
	if err == nil {
		test.Fatalf("expected error with invalid token")
	}

	_, err = handler.GetByID(token, 9999)
	if err == nil {
		test.Fatalf("expected error for non-existent user ID")
	}

	found, err := handler.GetByID(token, userID)
	if err != nil {
		test.Fatalf("unexpected error getting user by ID: %v", err)
	}
	if found.Email != "admin@example.com" {
		test.Fatalf("expected email admin@example.com, got %s", found.Email)
	}

	newName := "Updated Admin"
	newEmail := "updated@example.com"
	newPassword := "newSecret456"

	_, err = handler.Update("invalid-token", userID, userDtos.UpdateUserInputDto{Name: &newName})
	if err == nil {
		test.Fatalf("expected error updating with invalid token")
	}

	_, err = handler.Update(token, 9999, userDtos.UpdateUserInputDto{Name: &newName})
	if err == nil {
		test.Fatalf("expected error updating non-existent user")
	}

	updated, err := handler.Update(token, userID, userDtos.UpdateUserInputDto{
		Name:     &newName,
		Email:    &newEmail,
		Password: &newPassword,
	})
	if err != nil {
		test.Fatalf("unexpected error updating user: %v", err)
	}
	if updated.Name != newName || updated.Email != newEmail {
		test.Fatalf("unexpected updated DTO: %+v", updated)
	}

	var storedModel models.UserModel
	if err := handler.DataBase.First(&storedModel, userID).Error; err != nil {
		test.Fatalf("unexpected error loading stored user: %v", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(storedModel.Password), []byte(newPassword)) != nil {
		test.Fatalf("expected password hash to match updated password")
	}

	_, err = handler.MyInfo("invalid-token")
	if err == nil {
		test.Fatalf("expected error calling MyInfo with invalid token")
	}

	myInfo, err := handler.MyInfo(token)
	if err != nil {
		test.Fatalf("unexpected error calling MyInfo: %v", err)
	}
	if myInfo.ID != userID || myInfo.Name != newName {
		test.Fatalf("unexpected MyInfo result: %+v", myInfo)
	}
}

