package postgresHandlers

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	postgresDtos "docker-manager-go/src/postgres/dtos"
	postgresFunctions "docker-manager-go/src/postgres/functions"
)

const (
	sessionNotFoundMessage = "sessão de consulta não encontrada"
	defaultMaxRows         = 1000
	maxRowsLimit           = 50000
	maxNoticesPerExecution = 500
)

type querySession struct {
	id               string
	userID           uint
	connectionID     uint
	database         string
	connectionString string
	executionMutex   sync.Mutex
	stateMutex       sync.Mutex
	conn             *pgconn.PgConn
	notices          []postgresDtos.QueryMessageDto
	cancelRun        context.CancelFunc
	closed           bool
}

func (session *querySession) connect(ctx context.Context) error {
	config, err := pgconn.ParseConfig(session.connectionString)
	if err != nil {
		return fmt.Errorf("configuração de conexão inválida: %w", err)
	}
	config.OnNotice = func(_ *pgconn.PgConn, notice *pgconn.Notice) {
		session.addNotice(toQueryMessage((*pgconn.PgError)(notice)))
	}

	connectContext, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	conn, err := pgconn.ConnectConfig(connectContext, config)
	if err != nil {
		return err
	}

	session.stateMutex.Lock()
	session.conn = conn
	session.stateMutex.Unlock()
	return nil
}

func (session *querySession) currentConn() *pgconn.PgConn {
	session.stateMutex.Lock()
	defer session.stateMutex.Unlock()
	return session.conn
}

func (session *querySession) addNotice(notice postgresDtos.QueryMessageDto) {
	session.stateMutex.Lock()
	defer session.stateMutex.Unlock()
	if len(session.notices) < maxNoticesPerExecution {
		session.notices = append(session.notices, notice)
	}
}

func (session *querySession) takeNotices() []postgresDtos.QueryMessageDto {
	session.stateMutex.Lock()
	defer session.stateMutex.Unlock()
	notices := session.notices
	session.notices = nil
	if notices == nil {
		return []postgresDtos.QueryMessageDto{}
	}
	return notices
}

// beginRun registra o cancelamento da execução atual; falha se a sessão já foi fechada.
func (session *querySession) beginRun(cancel context.CancelFunc) bool {
	session.stateMutex.Lock()
	defer session.stateMutex.Unlock()
	if session.closed {
		return false
	}
	session.cancelRun = cancel
	return true
}

func (session *querySession) endRun() {
	session.stateMutex.Lock()
	session.cancelRun = nil
	session.stateMutex.Unlock()
}

func (session *querySession) close() {
	session.stateMutex.Lock()
	session.closed = true
	cancelRun := session.cancelRun
	session.stateMutex.Unlock()
	if cancelRun != nil {
		cancelRun()
	}

	// Aguarda a execução em andamento terminar (o cancelamento do contexto derruba a leitura).
	session.executionMutex.Lock()
	defer session.executionMutex.Unlock()

	if conn := session.currentConn(); conn != nil {
		closeContext, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = conn.Close(closeContext)
	}
}

func toQueryMessage(err error) postgresDtos.QueryMessageDto {
	var pgError *pgconn.PgError
	if errors.As(err, &pgError) {
		return postgresDtos.QueryMessageDto{
			Severity: pgError.Severity,
			Code:     pgError.Code,
			Message:  pgError.Message,
			Detail:   pgError.Detail,
			Hint:     pgError.Hint,
			Where:    pgError.Where,
			Position: pgError.Position,
		}
	}
	return postgresDtos.QueryMessageDto{Severity: "ERROR", Message: err.Error()}
}

func txStatusLabel(conn *pgconn.PgConn) string {
	if conn.IsClosed() {
		return "closed"
	}
	switch conn.TxStatus() {
	case 'I':
		return "idle"
	case 'T':
		return "transaction"
	case 'E':
		return "failed"
	}
	return "unknown"
}

func (handlerStruct *PostgresClientHandlerStruct) findSession(token string, sessionId string) (*querySession, error) {
	userID, err := handlerStruct.postgres.authenticate(token)
	if err != nil {
		return nil, err
	}

	handlerStruct.mutex.Lock()
	session, exists := handlerStruct.sessions[sessionId]
	handlerStruct.mutex.Unlock()
	if !exists || session.userID != userID {
		return nil, errors.New(sessionNotFoundMessage)
	}
	return session, nil
}

