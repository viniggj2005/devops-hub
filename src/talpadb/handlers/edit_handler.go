package talpadbHandlers

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
)

const editableTableQuery = `SELECT n.nspname, c.relname, c.relkind::text,
	COALESCE((SELECT i.indkey::int2[] FROM pg_catalog.pg_index i WHERE i.indrelid = c.oid AND i.indisprimary), '{}'::int2[])
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.oid = $1`

const tableMetaQuery = `SELECT pg_catalog.quote_ident(n.nspname) || '.' || pg_catalog.quote_ident(c.relname), c.relkind::text,
	COALESCE((SELECT pg_catalog.array_to_string(i.indkey::int2[], ',') FROM pg_catalog.pg_index i WHERE i.indrelid = c.oid AND i.indisprimary), '')
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.oid = $1`

const tableColumnsQuery = `SELECT a.attnum::text, pg_catalog.quote_ident(a.attname)
FROM pg_catalog.pg_attribute a
WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped`

type tableMeta struct {
	qualifiedName string
	defaultValues string
	keys          []uint16
	columns       map[uint16]string
	placeholder   func(position int) string
}

func (meta *tableMeta) bind(position int) string {
	if meta.placeholder == nil {
		return fmt.Sprintf("$%d", position)
	}
	return meta.placeholder(position)
}

func wireParams(params []*string) [][]byte {
	wire := make([][]byte, len(params))
	for index, value := range params {
		if value != nil {
			wire[index] = []byte(*value)
		}
	}
	return wire
}

func driverParams(params []*string) []any {
	values := make([]any, len(params))
	for index, value := range params {
		if value != nil {
			values[index] = *value
		}
	}
	return values
}

func isEditableRelation(kind string) bool {
	return kind == "r" || kind == "p"
}

func isUserColumn(column uint16) bool {
	return int16(column) > 0
}

func singleSourceTable(columns []talpadbDtos.QueryColumnDto) (uint32, bool) {
	var tableOid uint32
	for _, column := range columns {
		if column.SourceTableOid == 0 {
			continue
		}
		if tableOid != 0 && tableOid != column.SourceTableOid {
			return 0, false
		}
		tableOid = column.SourceTableOid
	}
	return tableOid, tableOid != 0
}

func (handlerStruct *TalpadbClientHandlerStruct) resolveEditableTables(session *querySession, resultSets []talpadbDtos.QueryResultSetDto) {
	var entry *poolEntry
	for index := range resultSets {
		tableOid, single := singleSourceTable(resultSets[index].Columns)
		if !single {
			continue
		}
		if entry == nil {
			pool, err := handlerStruct.getPoolForUser(session.windowName, session.userID, session.connectionID, session.database)
			if err != nil {
				return
			}
			entry = pool
		}
		resultSets[index].Editable = entry.editableTable(handlerStruct.baseContext(), tableOid, resultSets[index].Columns)
	}
}

func (entry *poolEntry) editableTable(ctx context.Context, tableOid uint32, columns []talpadbDtos.QueryColumnDto) *talpadbDtos.EditableTableDto {
	lookupContext, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var schema, name, kind string
	var keys []int16
	if err := entry.pool.QueryRow(lookupContext, editableTableQuery, tableOid).Scan(&schema, &name, &kind, &keys); err != nil {
		return nil
	}
	if !isEditableRelation(kind) || len(keys) == 0 {
		return nil
	}

	resultIndexByColumn := map[uint16]int{}
	columnNumbers := make([]uint16, len(columns))
	for index, column := range columns {
		if column.SourceTableOid != tableOid || !isUserColumn(column.SourceColumn) {
			continue
		}
		if _, duplicated := resultIndexByColumn[column.SourceColumn]; duplicated {
			continue
		}
		resultIndexByColumn[column.SourceColumn] = index
		columnNumbers[index] = column.SourceColumn
	}

	keyColumns := make([]int, 0, len(keys))
	for _, key := range keys {
		index, found := resultIndexByColumn[uint16(key)]
		if !found {
			return nil
		}
		keyColumns = append(keyColumns, index)
	}

	return &talpadbDtos.EditableTableDto{
		Name:          name,
		Schema:        schema,
		TableOid:      tableOid,
		KeyColumns:    keyColumns,
		ColumnNumbers: columnNumbers,
	}
}

func execParams(ctx context.Context, conn *pgconn.PgConn, sql string, params [][]byte) (*pgconn.Result, error) {
	result := conn.ExecParams(ctx, sql, params, nil, nil, nil).Read()
	return result, result.Err
}

