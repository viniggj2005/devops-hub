package talpadbHandlers

import (
	"fmt"
	"context"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbEngines "docker-manager-go/src/talpadb/engines"
)

func (handlerStruct *TalpadbClientHandlerStruct) GetServerDashboard(callContext context.Context, token string, connectionId uint, includeSizes bool) (*talpadbDtos.ServerDashboardDto, error) {
	entry, err := handlerStruct.getPool(callContext, token, connectionId, "")
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.ServerDashboard(ctx, entry.pool, entry.versionNumber, includeSizes)
}

func (handlerStruct *TalpadbClientHandlerStruct) CancelBackend(callContext context.Context, token string, connectionId uint, pid int32) (bool, error) {
	return handlerStruct.signalBackend(callContext, token, connectionId, "pg_cancel_backend", pid)
}

func (handlerStruct *TalpadbClientHandlerStruct) TerminateBackend(callContext context.Context, token string, connectionId uint, pid int32) (bool, error) {
	return handlerStruct.signalBackend(callContext, token, connectionId, "pg_terminate_backend", pid)
}

func (handlerStruct *TalpadbClientHandlerStruct) signalBackend(callContext context.Context, token string, connectionId uint, function string, pid int32) (bool, error) {
	entry, err := handlerStruct.getPool(callContext, token, connectionId, "")
	if err != nil {
		return false, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	var signaled bool
	err = entry.pool.QueryRow(ctx, fmt.Sprintf("SELECT pg_catalog.%s($1)", function), pid).Scan(&signaled)
	return signaled, err
}
