package talpadbHandlers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbEngines "docker-manager-go/src/talpadb/engines"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

var errorCodePattern = regexp.MustCompile(`\b(ORA-\d{5}|PLS-\d{5})\b`)

type genericExecutor interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type genericSession struct {
	db             *sql.DB
	conn           *sql.Conn
	engine         talpadbEngines.Engine
	version        string
	nextTableID    uint32
	defaultSchema  string
	inTransaction  bool
	editableTables map[uint32]*tableMeta
}

func openGenericSession(ctx context.Context, engine talpadbEngines.Engine, params talpadbFunctions.ConnectionParams) (*genericSession, error) {
	database, err := openGenericDatabase(ctx, engine, params)
	if err != nil {
		return nil, err
	}
	database.SetMaxOpenConns(1)
	session := &genericSession{db: database, engine: engine, editableTables: map[uint32]*tableMeta{}}
	if err := session.connect(ctx); err != nil {
		_ = database.Close()
		return nil, err
	}
	session.version, _ = engine.ServerVersion(ctx, session.conn)
	return session, nil
}

func (session *genericSession) connect(ctx context.Context) error {
	conn, err := session.db.Conn(ctx)
	if err != nil {
		return err
	}
	if err := session.engine.PrepareSession(ctx, conn); err != nil {
		_ = conn.Close()
		return err
	}
	defaultSchema, err := session.engine.DefaultSchema(ctx, conn)
	if err != nil {
		_ = conn.Close()
		return err
	}
	session.conn = conn
	session.inTransaction = false
	session.defaultSchema = defaultSchema
	return nil
}

func (session *genericSession) reconnect(ctx context.Context) error {
	if session.conn != nil {
		_ = session.conn.Close()
	}
	return session.connect(ctx)
}

func (session *genericSession) close() {
	if session.conn != nil {
		_ = session.conn.Close()
	}
	_ = session.db.Close()
}

func (session *genericSession) txStatus() string {
	if session.inTransaction {
		return "transaction"
	}
	return "idle"
}

func genericQueryMessage(ctx context.Context, err error) talpadbDtos.QueryMessageDto {
	if errors.Is(ctx.Err(), context.Canceled) {
		return talpadbDtos.QueryMessageDto{Severity: "ERROR", Message: "Consulta cancelada pelo usuário"}
	}
	message := talpadbDtos.QueryMessageDto{Severity: "ERROR", Message: strings.TrimSpace(err.Error())}
	if code := errorCodePattern.FindString(message.Message); code != "" {
		message.Code = code
	}
	return message
}

func (session *genericSession) execute(ctx context.Context, statement talpadbEngines.Statement, maxRows int) (talpadbDtos.QueryResultSetDto, error) {
	resultSet := talpadbDtos.QueryResultSetDto{Columns: []talpadbDtos.QueryColumnDto{}, Rows: [][]*string{}}
	if !statement.ReturnsRows {
		result, err := session.conn.ExecContext(ctx, statement.Text)
		if err != nil {
			return resultSet, err
		}
		if affected, err := result.RowsAffected(); err == nil {
			resultSet.RowsAffected = affected
		}
		resultSet.CommandTag = talpadbEngines.CommandTag(statement, resultSet.RowsAffected)
		return resultSet, nil
	}

	rows, err := session.conn.QueryContext(ctx, statement.Text)
	if err != nil {
		return resultSet, err
	}
	defer rows.Close()

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return resultSet, err
	}
	for _, columnType := range columnTypes {
		resultSet.Columns = append(resultSet.Columns, talpadbDtos.QueryColumnDto{
			Name:     columnType.Name(),
			DataType: talpadbEngines.NormalizeTypeName(columnType.DatabaseTypeName()),
		})
	}

	values := make([]any, len(columnTypes))
	targets := make([]any, len(columnTypes))
	for index := range values {
		targets[index] = &values[index]
	}
	dateOnly := session.engine.DateOnlyAtMidnight()
	for rows.Next() {
		resultSet.RowCount++
		if len(resultSet.Rows) >= maxRows {
			resultSet.Truncated = true
			continue
		}
		if err := rows.Scan(targets...); err != nil {
			return resultSet, err
		}
		row := make([]*string, len(values))
		for index, value := range values {
			row[index] = talpadbEngines.FormatValue(value, dateOnly)
		}
		resultSet.Rows = append(resultSet.Rows, row)
	}
	if err := rows.Err(); err != nil {
		return resultSet, err
	}
	resultSet.CommandTag = fmt.Sprintf("%s %d", statement.Keyword, resultSet.RowCount)
	return resultSet, nil
}