func describeError(err error) string {
	message := toQueryMessage(err)
	if message.Detail != "" {
		return message.Message + " (" + message.Detail + ")"
	}
	return message.Message
}

func loadTableMeta(ctx context.Context, conn *pgconn.PgConn, tableOid uint32) (*tableMeta, error) {
	oidParam := [][]byte{[]byte(strconv.FormatUint(uint64(tableOid), 10))}

	result, err := execParams(ctx, conn, tableMetaQuery, oidParam)
	if err != nil {
		return nil, err
	}
	if len(result.Rows) == 0 {
		return nil, errors.New("a tabela não existe mais")
	}
	row := result.Rows[0]
	if !isEditableRelation(string(row[1])) {
		return nil, errors.New("só é possível editar dados de tabelas")
	}

	meta := &tableMeta{qualifiedName: string(row[0]), columns: map[uint16]string{}}
	for _, key := range strings.Split(string(row[2]), ",") {
		if number, err := strconv.ParseUint(key, 10, 16); err == nil {
			meta.keys = append(meta.keys, uint16(number))
		}
	}
	if len(meta.keys) == 0 {
		return nil, errors.New("a tabela não tem chave primária, então as linhas não podem ser identificadas com segurança")
	}

	columnsResult, err := execParams(ctx, conn, tableColumnsQuery, oidParam)
	if err != nil {
		return nil, err
	}
	for _, columnRow := range columnsResult.Rows {
		if number, err := strconv.ParseUint(string(columnRow[0]), 10, 16); err == nil {
			meta.columns[uint16(number)] = string(columnRow[1])
		}
	}
	return meta, nil
}

func (meta *tableMeta) whereClause(key []talpadbDtos.CellValueDto, params []*string) (string, []*string, error) {
	if len(key) != len(meta.keys) {
		return "", nil, errors.New("a linha não traz todas as colunas da chave primária")
	}
	values := map[uint16]*string{}
	for _, cell := range key {
		values[cell.Column] = cell.Value
	}

	conditions := make([]string, 0, len(meta.keys))
	for _, column := range meta.keys {
		value, found := values[column]
		if !found || value == nil {
			return "", nil, errors.New("a linha não traz todas as colunas da chave primária")
		}
		params = append(params, value)
		conditions = append(conditions, fmt.Sprintf("%s = %s", meta.columns[column], meta.bind(len(params))))
	}
	return strings.Join(conditions, " AND "), params, nil
}

func (meta *tableMeta) assignments(values []talpadbDtos.CellValueDto) ([]string, []*string, error) {
	seen := map[uint16]bool{}
	names := make([]string, 0, len(values))
	params := make([]*string, 0, len(values))
	for _, cell := range values {
		name, found := meta.columns[cell.Column]
		if !found {
			return nil, nil, fmt.Errorf("a coluna %d não existe mais na tabela", cell.Column)
		}
		if seen[cell.Column] {
			return nil, nil, fmt.Errorf("a coluna %s foi informada mais de uma vez", name)
		}
		seen[cell.Column] = true
		names = append(names, name)
		params = append(params, cell.Value)
	}
	return names, params, nil
}

func (meta *tableMeta) deleteStatement(change talpadbDtos.RowChangeDto) (string, []*string, error) {
	where, params, err := meta.whereClause(change.Key, nil)
	if err != nil {
		return "", nil, err
	}
	return fmt.Sprintf("DELETE FROM %s WHERE %s", meta.qualifiedName, where), params, nil
}

func (meta *tableMeta) updateStatement(change talpadbDtos.RowChangeDto) (string, []*string, error) {
	names, params, err := meta.assignments(change.Values)
	if err != nil {
		return "", nil, err
	}
	if len(names) == 0 {
		return "", nil, errors.New("nenhuma coluna alterada")
	}
	setClauses := make([]string, len(names))
	for index, name := range names {
		setClauses[index] = fmt.Sprintf("%s = %s", name, meta.bind(index+1))
	}
	where, params, err := meta.whereClause(change.Key, params)
	if err != nil {
		return "", nil, err
	}
	return fmt.Sprintf("UPDATE %s SET %s WHERE %s", meta.qualifiedName, strings.Join(setClauses, ", "), where), params, nil
}

func (meta *tableMeta) insertStatement(change talpadbDtos.RowChangeDto) (string, []*string, error) {
	names, params, err := meta.assignments(change.Values)
	if err != nil {
		return "", nil, err
	}
	if len(names) == 0 {
		defaultValues := meta.defaultValues
		if defaultValues == "" {
			defaultValues = " DEFAULT VALUES"
		}
		return fmt.Sprintf("INSERT INTO %s%s", meta.qualifiedName, defaultValues), nil, nil
	}
	placeholders := make([]string, len(names))
	for index := range names {
		placeholders[index] = meta.bind(index + 1)
	}
	return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", meta.qualifiedName, strings.Join(names, ", "), strings.Join(placeholders, ", ")), params, nil
}

