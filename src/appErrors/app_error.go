package appErrors

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

type AppError struct {
	Code    string
	Message string
	Params  map[string]string
	Cause   error
}

type Payload struct {
	Code   string            `json:"code"`
	Detail string            `json:"detail,omitempty"`
	Cause  *Payload          `json:"cause,omitempty"`
	Errors []*Payload        `json:"errors,omitempty"`
	Params map[string]string `json:"params,omitempty"`
}

func New(code, message string) *AppError {
	return &AppError{Code: code, Message: message}
}

func Wrap(code, message string, cause error) *AppError {
	return &AppError{Code: code, Message: message, Cause: cause}
}

func (appError *AppError) With(name string, value any) *AppError {
	params := make(map[string]string, len(appError.Params)+1)
	for paramName, paramValue := range appError.Params {
		params[paramName] = paramValue
	}
	params[name] = fmt.Sprint(value)
	return &AppError{Code: appError.Code, Message: appError.Message, Params: params, Cause: appError.Cause}
}

func (appError *AppError) Error() string {
	message := appError.Message
	for paramName, paramValue := range appError.Params {
		message = strings.ReplaceAll(message, "{"+paramName+"}", paramValue)
	}
	if appError.Cause == nil {
		return message
	}
	if message == "" {
		return appError.Cause.Error()
	}
	return message + ": " + appError.Cause.Error()
}

func (appError *AppError) Unwrap() error {
	return appError.Cause
}

func (appError *AppError) Payload() *Payload {
	return PayloadOf(appError)
}

func PayloadOf(err error) *Payload {
	if err == nil {
		return nil
	}
	if joined, isJoined := err.(interface{ Unwrap() []error }); isJoined {
		payload := &Payload{}
		for _, joinedErr := range joined.Unwrap() {
			joinedPayload := PayloadOf(joinedErr)
			if joinedPayload == nil {
				joinedPayload = &Payload{Detail: joinedErr.Error()}
			}
			payload.Errors = append(payload.Errors, joinedPayload)
		}
		return payload
	}
	var appError *AppError
	if !errors.As(err, &appError) {
		return nil
	}
	payload := &Payload{Code: appError.Code, Params: appError.Params}
	if appError.Cause != nil {
		payload.Cause = PayloadOf(appError.Cause)
		if payload.Cause == nil {
			payload.Detail = appError.Cause.Error()
		}
	}
	return payload
}

func Marshal(err error) []byte {
	payload := PayloadOf(err)
	if payload == nil {
		return nil
	}
	encoded, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return nil
	}
	return encoded
}
