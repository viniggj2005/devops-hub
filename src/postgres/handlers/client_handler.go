package postgresHandlers

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
	postgresDtos "docker-manager-go/src/postgres/dtos"
	postgresFunctions "docker-manager-go/src/postgres/functions"
)

type poolEntry struct {
	pool          *pgxpool.Pool
	versionNumber int
	typeMutex     sync.Mutex
	typeNames     map[uint32]string
}

// PostgresClientHandlerStruct mantém as conexões vivas com os servidores:
// pools (usados pelo explorador de objetos e dashboard) e sessões dedicadas
// por aba de query, para que transações e SETs persistam entre execuções.
type PostgresClientHandlerStruct struct {
	context  context.Context
	postgres *PostgresHandlerStruct
	typeMap  *pgtype.Map
	mutex    sync.Mutex
	pools    map[string]*poolEntry
	sessions map[string]*querySession
}

func NewPostgresClientHandler(postgresHandler *PostgresHandlerStruct) *PostgresClientHandlerStruct {
	handler := &PostgresClientHandlerStruct{
		postgres: postgresHandler,
		typeMap:  pgtype.NewMap(),
		pools:    make(map[string]*poolEntry),
		sessions: make(map[string]*querySession),
	}
	postgresHandler.client = handler
	return handler
}

func (handlerStruct *PostgresClientHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
}

func (handlerStruct *PostgresClientHandlerStruct) baseContext() context.Context {
	if handlerStruct.context != nil {
		return handlerStruct.context
	}
	return context.Background()
}

func (handlerStruct *PostgresClientHandlerStruct) queryContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(handlerStruct.baseContext(), time.Minute)
}

func poolKey(userID uint, connectionID uint, database string) string {
	return fmt.Sprintf("%d/%d/%s", userID, connectionID, database)
}

func connectionParams(connection *models.PostgresConnectionModel, database string) postgresFunctions.ConnectionParams {
	if database == "" {
		database = connection.Database
	}
	return postgresFunctions.ConnectionParams{
		Host:     connection.Host.Plaintext,
		Port:     connection.Port,
		Database: database,
		Username: connection.Username,
		Password: connection.Password.Plaintext,
		SslMode:  connection.SslMode,
	}
}

func (handlerStruct *PostgresClientHandlerStruct) getPool(token string, connectionID uint, database string) (*poolEntry, error) {
	userID, err := handlerStruct.postgres.authenticate(token)
	if err != nil {
		return nil, err
	}
	return handlerStruct.getPoolForUser(userID, connectionID, database)
}

func (handlerStruct *PostgresClientHandlerStruct) getPoolForUser(userID uint, connectionID uint, database string) (*poolEntry, error) {
	connection, err := handlerStruct.postgres.findConnection(userID, connectionID)
	if err != nil {
		return nil, err
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

func (handlerStruct *PostgresClientHandlerStruct) openPool(params postgresFunctions.ConnectionParams) (*poolEntry, error) {
	config, err := pgxpool.ParseConfig(postgresFunctions.BuildConnectionString(params))
	if err != nil {
		return nil, fmt.Errorf("configuração de conexão inválida: %w", err)
	}
	config.MaxConns = 4
	config.MinConns = 0
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = time.Minute
	// Sem prepared statements nomeados: mantém compatibilidade com PgBouncer em modo transaction.
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

func (handlerStruct *PostgresClientHandlerStruct) closeResources(match func(key string, session *querySession) bool) {
	var pools []*pgxpool.Pool
	var sessions []*querySession

	handlerStruct.mutex.Lock()
	for key, entry := range handlerStruct.pools {
		if match(key, nil) {
			pools = append(pools, entry.pool)
			delete(handlerStruct.pools, key)
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
	// Close aguarda as conexões em uso serem devolvidas; não precisa travar a chamada do frontend.
	go func() {
		for _, pool := range pools {
			pool.Close()
		}
	}()
}

func (handlerStruct *PostgresClientHandlerStruct) closeConnectionResources(userID uint, connectionID uint) {
	prefix := fmt.Sprintf("%d/%d/", userID, connectionID)
	handlerStruct.closeResources(func(key string, session *querySession) bool {
		if session != nil {
			return session.userID == userID && session.connectionID == connectionID
		}
		return strings.HasPrefix(key, prefix)
	})
}

func (handlerStruct *PostgresClientHandlerStruct) DisconnectServer(token string, connectionId uint) error {
	userID, err := handlerStruct.postgres.authenticate(token)
	if err != nil {
		return err
	}
	handlerStruct.closeConnectionResources(userID, connectionId)
	return nil
}

func (handlerStruct *PostgresClientHandlerStruct) DisconnectAll(token string) error {
	userID, err := handlerStruct.postgres.authenticate(token)
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

func (handlerStruct *PostgresClientHandlerStruct) TestConnection(token string, connectionId uint, body postgresDtos.CreatePostgresConnectionInputDto) (*postgresDtos.ConnectionTestResultDto, error) {
	userID, err := handlerStruct.postgres.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection := &models.PostgresConnectionModel{}
	if connectionId != 0 {
		// Na edição a senha vem vazia quando não foi alterada: reaproveita a salva.
		connection, err = handlerStruct.postgres.findConnection(userID, connectionId)
		if err != nil {
			return nil, err
		}
	}
	if err := applyConnectionInput(connection, body); err != nil {
		return nil, err
	}

	config, err := pgconn.ParseConfig(postgresFunctions.BuildConnectionString(connectionParams(connection, "")))
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

	return &postgresDtos.ConnectionTestResultDto{
		ServerVersion: conn.ParameterStatus("server_version"),
		LatencyMs:     float64(time.Since(started).Microseconds()) / 1000,
	}, nil
}
