package talpadbHandlers

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"docker-manager-go/src/models"
	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

type poolEntry struct {
	pool          *pgxpool.Pool
	versionNumber int
	typeMutex     sync.Mutex
	typeNames     map[uint32]string
}

// TalpadbClientHandlerStruct mantém as conexões vivas com os servidores:
// pools (usados pelo explorador de objetos e dashboard) e sessões dedicadas
// por aba de query, para que transações e SETs persistam entre execuções.
type TalpadbClientHandlerStruct struct {
	context      context.Context
	talpadb      *TalpadbHandlerStruct
	typeMap      *pgtype.Map
	mutex        sync.Mutex
	pools        map[string]*poolEntry
	sessions     map[string]*querySession
	genericPools map[string]*genericEntry
}

func NewTalpadbClientHandler(talpadbHandler *TalpadbHandlerStruct) *TalpadbClientHandlerStruct {
	handler := &TalpadbClientHandlerStruct{
		talpadb:      talpadbHandler,
		typeMap:      pgtype.NewMap(),
		pools:        make(map[string]*poolEntry),
		sessions:     make(map[string]*querySession),
		genericPools: make(map[string]*genericEntry),
	}
	talpadbHandler.client = handler
	return handler
}

func (handlerStruct *TalpadbClientHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
}

func (handlerStruct *TalpadbClientHandlerStruct) baseContext() context.Context {
	if handlerStruct.context != nil {
		return handlerStruct.context
	}
	return context.Background()
}

func (handlerStruct *TalpadbClientHandlerStruct) queryContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(handlerStruct.baseContext(), time.Minute)
}

func poolKey(userID uint, connectionID uint, database string) string {
	return fmt.Sprintf("%d/%d/%s", userID, connectionID, database)
}

func connectionParams(connection *models.TalpadbConnectionModel, database string) talpadbFunctions.ConnectionParams {
	if database == "" {
		database = connection.Database
	}
	return talpadbFunctions.ConnectionParams{
		Host:     connection.Host.Plaintext,
		Port:     connection.Port,
		Engine:   connectionEngine(connection),
		SslMode:  connection.SslMode,
		Database: database,
		Username: connection.Username,
		Password: connection.Password.Plaintext,
	}
}

func (handlerStruct *TalpadbClientHandlerStruct) getPool(token string, connectionID uint, database string) (*poolEntry, error) {
	userID, err := handlerStruct.talpadb.authenticate(token)
	if err != nil {
		return nil, err
	}
	return handlerStruct.getPoolForUser(userID, connectionID, database)
}

func (handlerStruct *TalpadbClientHandlerStruct) getPoolForUser(userID uint, connectionID uint, database string) (*poolEntry, error) {
	connection, err := handlerStruct.talpadb.findConnection(userID, connectionID)
	if err != nil {
		return nil, err
	}
	if engine := connectionEngine(connection); engine != talpadbFunctions.EnginePostgres {
		return nil, postgresOnlyError(engine)
	}
	if database == "" {
		database = connection.Database
	}
	key := poolKey(userID, connectionID, database)

	handlerStruct.mutex.Lock()
	entry, exists := handlerStruct.pools[key]
	handlerStruct.mutex.Unlock()
	if exists {
		return entry, nil
	}

	entry, err = handlerStruct.openPool(connectionParams(connection, database))
	if err != nil {
		return nil, err
	}

	handlerStruct.mutex.Lock()
	existing, exists := handlerStruct.pools[key]
	if !exists {
		handlerStruct.pools[key] = entry
	}
	handlerStruct.mutex.Unlock()

	if exists {
		entry.pool.Close()
		return existing, nil
	}
	return entry, nil
}

func (handlerStruct *TalpadbClientHandlerStruct) openPool(params talpadbFunctions.ConnectionParams) (*poolEntry, error) {
	config, err := pgxpool.ParseConfig(talpadbFunctions.BuildConnectionString(params))
	if err != nil {
		return nil, fmt.Errorf("configuração de conexão inválida: %w", err)
	}
	config.MaxConns = 4
	config.MinConns = 0
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = time.Minute

	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeCacheDescribe

	connectContext, cancel := context.WithTimeout(handlerStruct.baseContext(), 20*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectContext, config)
	if err != nil {
		return nil, err
	}

	var versionNumber int
	if err := pool.QueryRow(connectContext, "SELECT pg_catalog.current_setting('server_version_num')::int").Scan(&versionNumber); err != nil {
		pool.Close()
		return nil, err
	}

	return &poolEntry{pool: pool, versionNumber: versionNumber, typeNames: make(map[uint32]string)}, nil
}