func (handlerStruct *PostgresClientHandlerStruct) OpenQuerySession(token string, connectionId uint, database string) (*postgresDtos.QuerySessionDto, error) {
	userID, err := handlerStruct.postgres.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection, err := handlerStruct.postgres.findConnection(userID, connectionId)
	if err != nil {
		return nil, err
	}
	if database == "" {
		database = connection.Database
	}

	session := &querySession{
		id:               uuid.New().String(),
		userID:           userID,
		connectionID:     connectionId,
		database:         database,
		connectionString: postgresFunctions.BuildConnectionString(connectionParams(connection, database)),
	}
	if err := session.connect(handlerStruct.baseContext()); err != nil {
		return nil, err
	}

	handlerStruct.mutex.Lock()
	handlerStruct.sessions[session.id] = session
	handlerStruct.mutex.Unlock()

	conn := session.currentConn()
	return &postgresDtos.QuerySessionDto{
		SessionId:     session.id,
		Database:      database,
		ServerVersion: conn.ParameterStatus("server_version"),
		BackendPid:    conn.PID(),
	}, nil
}

func (handlerStruct *PostgresClientHandlerStruct) CloseQuerySession(token string, sessionId string) error {
	session, err := handlerStruct.findSession(token, sessionId)
	if err != nil {
		return nil
	}

	handlerStruct.mutex.Lock()
	delete(handlerStruct.sessions, sessionId)
	handlerStruct.mutex.Unlock()

	session.close()
	return nil
}

func (handlerStruct *PostgresClientHandlerStruct) CancelQuery(token string, sessionId string) error {
	session, err := handlerStruct.findSession(token, sessionId)
	if err != nil {
		return err
	}

	conn := session.currentConn()
	if conn == nil {
		return nil
	}

	cancelContext, cancel := context.WithTimeout(handlerStruct.baseContext(), 5*time.Second)
	defer cancel()
	// CancelRequest abre uma conexão paralela: a sessão continua utilizável após o cancelamento.
	return conn.CancelRequest(cancelContext)
}

func (handlerStruct *PostgresClientHandlerStruct) ExecuteQuery(token string, sessionId string, sql string, maxRows int) (*postgresDtos.QueryExecutionDto, error) {
	session, err := handlerStruct.findSession(token, sessionId)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(sql) == "" {
		return nil, errors.New("a consulta está vazia")
	}
	if !session.executionMutex.TryLock() {
		return nil, errors.New("já existe uma consulta em execução nesta aba")
	}
	defer session.executionMutex.Unlock()

	if maxRows <= 0 {
		maxRows = defaultMaxRows
	}
	if maxRows > maxRowsLimit {
		maxRows = maxRowsLimit
	}

	execution := &postgresDtos.QueryExecutionDto{ResultSets: []postgresDtos.QueryResultSetDto{}}

	// Registrado antes da reconexão para que fechar a aba também interrompa um reconnect lento.
	runContext, cancelRun := context.WithCancel(handlerStruct.baseContext())
	defer cancelRun()
	if !session.beginRun(cancelRun) {
		return nil, errors.New(sessionNotFoundMessage)
	}
	defer session.endRun()

	conn := session.currentConn()
	if conn == nil || conn.IsClosed() {
		if err := session.connect(runContext); err != nil {
			return nil, fmt.Errorf("não foi possível reconectar ao servidor: %w", err)
		}
		conn = session.currentConn()
		execution.Reconnected = true
	}
	session.takeNotices()

	started := time.Now()
	multiResult := conn.Exec(runContext, sql)
	for multiResult.NextResult() {
		resultSet, err := handlerStruct.readResultSet(multiResult.ResultReader(), maxRows)
		if err != nil {
			message := toQueryMessage(err)
			execution.Error = &message
			break
		}
		// Consultas vazias (só comentários) não geram resultado útil.
		if len(resultSet.Columns) == 0 && resultSet.CommandTag == "" {
			continue
		}
		execution.ResultSets = append(execution.ResultSets, resultSet)
	}
	if err := multiResult.Close(); err != nil && execution.Error == nil {
		message := toQueryMessage(err)
		execution.Error = &message
	}

	execution.DurationMs = float64(time.Since(started).Microseconds()) / 1000
	execution.Notices = session.takeNotices()
	execution.TxStatus = txStatusLabel(conn)

	if execution.TxStatus == "closed" && execution.Error != nil && execution.Error.Code == "" {
		execution.Error.Detail = execution.Error.Message
		execution.Error.Message = "A conexão com o servidor foi encerrada"
		execution.Error.Hint = "Execute novamente para reconectar automaticamente."
	}

	handlerStruct.resolveUnknownTypes(session, execution.ResultSets)
	handlerStruct.resolveEditableTables(session, execution.ResultSets)
	return execution, nil
}

