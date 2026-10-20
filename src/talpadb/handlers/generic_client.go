package talpadbHandlers

import (
	"context"
	"database/sql"
	"docker-manager-go/src/desktop"
	"fmt"
	"time"

	"docker-manager-go/src/models"
	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbEngines "docker-manager-go/src/talpadb/engines"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

type genericEntry struct {
	db     *sql.DB
	engine talpadbEngines.Engine
	params talpadbFunctions.ConnectionParams
}

func connectionEngine(connection *models.TalpadbConnectionModel) string {
	if connection.Engine == "" {
		return talpadbFunctions.EnginePostgres
	}
	return connection.Engine
}

func postgresOnlyError(engine string) error {
	label := engine
	if resolved, err := talpadbEngines.ForName(engine); err == nil {
		label = resolved.Label()
	}
	return fmt.Errorf("recurso disponível apenas para PostgreSQL (esta conexão é %s)", label)
}

func openGenericDatabase(ctx context.Context, engine talpadbEngines.Engine, params talpadbFunctions.ConnectionParams) (*sql.DB, error) {
	dataSourceName, err := engine.DataSourceName(params)
	if err != nil {
		return nil, err
	}
	database, err := sql.Open(engine.DriverName(), dataSourceName)
	if err != nil {
		return nil, fmt.Errorf("configuração de conexão inválida: %w", err)
	}
	connectContext, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	if err := database.PingContext(connectContext); err != nil {
		_ = database.Close()
		return nil, err
	}
	return database, nil
}

func (handlerStruct *TalpadbClientHandlerStruct) genericTarget(callContext context.Context, token string, connectionID uint) (*genericEntry, error) {
	userID, err := handlerStruct.talpadb.authenticate(token)
	if err != nil {
		return nil, err
	}
	return handlerStruct.genericTargetForUser(desktop.CallingWindowName(callContext), userID, connectionID)
}

func (handlerStruct *TalpadbClientHandlerStruct) genericTargetForUser(windowName string, userID uint, connectionID uint) (*genericEntry, error) {
	connection, err := handlerStruct.talpadb.findConnection(userID, connectionID)
	if err != nil {
		return nil, err
	}
	engineName := connectionEngine(connection)
	if engineName == talpadbFunctions.EnginePostgres {
		return nil, nil
	}
	engine, err := talpadbEngines.ForName(engineName)
	if err != nil {
		return nil, err
	}

	key := poolIdentity{userID: userID, windowName: windowName, connectionID: connectionID}
	handlerStruct.mutex.Lock()
	entry, exists := handlerStruct.genericPools[key]
	handlerStruct.mutex.Unlock()
	if exists {
		return entry, nil
	}

	params := connectionParams(connection, "")
	database, err := openGenericDatabase(handlerStruct.baseContext(), engine, params)
	if err != nil {
		return nil, err
	}
	database.SetMaxOpenConns(4)
	database.SetConnMaxIdleTime(5 * time.Minute)
	entry = &genericEntry{db: database, engine: engine, params: params}

	handlerStruct.mutex.Lock()
	existing, exists := handlerStruct.genericPools[key]
	if !exists {
		handlerStruct.genericPools[key] = entry
	}
	handlerStruct.mutex.Unlock()

	if exists {
		_ = database.Close()
		return existing, nil
	}
	return entry, nil
}

func runGeneric[Result any](callContext context.Context, handlerStruct *TalpadbClientHandlerStruct, token string, connectionID uint, run func(context.Context, *genericEntry) (Result, error)) (Result, bool, error) {
	var empty Result
	entry, err := handlerStruct.genericTarget(callContext, token, connectionID)
	if err != nil {
		return empty, true, err
	}
	if entry == nil {
		return empty, false, nil
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()
	result, err := run(ctx, entry)
	return result, true, err
}

func (handlerStruct *TalpadbClientHandlerStruct) testGenericConnection(connection *models.TalpadbConnectionModel) (*talpadbDtos.ConnectionTestResultDto, error) {
	engine, err := talpadbEngines.ForName(connectionEngine(connection))
	if err != nil {
		return nil, err
	}
	testContext, cancel := context.WithTimeout(handlerStruct.baseContext(), 20*time.Second)
	defer cancel()

	started := time.Now()
	database, err := openGenericDatabase(testContext, engine, connectionParams(connection, ""))
	if err != nil {
		return nil, err
	}
	defer database.Close()

	version, err := engine.ServerVersion(testContext, database)
	if err != nil {
		return nil, err
	}
	return &talpadbDtos.ConnectionTestResultDto{
		ServerVersion: version,
		LatencyMs:     float64(time.Since(started).Microseconds()) / 1000,
	}, nil
}
