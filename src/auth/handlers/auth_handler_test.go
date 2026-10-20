package authHandlers

import (
	"context"
	authDtos "docker-manager-go/src/auth/dtos"
	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type mockUpdateChecker struct {
	called chan struct{}
}

func (checker *mockUpdateChecker) AutoCheckForUpdates() {
	select {
	case checker.called <- struct{}{}:
	default:
	}
}

func TestDeriveSessionKeyAndAuthHandler(test *testing.T) {
	firstKey := deriveSessionKey("password123", "user@example.com")
	secondKey := deriveSessionKey("password123", "user@example.com")
	differentKey := deriveSessionKey("password123", "other@example.com")

	if len(firstKey) != 64 {
		test.Fatalf("expected 64 hex chars, got %d", len(firstKey))
	}
	if firstKey != secondKey {
		test.Fatalf("expected deterministic key derivation")
	}
	if firstKey == differentKey {
		test.Fatalf("expected different salt to produce different key")
	}

	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(&models.UserModel{}); err != nil {
		test.Fatalf("unexpected error migrating UserModel: %v", err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("validPass"), bcrypt.DefaultCost)
	if err != nil {
		test.Fatalf("unexpected error hashing password: %v", err)
	}
	user := models.UserModel{
		Name:     "Auth User",
		Email:    "auth@example.com",
		Password: string(hashedPassword),
	}
	if err := dataBase.Create(&user).Error; err != nil {
		test.Fatalf("unexpected error creating user: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	updateChecker := &mockUpdateChecker{called: make(chan struct{}, 1)}
	handler := NewAuthHandler(dataBase, sessionManager, updateChecker)
	handler.ServiceStartup(context.Background(), application.ServiceOptions{})

	_, err = handler.Login(authDtos.LoginInputDto{
		Email:    "unknown@example.com",
		Password: "validPass",
	})
	if err == nil {
		test.Fatalf("expected error for unknown email")
	}

	_, err = handler.Login(authDtos.LoginInputDto{
		Email:    "auth@example.com",
		Password: "wrongPass",
	})
	if err == nil {
		test.Fatalf("expected error for wrong password")
	}
}