func (handlerStruct *PostgresClientHandlerStruct) readResultSet(reader *pgconn.ResultReader, maxRows int) (postgresDtos.QueryResultSetDto, error) {
	fields := reader.FieldDescriptions()
	resultSet := postgresDtos.QueryResultSetDto{
		Columns: make([]postgresDtos.QueryColumnDto, len(fields)),
		Rows:    [][]*string{},
	}
	for index, field := range fields {
		resultSet.Columns[index] = postgresDtos.QueryColumnDto{
			Name:           field.Name,
			TypeOid:        field.DataTypeOID,
			SourceTableOid: field.TableOID,
			SourceColumn:   field.TableAttributeNumber,
			DataType:       handlerStruct.builtinTypeName(field.DataTypeOID),
		}
	}

	// O protocolo simples devolve todos os valores em texto, já no formato do PostgreSQL.
	// Linhas além do limite são lidas (para contar) mas descartadas, preservando a semântica do script.
	for reader.NextRow() {
		resultSet.RowCount++
		if len(resultSet.Rows) >= maxRows {
			resultSet.Truncated = true
			continue
		}
		values := reader.Values()
		row := make([]*string, len(values))
		for index, value := range values {
			if value != nil {
				text := string(value)
				row[index] = &text
			}
		}
		resultSet.Rows = append(resultSet.Rows, row)
	}

	commandTag, err := reader.Close()
	if err != nil {
		return resultSet, err
	}
	resultSet.CommandTag = commandTag.String()
	resultSet.RowsAffected = commandTag.RowsAffected()
	return resultSet, nil
}

func (handlerStruct *PostgresClientHandlerStruct) builtinTypeName(oid uint32) string {
	dataType, ok := handlerStruct.typeMap.TypeForOID(oid)
	if !ok {
		return ""
	}
	if strings.HasPrefix(dataType.Name, "_") {
		return strings.TrimPrefix(dataType.Name, "_") + "[]"
	}
	return dataType.Name
}

// resolveUnknownTypes busca no catálogo o nome de tipos que o pgx não conhece (enums, domínios, extensões).
func (handlerStruct *PostgresClientHandlerStruct) resolveUnknownTypes(session *querySession, resultSets []postgresDtos.QueryResultSetDto) {
	unknown := map[uint32]bool{}
	for _, resultSet := range resultSets {
		for _, column := range resultSet.Columns {
			if column.DataType == "" {
				unknown[column.TypeOid] = true
			}
		}
	}
	if len(unknown) == 0 {
		return
	}

	names := map[uint32]string{}
	entry, err := handlerStruct.getPoolForUser(session.userID, session.connectionID, session.database)
	if err == nil {
		names = entry.lookupTypeNames(handlerStruct.baseContext(), unknown)
	}

	for setIndex := range resultSets {
		for columnIndex, column := range resultSets[setIndex].Columns {
			if column.DataType != "" {
				continue
			}
			if name, ok := names[column.TypeOid]; ok {
				resultSets[setIndex].Columns[columnIndex].DataType = name
			} else {
				resultSets[setIndex].Columns[columnIndex].DataType = fmt.Sprintf("oid %d", column.TypeOid)
			}
		}
	}
}

func (entry *poolEntry) lookupTypeNames(ctx context.Context, oids map[uint32]bool) map[uint32]string {
	names := map[uint32]string{}
	missing := []uint32{}

	entry.typeMutex.Lock()
	for oid := range oids {
		if name, ok := entry.typeNames[oid]; ok {
			names[oid] = name
		} else {
			missing = append(missing, oid)
		}
	}
	entry.typeMutex.Unlock()

	if len(missing) == 0 {
		return names
	}

	lookupContext, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	rows, err := entry.pool.Query(lookupContext, "SELECT t.oid, pg_catalog.format_type(t.oid, NULL) FROM pg_catalog.pg_type t WHERE t.oid = ANY($1)", missing)
	if err != nil {
		return names
	}
	defer rows.Close()

	entry.typeMutex.Lock()
	defer entry.typeMutex.Unlock()
	for rows.Next() {
		var oid uint32
		var name string
		if err := rows.Scan(&oid, &name); err != nil {
			break
		}
		names[oid] = name
		entry.typeNames[oid] = name
	}
	return names
}
