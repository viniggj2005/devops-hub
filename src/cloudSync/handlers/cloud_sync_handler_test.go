package cloudSyncHandlers

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	auth "docker-manager-go/src/auth/functions"
	cloudSyncFunctions "docker-manager-go/src/cloudSync/functions"
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
