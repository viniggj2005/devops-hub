package cloudSyncHandlers

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	auth "docker-manager-go/src/auth/functions"
	cloudSyncFunctions "docker-manager-go/src/cloudSync/functions"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestCloudSyncHandlerWithoutAccount(test *testing.T) {
	test.Setenv("GOOGLE_CLIENT_ID", "")
	test.Setenv("GOOGLE_CLIENT_SECRET", "")

	sessionManager := auth.NewManager(time.Hour)
	token, _, err := sessionManager.Create(1)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}
	handler := NewCloudSyncHandler(nil, sessionManager, filepath.Join(test.TempDir(), "secure.db"))
	ctx := context.Background()

	if _, err := handler.Status(ctx, "invalid-token"); err == nil {
		test.Fatalf("expected an invalid session to be rejected")
	}
	status, err := handler.Status(ctx, token)
	if err != nil || status.Connected || status.Configured || status.LastSyncedAt != "" {
		test.Fatalf("expected a disconnected and unconfigured status, got %+v err=%v", status, err)
	}
	if _, err := handler.Connect(ctx, token); err == nil {
		test.Fatalf("expected connect to fail without Google credentials")
	}
	if _, err := handler.UploadNow(ctx, token); !errors.Is(err, cloudSyncFunctions.ErrNotConnected) {
		test.Fatalf("expected upload without account to fail with ErrNotConnected, got %v", err)
	}
	if err := handler.ServiceShutdown(); err != nil {
		test.Fatalf("expected shutdown without account to be a no-op, got %v", err)
	}
	if err := handler.Disconnect(ctx, token); err != nil {
		test.Fatalf("expected disconnect without account to succeed, got %v", err)
	}
}

func TestRestoreAndRestartKeepsDatabaseWhenNothingToRestore(test *testing.T) {
	dataBasePath := filepath.Join(test.TempDir(), "secure.db")
	dataBase, err := gorm.Open(sqlite.Open("file:"+dataBasePath), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening database: %v", err)
	}
	test.Cleanup(func() {
		if connection, err := dataBase.DB(); err == nil {
			connection.Close()
		}
	})
	handler := NewCloudSyncHandler(dataBase, auth.NewManager(time.Hour), dataBasePath)
	restarted := false
	handler.restartApp = func() error {
		restarted = true
		return nil
	}

	if status, err := handler.LoginScreenStatus(context.Background()); err != nil || status.Connected {
		test.Fatalf("expected a disconnected login screen status, got %+v err=%v", status, err)
	}
	if err := handler.RestoreAndRestart(context.Background()); err == nil {
		test.Fatalf("expected restore without a cloud backup to fail")
	}
	if restarted || handler.skipShutdownUpload {
		test.Fatalf("expected no restart and the shutdown upload to stay enabled")
	}
	if err := dataBase.Exec("SELECT 1").Error; err != nil {
		test.Fatalf("expected the local database to stay open, got %v", err)
	}
}
