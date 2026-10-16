package authFunctions

import (
	"testing"
	"time"
)

func TestSessionManagerLifecycle(test *testing.T) {
	manager := NewManager(time.Minute)

	token, session, err := manager.Create(42)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}
	if token == "" {
		test.Fatalf("expected non-empty token")
	}
	if session.UserID != 42 {
		test.Fatalf("expected userID 42, got %d", session.UserID)
	}

	validated, err := manager.Validate(token)
	if err != nil {
		test.Fatalf("unexpected error validating token: %v", err)
	}
	if validated.UserID != 42 {
		test.Fatalf("expected validated userID 42, got %d", validated.UserID)
	}

	if err := MustAuth(manager, token); err != nil {
		test.Fatalf("expected MustAuth to succeed: %v", err)
	}

	manager.Destroy(token)

	_, err = manager.Validate(token)
	if err == nil {
		test.Fatalf("expected error after destroying session")
	}
	if err := MustAuth(manager, token); err == nil {
		test.Fatalf("expected MustAuth to fail after destroying session")
	}
}

func TestSessionExpiration(test *testing.T) {
	manager := NewManager(-time.Second)

	token, _, err := manager.Create(99)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	_, err = manager.Validate(token)
	if err == nil || err.Error() != "sessão expirada" {
		test.Fatalf("expected sessão expirada error, got %v", err)
	}

	_, err = manager.Validate(token)
	if err == nil || err.Error() != "token inválido" {
		test.Fatalf("expected destroyed session to return token inválido, got %v", err)
	}
}

