package vulpesHandlers

import (
	"docker-manager-go/src/appErrors"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

func errorEvent(err error) vulpesDtos.RealtimeEventDto {
	return vulpesDtos.RealtimeEventDto{
		Kind:      vulpesDtos.RealtimeError,
		Data:      err.Error(),
		Message:   appErrors.PayloadOf(err),
		Direction: vulpesDtos.DirectionSystem,
	}
}

func systemEvent(kind string, message *appErrors.AppError) vulpesDtos.RealtimeEventDto {
	return localizedEvent(message, vulpesDtos.RealtimeEventDto{Kind: kind, Direction: vulpesDtos.DirectionSystem})
}

func localizedEvent(message *appErrors.AppError, event vulpesDtos.RealtimeEventDto) vulpesDtos.RealtimeEventDto {
	event.Data = message.Error()
	event.Message = message.Payload()
	return event
}
