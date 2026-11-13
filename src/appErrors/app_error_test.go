package appErrors

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
)

func TestAppErrorMessage(test *testing.T) {
	baseError := New("window.moduleNotDetachable", "o módulo {module} não pode ser aberto em outra janela")
	withParam := baseError.With("module", "home")

	if withParam.Error() != "o módulo home não pode ser aberto em outra janela" {
		test.Fatalf("unexpected message: %s", withParam.Error())
	}
	if baseError.Params != nil {
		test.Fatalf("With must not mutate the original error: %+v", baseError.Params)
	}

	cause := errors.New("connection refused")
	wrapped := Wrap("docker.connectFailed", "erro ao conectar credencial docker", cause)
	if wrapped.Error() != "erro ao conectar credencial docker: connection refused" {
		test.Fatalf("unexpected wrapped message: %s", wrapped.Error())
	}
	if !errors.Is(wrapped, cause) {
		test.Fatalf("expected wrapped error to unwrap to its cause")
	}
}

func TestMarshal(test *testing.T) {
	if Marshal(errors.New("plain")) != nil {
		test.Fatalf("expected nil payload for errors without code")
	}

	cause := errors.New("timeout")
	appError := Wrap("cloudSync.downloadFailed", "não foi possível baixar o backup da nuvem", cause).With("attempt", 2)
	encoded := Marshal(fmt.Errorf("outer: %w", appError))

	var payload Payload
	if err := json.Unmarshal(encoded, &payload); err != nil {
		test.Fatalf("unexpected invalid JSON %q: %v", encoded, err)
	}
	if payload.Code != "cloudSync.downloadFailed" || payload.Detail != "timeout" || payload.Params["attempt"] != "2" {
		test.Fatalf("unexpected payload: %+v", payload)
	}
}

func TestPayloadOfNestedAndJoinedErrors(test *testing.T) {
	inner := New("vulpes.invalidUrl", "URL inválida")
	outer := Wrap("vulpes.namedFailure", "{name}", inner).With("name", "Minha coleção")

	nested := PayloadOf(outer)
	if nested.Cause == nil || nested.Cause.Code != "vulpes.invalidUrl" || nested.Detail != "" {
		test.Fatalf("expected nested coded cause, got %+v", nested)
	}
	if outer.Error() != "Minha coleção: URL inválida" {
		test.Fatalf("unexpected nested message: %s", outer.Error())
	}

	joined := PayloadOf(errors.Join(inner, errors.New("plain failure")))
	if len(joined.Errors) != 2 || joined.Errors[0].Code != "vulpes.invalidUrl" || joined.Errors[1].Detail != "plain failure" {
		test.Fatalf("unexpected joined payload: %+v", joined)
	}
}
