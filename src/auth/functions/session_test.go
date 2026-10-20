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


func TestWindowSessionHandoff(test *testing.T) {
	manager := NewManager(time.Minute)

	originToken, _, err := manager.Create(7)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}
	if err := manager.OfferToWindow("module-window", originToken); err != nil {
		test.Fatalf("unexpected error offering session: %v", err)
	}

	windowToken, windowSession, err := manager.ClaimForWindow("module-window")
	if err != nil {
		test.Fatalf("unexpected error claiming session: %v", err)
	}
	if windowToken == originToken {
		test.Fatalf("expected the window to receive its own token")
	}
	if windowSession.UserID != 7 {
		test.Fatalf("expected claimed session for user 7, got %d", windowSession.UserID)
	}
	if _, err := manager.Validate(windowToken); err != nil {
		test.Fatalf("expected claimed token to be valid: %v", err)
	}

	if _, _, err := manager.ClaimForWindow("module-window"); err == nil {
		test.Fatalf("expected a second claim for the same window to fail")
	}
}

func TestWindowSessionHandoffRejectsInvalidOrigins(test *testing.T) {
	manager := NewManager(time.Minute)

	if err := manager.OfferToWindow("module-window", "unknown-token"); err == nil {
		test.Fatalf("expected offering an unknown token to fail")
	}

	originToken, _, err := manager.Create(3)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}
	if err := manager.OfferToWindow("revoked-window", originToken); err != nil {
		test.Fatalf("unexpected error offering session: %v", err)
	}
	manager.RevokeWindowOffer("revoked-window")
	if _, _, err := manager.ClaimForWindow("revoked-window"); err == nil {
		test.Fatalf("expected a revoked offer to be unclaimable")
	}

	if err := manager.OfferToWindow("logged-out-window", originToken); err != nil {
		test.Fatalf("unexpected error offering session: %v", err)
	}
	manager.Destroy(originToken)
	if _, _, err := manager.ClaimForWindow("logged-out-window"); err == nil {
		test.Fatalf("expected the claim to fail once the origin session is destroyed")
	}
}
