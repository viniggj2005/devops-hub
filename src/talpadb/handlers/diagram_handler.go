package talpadbHandlers

import (
	"context"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbEngines "docker-manager-go/src/talpadb/engines"
)

func (handlerStruct *TalpadbClientHandlerStruct) GetDatabaseDiagram(callContext context.Context, token string, connectionId uint, database string, schema string) (*talpadbDtos.DatabaseDiagramDto, error) {
	if diagram, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (*talpadbDtos.DatabaseDiagramDto, error) {
		return entry.engine.Diagram(ctx, entry.db, schema)
	}); handled {
		return diagram, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.PoolDiagram(ctx, entry.pool, entry.versionNumber, schema)
}