func (handlerStruct *TalpadbClientHandlerStruct) closeResources(match func(key string, session *querySession) bool) {
	closers := handlerStruct.detachResources(match)

	go func() {
		for _, closePool := range closers {
			closePool()
		}
	}()
}

func (handlerStruct *TalpadbClientHandlerStruct) closeResourcesAndWait(match func(key string, session *querySession) bool) {
	for _, closePool := range handlerStruct.detachResources(match) {
		closePool()
	}
}

func (handlerStruct *TalpadbClientHandlerStruct) detachResources(match func(key string, session *querySession) bool) []func() {
	var closers []func()
	var sessions []*querySession

	handlerStruct.mutex.Lock()
	for key, entry := range handlerStruct.pools {
		if match(key, nil) {
			closers = append(closers, entry.pool.Close)
			delete(handlerStruct.pools, key)
		}
	}
	for key, entry := range handlerStruct.genericPools {
		if match(key, nil) {
			database := entry.db
			closers = append(closers, func() { _ = database.Close() })
			delete(handlerStruct.genericPools, key)
		}
	}
	for id, session := range handlerStruct.sessions {
		if match("", session) {
			sessions = append(sessions, session)
			delete(handlerStruct.sessions, id)
		}
	}
	handlerStruct.mutex.Unlock()

	for _, session := range sessions {
		session.close()
	}
	return closers
}

func (handlerStruct *TalpadbClientHandlerStruct) closeConnectionResources(userID uint, connectionID uint) {
	prefix := fmt.Sprintf("%d/%d/", userID, connectionID)
	handlerStruct.closeResources(func(key string, session *querySession) bool {
		if session != nil {
			return session.userID == userID && session.connectionID == connectionID
		}
		return strings.HasPrefix(key, prefix)
	})
}

func (handlerStruct *TalpadbClientHandlerStruct) DisconnectServer(token string, connectionId uint) error {
	userID, err := handlerStruct.talpadb.authenticate(token)
	if err != nil {
		return err
	}
	handlerStruct.closeConnectionResources(userID, connectionId)
	return nil
}

func (handlerStruct *TalpadbClientHandlerStruct) DisconnectAll(token string) error {
	userID, err := handlerStruct.talpadb.authenticate(token)
	if err != nil {
		return err
	}
	prefix := fmt.Sprintf("%d/", userID)
	handlerStruct.closeResources(func(key string, session *querySession) bool {
		if session != nil {
			return session.userID == userID
		}
		return strings.HasPrefix(key, prefix)
	})
	return nil
}

func (handlerStruct *TalpadbClientHandlerStruct) TestConnection(token string, connectionId uint, body talpadbDtos.CreateConnectionInputDto) (*talpadbDtos.ConnectionTestResultDto, error) {
	userID, err := handlerStruct.talpadb.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection := &models.TalpadbConnectionModel{}
	if connectionId != 0 {

		connection, err = handlerStruct.talpadb.findConnection(userID, connectionId)
		if err != nil {
			return nil, err
		}
	}
	if err := applyConnectionInput(connection, body); err != nil {
		return nil, err
	}
	if connection.Engine != talpadbFunctions.EnginePostgres {
		return handlerStruct.testGenericConnection(connection)
	}

	config, err := pgconn.ParseConfig(talpadbFunctions.BuildConnectionString(connectionParams(connection, "")))
	if err != nil {
		return nil, fmt.Errorf("configuração de conexão inválida: %w", err)
	}

	testContext, cancel := context.WithTimeout(handlerStruct.baseContext(), 20*time.Second)
	defer cancel()

	started := time.Now()
	conn, err := pgconn.ConnectConfig(testContext, config)
	if err != nil {
		return nil, err
	}
	defer conn.Close(testContext)

	if _, err := conn.Exec(testContext, "SELECT 1").ReadAll(); err != nil {
		return nil, err
	}

	return &talpadbDtos.ConnectionTestResultDto{
		ServerVersion: conn.ParameterStatus("server_version"),
		LatencyMs:     float64(time.Since(started).Microseconds()) / 1000,
	}, nil
}