func (session *genericSession) run(ctx context.Context, script string, maxRows int) (*talpadbDtos.QueryExecutionDto, error) {
	execution := &talpadbDtos.QueryExecutionDto{ResultSets: []talpadbDtos.QueryResultSetDto{}, Notices: []talpadbDtos.QueryMessageDto{}}
	if err := session.conn.PingContext(ctx); err != nil {
		if err := session.reconnect(ctx); err != nil {
			return nil, fmt.Errorf("não foi possível reconectar ao servidor: %w", err)
		}
		execution.Reconnected = true
	}
	session.editableTables = map[uint32]*tableMeta{}

	started := time.Now()
	for _, statement := range session.engine.SplitStatements(script) {
		resultSet, err := session.execute(ctx, statement, maxRows)
		if err != nil {
			message := genericQueryMessage(ctx, err)
			execution.Error = &message
			break
		}
		session.inTransaction = session.engine.TransactionState(statement, session.inTransaction)
		if statement.Keyword == "SELECT" && len(resultSet.Columns) > 0 {
			resultSet.Editable = session.editableTable(ctx, statement, resultSet.Columns)
		}
		execution.ResultSets = append(execution.ResultSets, resultSet)
	}
	execution.DurationMs = float64(time.Since(started).Microseconds()) / 1000
	execution.TxStatus = session.txStatus()
	return execution, nil
}

func (session *genericSession) editableTable(ctx context.Context, statement talpadbEngines.Statement, columns []talpadbDtos.QueryColumnDto) *talpadbDtos.EditableTableDto {
	reference, single := statement.SingleTable()
	if !single {
		return nil
	}
	schema := session.defaultSchema
	if reference.Schema != "" {
		schema = session.engine.NormalizeIdentifier(reference.Schema, reference.SchemaQuoted)
	}
	table := session.engine.NormalizeIdentifier(reference.Name, reference.NameQuoted)

	lookupContext, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	tableColumns, err := session.engine.TableColumns(lookupContext, session.conn, schema, table)
	if err != nil || len(tableColumns) == 0 {
		return nil
	}

	exactNames := map[string]talpadbEngines.TableColumn{}
	foldedNames := map[string]talpadbEngines.TableColumn{}
	for _, column := range tableColumns {
		exactNames[column.Name] = column
		foldedNames[strings.ToLower(column.Name)] = column
	}

	used := map[uint16]bool{}
	columnNumbers := make([]uint16, len(columns))
	for index, column := range columns {
		match, found := exactNames[column.Name]
		if !found {
			match, found = foldedNames[strings.ToLower(column.Name)]
		}
		if !found || used[match.Position] {
			continue
		}
		used[match.Position] = true
		columnNumbers[index] = match.Position
	}

	keys := []talpadbEngines.TableColumn{}
	for _, column := range tableColumns {
		if column.KeyOrder > 0 {
			keys = append(keys, column)
		}
	}
	if len(keys) == 0 {
		return nil
	}
	sort.SliceStable(keys, func(first, second int) bool { return keys[first].KeyOrder < keys[second].KeyOrder })

	keyColumns := make([]int, 0, len(keys))
	keyPositions := make([]uint16, 0, len(keys))
	for _, key := range keys {
		resultIndex := -1
		for index, position := range columnNumbers {
			if position == key.Position {
				resultIndex = index
				break
			}
		}
		if resultIndex < 0 {
			return nil
		}
		keyColumns = append(keyColumns, resultIndex)
		keyPositions = append(keyPositions, key.Position)
	}

	quotedColumns := map[uint16]string{}
	for _, column := range tableColumns {
		quotedColumns[column.Position] = column.QuotedName
	}
	session.nextTableID++
	session.editableTables[session.nextTableID] = &tableMeta{
		keys:          keyPositions,
		columns:       quotedColumns,
		placeholder:   session.engine.Placeholder,
		defaultValues: session.engine.DefaultValuesInsert(tableColumns[0].QuotedName),
		qualifiedName: session.engine.QuoteIdentifier(schema) + "." + session.engine.QuoteIdentifier(table),
	}
	return &talpadbDtos.EditableTableDto{
		Name:          table,
		Schema:        schema,
		TableOid:      session.nextTableID,
		KeyColumns:    keyColumns,
		ColumnNumbers: columnNumbers,
	}
}

func (session *genericSession) saveChanges(ctx context.Context, changes talpadbDtos.TableChangesDto) (*talpadbDtos.TableSaveResultDto, error) {
	meta, exists := session.editableTables[changes.TableOid]
	if !exists {
		return nil, errors.New("execute a consulta novamente antes de salvar")
	}

	var executor genericExecutor = session.conn
	var transaction *sql.Tx
	ownTransaction := !session.inTransaction
	if ownTransaction {
		started, err := session.conn.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		transaction, executor = started, started
	}

	result := &talpadbDtos.TableSaveResultDto{}
	err := applyTableChanges(meta, changes, result, func(statement string, params []*string) (int64, error) {
		executed, err := executor.ExecContext(ctx, statement, driverParams(params)...)
		if err != nil {
			return 0, err
		}
		return executed.RowsAffected()
	})
	if err != nil {
		if ownTransaction {
			_ = transaction.Rollback()
			return nil, fmt.Errorf("%s. Nada foi salvo", err.Error())
		}
		return nil, fmt.Errorf("%s. A transação aberta nesta aba continua ativa: execute ROLLBACK para desfazer", err.Error())
	}

	if ownTransaction {
		if err := transaction.Commit(); err != nil {
			return nil, fmt.Errorf("erro ao confirmar as alterações: %w", err)
		}
		result.Committed = true
	}
	result.TxStatus = session.txStatus()
	return result, nil
}
