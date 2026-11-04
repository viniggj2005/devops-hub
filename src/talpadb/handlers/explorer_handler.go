package talpadbHandlers

import (
	"time"
	"context"

	"github.com/jackc/pgx/v5"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbEngines "docker-manager-go/src/talpadb/engines"
)

func (handlerStruct *TalpadbClientHandlerStruct) ListDatabases(callContext context.Context, token string, connectionId uint) ([]talpadbDtos.DatabaseDto, error) {
	if databases, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) ([]talpadbDtos.DatabaseDto, error) {
		return entry.engine.ListDatabases(ctx, entry.db, entry.params)
	}); handled {
		return databases, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, "")
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.PoolListDatabases(ctx, entry.pool)
}

func (handlerStruct *TalpadbClientHandlerStruct) ListSchemas(callContext context.Context, token string, connectionId uint, database string) ([]talpadbDtos.SchemaDto, error) {
	if schemas, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) ([]talpadbDtos.SchemaDto, error) {
		return entry.engine.ListSchemas(ctx, entry.db)
	}); handled {
		return schemas, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.PoolListSchemas(ctx, entry.pool)
}

func (handlerStruct *TalpadbClientHandlerStruct) ListSchemaObjects(callContext context.Context, token string, connectionId uint, database string, schema string) (*talpadbDtos.SchemaObjectsDto, error) {
	if objects, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (*talpadbDtos.SchemaObjectsDto, error) {
		return entry.engine.ListSchemaObjects(ctx, entry.db, schema)
	}); handled {
		return objects, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.PoolListSchemaObjects(ctx, entry.pool, entry.versionNumber, schema)
}

func (handlerStruct *TalpadbClientHandlerStruct) ListColumns(callContext context.Context, token string, connectionId uint, database string, schema string, relation string) ([]talpadbDtos.ColumnDto, error) {
	if columns, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) ([]talpadbDtos.ColumnDto, error) {
		return entry.engine.ListColumns(ctx, entry.db, schema, relation)
	}); handled {
		return columns, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	oid, _, err := talpadbEngines.Postgres.RelationOid(ctx, entry.pool, schema, relation)
	if err != nil {
		return nil, err
	}
	return talpadbEngines.Postgres.PoolListColumns(ctx, entry.pool, entry.versionNumber, oid)
}

func (handlerStruct *TalpadbClientHandlerStruct) GetTableDetails(callContext context.Context, token string, connectionId uint, database string, schema string, relation string) (*talpadbDtos.TableDetailsDto, error) {
	if details, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (*talpadbDtos.TableDetailsDto, error) {
		return entry.engine.TableDetails(ctx, entry.db, schema, relation)
	}); handled {
		return details, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.PoolTableDetails(ctx, entry.pool, entry.versionNumber, schema, relation)
}

func (handlerStruct *TalpadbClientHandlerStruct) GetObjectDdl(callContext context.Context, token string, connectionId uint, database string, object talpadbDtos.ObjectReferenceDto) (string, error) {
	if ddl, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (string, error) {
		return entry.engine.ObjectDdl(ctx, entry.db, object)
	}); handled {
		return ddl, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return "", err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.PoolObjectDdl(ctx, entry.pool, entry.versionNumber, object)
}

func (handlerStruct *TalpadbClientHandlerStruct) CountRows(callContext context.Context, token string, connectionId uint, database string, schema string, relation string) (int64, error) {
	if count, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (int64, error) {
		var count int64
		qualified := entry.engine.QuoteIdentifier(schema) + "." + entry.engine.QuoteIdentifier(relation)
		err := entry.db.QueryRowContext(ctx, "SELECT count(*) FROM "+qualified).Scan(&count)
		return count, err
	}); handled {
		return count, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return 0, err
	}
	ctx, cancel := context.WithTimeout(handlerStruct.baseContext(), 5*time.Minute)
	defer cancel()

	var count int64
	err = entry.pool.QueryRow(ctx, "SELECT count(*) FROM "+pgx.Identifier{schema, relation}.Sanitize()).Scan(&count)
	return count, err
}

func (handlerStruct *TalpadbClientHandlerStruct) GetCompletionSchema(callContext context.Context, token string, connectionId uint, database string) ([]talpadbDtos.CompletionTableDto, error) {
	if tables, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) ([]talpadbDtos.CompletionTableDto, error) {
		return entry.engine.CompletionSchema(ctx, entry.db)
	}); handled {
		return tables, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.PoolCompletionSchema(ctx, entry.pool)
}
