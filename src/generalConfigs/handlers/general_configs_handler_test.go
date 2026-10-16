package generalConfigsHandlers

import (
	"context"
	authFunctions "docker-manager-go/src/auth/functions"
	generalConfigsDtos "docker-manager-go/src/generalConfigs/dtos"
	"docker-manager-go/src/models"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupGeneralConfigsTestHandler(test *testing.T) (*GeneralConfigsHandlerStruct, string) {
	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(&models.UserModel{}, &models.GeneralConfigsModel{}, &models.ThemeProfileModel{}); err != nil {
		test.Fatalf("unexpected error migrating models: %v", err)
	}

	user := models.UserModel{Name: "Tester", Email: "tester@example.com", Password: "pwd"}
	if err := dataBase.Create(&user).Error; err != nil {
		test.Fatalf("unexpected error creating user: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	token, _, err := sessionManager.Create(user.ID)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	handler := NewGeneralConfigsHandler(dataBase, sessionManager)
	handler.Startup(context.Background())

	return handler, token
}

func TestGeneralConfigsSaveAndFindAll(test *testing.T) {
	handler, token := setupGeneralConfigsTestHandler(test)

	if _, err := handler.FindAll("invalid"); err == nil {
		test.Fatalf("expected error on FindAll with invalid token")
	}

	if _, err := handler.SaveMany("invalid", nil); err == nil {
		test.Fatalf("expected error on SaveMany with invalid token")
	}

	emptyResult, err := handler.SaveMany(token, nil)
	if err != nil || len(emptyResult) != 0 {
		test.Fatalf("expected empty result on empty SaveMany, got %+v, err=%v", emptyResult, err)
	}

	_, err = handler.Save(token, generalConfigsDtos.SaveGeneralConfigInputDto{
		Config:     `{"ok":true}`,
		ConfigType: "theme",
		ModuleName: "invalid-module",
	})
	if err == nil {
		test.Fatalf("expected error for invalid moduleName")
	}

	_, err = handler.Save(token, generalConfigsDtos.SaveGeneralConfigInputDto{
		Config:     `{"ok":true}`,
		ConfigType: "invalid-type",
		ModuleName: "vulpes",
	})
	if err == nil {
		test.Fatalf("expected error for invalid configType")
	}

	_, err = handler.Save(token, generalConfigsDtos.SaveGeneralConfigInputDto{
		Config:     `not-json`,
		ConfigType: "theme",
		ModuleName: "vulpes",
	})
	if err == nil {
		test.Fatalf("expected error for invalid JSON config")
	}

	saved, err := handler.Save(token, generalConfigsDtos.SaveGeneralConfigInputDto{
		Config:     `{"mode":"dark"}`,
		ConfigType: "theme",
		ModuleName: "vulpes",
	})
	if err != nil {
		test.Fatalf("unexpected error saving config: %v", err)
	}
	if saved.Config != `{"mode":"dark"}` {
		test.Fatalf("unexpected saved config: %+v", saved)
	}

	updated, err := handler.Save(token, generalConfigsDtos.SaveGeneralConfigInputDto{
		Config:     `{"mode":"light"}`,
		ConfigType: "theme",
		ModuleName: "vulpes",
	})
	if err != nil {
		test.Fatalf("unexpected error updating config: %v", err)
	}
	if updated.ID != saved.ID || updated.Config != `{"mode":"light"}` {
		test.Fatalf("expected upsert to update existing record, got %+v", updated)
	}

	allConfigs, err := handler.FindAll(token)
	if err != nil {
		test.Fatalf("unexpected error finding all configs: %v", err)
	}
	if len(allConfigs) != 1 || allConfigs[0].Config != `{"mode":"light"}` {
		test.Fatalf("unexpected FindAll result: %+v", allConfigs)
	}
}

func TestThemeProfilesCRUD(test *testing.T) {
	handler, token := setupGeneralConfigsTestHandler(test)

	if _, err := handler.FindAllThemeProfiles("invalid"); err == nil {
		test.Fatalf("expected error with invalid token")
	}
	if _, err := handler.SaveThemeProfile("invalid", generalConfigsDtos.SaveThemeProfileInputDto{}); err == nil {
		test.Fatalf("expected error with invalid token")
	}
	if err := handler.DeleteThemeProfile("invalid", 1); err == nil {
		test.Fatalf("expected error with invalid token")
	}

	_, err := handler.SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto{
		Name:   "   ",
		Config: `{"color":"red"}`,
	})
	if err == nil {
		test.Fatalf("expected error for empty name")
	}

	_, err = handler.SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto{
		Name:   strings.Repeat("a", 61),
		Config: `{"color":"red"}`,
	})
	if err == nil {
		test.Fatalf("expected error for name exceeding 60 characters")
	}

	_, err = handler.SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto{
		Name:   "Valid Name",
		Config: `invalid-json`,
	})
	if err == nil {
		test.Fatalf("expected error for invalid JSON in theme profile")
	}

	created, err := handler.SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto{
		Name:   "Ocean",
		Config: `{"primary":"#0055ff"}`,
	})
	if err != nil {
		test.Fatalf("unexpected error creating theme profile: %v", err)
	}
	if created.ID == 0 || created.Name != "Ocean" {
		test.Fatalf("unexpected created profile: %+v", created)
	}

	_, err = handler.SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto{
		Name:   "Ocean",
		Config: `{"primary":"#000000"}`,
	})
	if err == nil {
		test.Fatalf("expected error for duplicate theme profile name")
	}

	_, err = handler.SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto{
		ID:     9999,
		Name:   "NonExistent",
		Config: `{"primary":"#000000"}`,
	})
	if err == nil {
		test.Fatalf("expected error updating non-existent theme profile")
	}

	updated, err := handler.SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto{
		ID:     created.ID,
		Name:   "Deep Ocean",
		Config: `{"primary":"#002288"}`,
	})
	if err != nil {
		test.Fatalf("unexpected error updating theme profile: %v", err)
	}
	if updated.Name != "Deep Ocean" {
		test.Fatalf("expected Deep Ocean, got %s", updated.Name)
	}

	profiles, err := handler.FindAllThemeProfiles(token)
	if err != nil || len(profiles) != 1 || profiles[0].Name != "Deep Ocean" {
		test.Fatalf("unexpected profiles list: %+v, err=%v", profiles, err)
	}

	if err := handler.DeleteThemeProfile(token, 9999); err == nil {
		test.Fatalf("expected error deleting non-existent theme profile")
	}

	if err := handler.DeleteThemeProfile(token, created.ID); err != nil {
		test.Fatalf("unexpected error deleting theme profile: %v", err)
	}

	profilesAfterDelete, err := handler.FindAllThemeProfiles(token)
	if err != nil || len(profilesAfterDelete) != 0 {
		test.Fatalf("expected 0 profiles after delete, got %+v, err=%v", profilesAfterDelete, err)
	}
}