type tableOperation struct {
	label      string
	expectsRow bool
	counter    *int
	changes    []talpadbDtos.RowChangeDto
	buildSQL   func(talpadbDtos.RowChangeDto) (string, []*string, error)
}

func applyTableChanges(meta *tableMeta, changes talpadbDtos.TableChangesDto, result *talpadbDtos.TableSaveResultDto, execute func(sql string, params []*string) (int64, error)) error {
	operations := []tableOperation{
		{label: "excluir", expectsRow: true, counter: &result.Deleted, changes: changes.Deletes, buildSQL: meta.deleteStatement},
		{label: "atualizar", expectsRow: true, counter: &result.Updated, changes: changes.Updates, buildSQL: meta.updateStatement},
		{label: "inserir", counter: &result.Inserted, changes: changes.Inserts, buildSQL: meta.insertStatement},
	}
	for _, operation := range operations {
		for position, change := range operation.changes {
			sql, params, err := operation.buildSQL(change)
			if err != nil {
				return fmt.Errorf("erro ao %s a linha %d: %w", operation.label, position+1, err)
			}
			affected, err := execute(sql, params)
			if err != nil {
				return fmt.Errorf("erro ao %s a linha %d: %s", operation.label, position+1, describeError(err))
			}
			if operation.expectsRow && affected != 1 {
				return fmt.Errorf("erro ao %s a linha %d: a linha não foi encontrada (pode ter sido alterada ou excluída por outra sessão)", operation.label, position+1)
			}
			*operation.counter++
		}
	}
	return nil
}

func (handlerStruct *TalpadbClientHandlerStruct) SaveTableChanges(token string, sessionId string, changes talpadbDtos.TableChangesDto) (*talpadbDtos.TableSaveResultDto, error) {
	session, err := handlerStruct.findSession(token, sessionId)
	if err != nil {
		return nil, err
	}
	if len(changes.Updates)+len(changes.Deletes)+len(changes.Inserts) == 0 {
		return nil, errors.New("não há alterações para salvar")
	}
	if !session.executionMutex.TryLock() {
		return nil, errors.New("já existe uma consulta em execução nesta aba")
	}
	defer session.executionMutex.Unlock()

	runContext, cancelRun := context.WithCancel(handlerStruct.baseContext())
	defer cancelRun()
	if !session.beginRun(cancelRun) {
		return nil, errors.New(sessionNotFoundMessage)
	}
	defer session.endRun()

	if session.generic != nil {
		return session.generic.saveChanges(runContext, changes)
	}

	conn := session.currentConn()
	if conn == nil || conn.IsClosed() {
		return nil, errors.New("a conexão foi encerrada: execute a consulta novamente antes de salvar")
	}
	if conn.TxStatus() == 'E' {
		return nil, errors.New("a transação atual falhou: execute ROLLBACK antes de salvar")
	}

	ownTransaction := conn.TxStatus() == 'I'
	if ownTransaction {
		if _, err := execParams(runContext, conn, "BEGIN", nil); err != nil {
			return nil, errors.New(describeError(err))
		}
	}

	fail := func(err error) (*talpadbDtos.TableSaveResultDto, error) {
		if ownTransaction {
			_, _ = execParams(runContext, conn, "ROLLBACK", nil)
			return nil, fmt.Errorf("%s. Nada foi salvo", err.Error())
		}
		return nil, fmt.Errorf("%s. A transação aberta nesta aba falhou: execute ROLLBACK", err.Error())
	}

	meta, err := loadTableMeta(runContext, conn, changes.TableOid)
	if err != nil {
		return fail(errors.New(describeError(err)))
	}

	result := &talpadbDtos.TableSaveResultDto{}
	if err := applyTableChanges(meta, changes, result, func(sql string, params []*string) (int64, error) {
		executed, err := execParams(runContext, conn, sql, wireParams(params))
		if err != nil {
			return 0, err
		}
		return executed.CommandTag.RowsAffected(), nil
	}); err != nil {
		return fail(err)
	}

	if ownTransaction {
		if _, err := execParams(runContext, conn, "COMMIT", nil); err != nil {
			return nil, fmt.Errorf("erro ao confirmar as alterações: %s", describeError(err))
		}
		result.Committed = true
	}
	result.TxStatus = txStatusLabel(conn)
	return result, nil
}
