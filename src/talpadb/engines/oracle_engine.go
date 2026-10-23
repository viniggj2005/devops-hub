package talpadbEngines

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	_ "github.com/sijms/go-ora/v2"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

type OracleEngine struct{}

type oracleColumnType struct {
	dataType   string
	charUsed   sql.NullString
	scale      sql.NullInt64
	precision  sql.NullInt64
	charLength sql.NullInt64
	dataLength sql.NullInt64
}

type oracleConstraint struct {
	name             string
	kind             string
	columns          []string
	condition        string
	deleteRule       string
	generatedName    bool
	targetOwner      string
	targetTable      string
	targetColumns    []string
	backingIndexName string
}

const oracleModernUserFilter = "(%[1]s.oracle_maintained = 'N' OR %[1]s.username = USER)"

const oracleLegacyUserFilter = `%[1]s.username NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP', 'APPQOSSYS', 'ANONYMOUS', 'CTXSYS', 'DIP',
	'EXFSYS', 'FLOWS_FILES', 'MDDATA', 'MDSYS', 'MGMT_VIEW', 'OLAPSYS', 'ORACLE_OCM', 'ORDDATA', 'ORDPLUGINS', 'ORDSYS',
	'SI_INFORMTN_SCHEMA', 'SPATIAL_CSW_ADMIN_USR', 'SPATIAL_WFS_ADMIN_USR', 'SYSMAN', 'WMSYS', 'XDB', 'XS$NULL',
	'APEX_PUBLIC_USER', 'OWBSYS', 'OWBSYS_AUDIT', 'AUDSYS', 'GSMADMIN_INTERNAL', 'OJVMSYS', 'LBACSYS', 'DVSYS', 'DVF')`

const oracleTablesQuery = `SELECT t.table_name, NVL(t.num_rows, 0), c.comments
FROM all_tables t
LEFT JOIN all_tab_comments c ON c.owner = t.owner AND c.table_name = t.table_name
WHERE t.owner = :1 AND t.nested = 'NO' AND t.secondary = 'N' AND t.dropped = 'NO'
  AND (t.iot_type IS NULL OR t.iot_type = 'IOT')
  AND NOT EXISTS (SELECT 1 FROM all_mviews m WHERE m.owner = t.owner AND m.mview_name = t.table_name)
ORDER BY t.table_name`

const oracleColumnsQuery = `SELECT c.column_id, c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
       c.char_length, c.char_used, c.nullable, c.virtual_column, %s, cm.comments, c.data_default
FROM all_tab_cols c
LEFT JOIN all_col_comments cm ON cm.owner = c.owner AND cm.table_name = c.table_name AND cm.column_name = c.column_name
WHERE c.owner = :1 AND c.table_name = :2 AND c.hidden_column = 'NO'
ORDER BY c.column_id`

const oracleConstraintsQuery = `SELECT c.constraint_name, c.constraint_type, c.delete_rule, c.generated, c.index_name,
       (SELECT LISTAGG(cc.column_name, ',') WITHIN GROUP (ORDER BY cc.position)
          FROM all_cons_columns cc WHERE cc.owner = c.owner AND cc.constraint_name = c.constraint_name),
       rc.owner, rc.table_name,
       (SELECT LISTAGG(rcc.column_name, ',') WITHIN GROUP (ORDER BY rcc.position)
          FROM all_cons_columns rcc WHERE rcc.owner = rc.owner AND rcc.constraint_name = rc.constraint_name),
       c.search_condition
FROM all_constraints c
LEFT JOIN all_constraints rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name
WHERE c.owner = :1 AND c.table_name = :2 AND c.constraint_type IN ('P', 'U', 'R', 'C')
ORDER BY DECODE(c.constraint_type, 'P', 0, 'U', 1, 'R', 2, 3), c.constraint_name`

const oracleIndexesQuery = `SELECT i.index_name, i.uniqueness,
       (SELECT LISTAGG(ic.column_name, ',') WITHIN GROUP (ORDER BY ic.column_position)
          FROM all_ind_columns ic WHERE ic.index_owner = i.owner AND ic.index_name = i.index_name)
FROM all_indexes i
WHERE i.table_owner = :1 AND i.table_name = :2
ORDER BY i.index_name`

const oracleTriggersQuery = `SELECT t.trigger_name, t.status, t.description, t.when_clause, t.trigger_body
FROM all_triggers t
WHERE t.table_owner = :1 AND t.table_name = :2
ORDER BY t.trigger_name`

func (engine *OracleEngine) Name() string { return talpadbFunctions.EngineOracle }

func (engine *OracleEngine) Label() string { return "Oracle" }

func (engine *OracleEngine) DriverName() string { return "oracle" }

func (engine *OracleEngine) DefaultPort() int64 { return 1521 }

func (engine *OracleEngine) DateOnlyAtMidnight() bool { return false }

func (engine *OracleEngine) DataSourceName(params talpadbFunctions.ConnectionParams) (string, error) {
	return talpadbFunctions.BuildOracleConnectionString(params), nil
}

func (engine *OracleEngine) PrepareSession(ctx context.Context, conn Querier) error {
	for _, statement := range []string{
		"ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'",
		"ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF'",
		"ALTER SESSION SET NLS_TIMESTAMP_TZ_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM'",
	} {
		if _, err := conn.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func (engine *OracleEngine) ServerVersion(ctx context.Context, db Querier) (string, error) {
	var version string
	err := db.QueryRowContext(ctx, "SELECT version FROM product_component_version WHERE product LIKE 'Oracle%' AND ROWNUM = 1").Scan(&version)
	if err == nil {
		return version, nil
	}
	if fallbackErr := db.QueryRowContext(ctx, "SELECT banner FROM v$version WHERE ROWNUM = 1").Scan(&version); fallbackErr == nil {
		return version, nil
	}
	return "", err
}

func (engine *OracleEngine) DefaultSchema(ctx context.Context, db Querier) (string, error) {
	var schema string
	err := db.QueryRowContext(ctx, "SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') FROM DUAL").Scan(&schema)
	return schema, err
}

func (engine *OracleEngine) QuoteIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func (engine *OracleEngine) Placeholder(position int) string { return fmt.Sprintf(":%d", position) }

func (engine *OracleEngine) NormalizeIdentifier(name string, quoted bool) string {
	if quoted {
		return name
	}
	return strings.ToUpper(name)
}

func (engine *OracleEngine) SplitStatements(script string) []Statement {
	return splitStatements(script, oracleDialect)
}

func (engine *OracleEngine) DefaultValuesInsert(firstColumn string) string {
	return fmt.Sprintf(" (%s) VALUES (DEFAULT)", firstColumn)
}

func (engine *OracleEngine) TransactionState(statement Statement, inTransaction bool) bool {
	return false
}

func (engine *OracleEngine) displayName(name string) string {
	return quoteIfNeeded(name, engine.QuoteIdentifier, true)
}

func (engine *OracleEngine) qualified(schema string, name string) string {
	return engine.displayName(schema) + "." + engine.displayName(name)
}

func (engine *OracleEngine) joinNames(names []string) string {
	display := make([]string, len(names))
	for index, name := range names {
		display[index] = engine.displayName(name)
	}
	return strings.Join(display, ", ")
}

func queryWithFallback(ctx context.Context, db Querier, queries []string, args ...any) (*sql.Rows, error) {
	var lastErr error
	for _, query := range queries {
		rows, err := db.QueryContext(ctx, query, args...)
		if err == nil {
			return rows, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func userFilterQueries(template string, alias string) []string {
	return []string{
		fmt.Sprintf(template, fmt.Sprintf(oracleModernUserFilter, alias)),
		fmt.Sprintf(template, fmt.Sprintf(oracleLegacyUserFilter, alias)),
	}
}

func splitList(value sql.NullString) []string {
	if !value.Valid || value.String == "" {
		return []string{}
	}
	return strings.Split(value.String, ",")
}

func OracleTypeName(columnType oracleColumnType) string {
	switch columnType.dataType {
	case "VARCHAR2", "CHAR":
		if columnType.charUsed.String == "C" {
			return fmt.Sprintf("%s(%d CHAR)", columnType.dataType, columnType.charLength.Int64)
		}
		return fmt.Sprintf("%s(%d)", columnType.dataType, columnType.dataLength.Int64)
	case "NVARCHAR2", "NCHAR":
		return fmt.Sprintf("%s(%d)", columnType.dataType, columnType.charLength.Int64)
	case "RAW":
		return fmt.Sprintf("RAW(%d)", columnType.dataLength.Int64)
	case "FLOAT":
		if columnType.precision.Valid {
			return fmt.Sprintf("FLOAT(%d)", columnType.precision.Int64)
		}
	case "NUMBER":
		switch {
		case columnType.precision.Valid && columnType.scale.Valid && columnType.scale.Int64 != 0:
			return fmt.Sprintf("NUMBER(%d,%d)", columnType.precision.Int64, columnType.scale.Int64)
		case columnType.precision.Valid:
			return fmt.Sprintf("NUMBER(%d)", columnType.precision.Int64)
		case columnType.scale.Valid && columnType.scale.Int64 == 0:
			return "INTEGER"
		}
	}
	return columnType.dataType
}

func (engine *OracleEngine) ListDatabases(ctx context.Context, db Querier, params talpadbFunctions.ConnectionParams) ([]talpadbDtos.DatabaseDto, error) {
	var encoding sql.NullString
	if err := db.QueryRowContext(ctx, "SELECT value FROM nls_database_parameters WHERE parameter = 'NLS_CHARACTERSET'").Scan(&encoding); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return []talpadbDtos.DatabaseDto{{Name: params.Database, Owner: params.Username, Encoding: encoding.String, AllowConnect: true}}, nil
}

func (engine *OracleEngine) schemaNames(ctx context.Context, db Querier) ([]string, error) {
	rows, err := queryWithFallback(ctx, db, userFilterQueries(
		"SELECT u.username FROM all_users u WHERE %s ORDER BY CASE WHEN u.username = USER THEN 0 ELSE 1 END, u.username", "u",
	))
	if err != nil {
		return nil, err
	}
	return scanStrings(rows)
}

func (engine *OracleEngine) ListSchemas(ctx context.Context, db Querier) ([]talpadbDtos.SchemaDto, error) {
	names, err := engine.schemaNames(ctx, db)
	if err != nil {
		return nil, err
	}
	schemas := make([]talpadbDtos.SchemaDto, len(names))
	for index, name := range names {
		schemas[index] = talpadbDtos.SchemaDto{Name: name, Owner: name}
	}
	return schemas, nil
}

func (engine *OracleEngine) relations(ctx context.Context, db Querier, query string, kind string, schema string) ([]talpadbDtos.RelationDto, error) {
	rows, err := db.QueryContext(ctx, query, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	columnCount := 1
	if columns, err := rows.Columns(); err == nil {
		columnCount = len(columns)
	}
	relations := []talpadbDtos.RelationDto{}
	for rows.Next() {
		relation := talpadbDtos.RelationDto{Kind: kind}
		var comment sql.NullString
		targets := []any{&relation.Name, &relation.EstimatedRows, &comment}
		if err := rows.Scan(targets[:columnCount]...); err != nil {
			return nil, err
		}
		relation.Comment = nullableString(comment)
		relations = append(relations, relation)
	}
	return relations, rows.Err()
}

func (engine *OracleEngine) ListSchemaObjects(ctx context.Context, db Querier, schema string) (*talpadbDtos.SchemaObjectsDto, error) {
	objects := emptySchemaObjects()
	var err error
	if objects.Tables, err = engine.relations(ctx, db, oracleTablesQuery, "r", schema); err != nil {
		return nil, err
	}
	if objects.Views, err = engine.relations(ctx, db, `SELECT v.view_name, 0, c.comments
FROM all_views v
LEFT JOIN all_tab_comments c ON c.owner = v.owner AND c.table_name = v.view_name
WHERE v.owner = :1 ORDER BY v.view_name`, "v", schema); err != nil {
		return nil, err
	}
	if objects.MaterializedViews, err = engine.relations(ctx, db, "SELECT mview_name FROM all_mviews WHERE owner = :1 ORDER BY mview_name", "m", schema); err != nil {
		return nil, err
	}
	if objects.Sequences, err = engine.relations(ctx, db, "SELECT sequence_name FROM all_sequences WHERE sequence_owner = :1 ORDER BY sequence_name", "S", schema); err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `SELECT object_id, object_name, object_type
FROM all_objects
WHERE owner = :1 AND object_type IN ('FUNCTION', 'PROCEDURE', 'PACKAGE')
ORDER BY object_name, object_type`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var objectID int64
		var name, objectType string
		if err := rows.Scan(&objectID, &name, &objectType); err != nil {
			return nil, err
		}
		kind := map[string]string{"FUNCTION": "f", "PROCEDURE": "p", "PACKAGE": "k"}[objectType]
		objects.Functions = append(objects.Functions, talpadbDtos.FunctionDto{
			Oid:        uint32(objectID),
			Name:       name,
			Kind:       kind,
			ResultType: strings.ToLower(objectType),
		})
	}
	return objects, rows.Err()
}

func (engine *OracleEngine) ListColumns(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.ColumnDto, error) {
	rows, err := queryWithFallback(ctx, db, []string{
		fmt.Sprintf(oracleColumnsQuery, "c.identity_column"),
		fmt.Sprintf(oracleColumnsQuery, "'NO'"),
	}, schema, relation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := []talpadbDtos.ColumnDto{}
	for rows.Next() {
		var columnID int64
		var columnType oracleColumnType
		var comment, defaultValue sql.NullString
		var name, nullable, virtual, identity string
		if err := rows.Scan(&columnID, &name, &columnType.dataType, &columnType.dataLength, &columnType.precision, &columnType.scale,
			&columnType.charLength, &columnType.charUsed, &nullable, &virtual, &identity, &comment, &defaultValue); err != nil {
			return nil, err
		}
		column := talpadbDtos.ColumnDto{
			Position:   int16(columnID),
			Name:       name,
			NotNull:    nullable == "N",
			DataType:   OracleTypeName(columnType),
			QuotedName: engine.displayName(name),
			Comment:    nullableString(comment),
		}
		if trimmed := strings.TrimSpace(defaultValue.String); trimmed != "" {
			column.DefaultValue = &trimmed
		}
		if virtual == "YES" {
			column.Generated = "v"
		}
		if identity == "YES" {
			column.Identity = "d"
			column.DefaultValue = nil
		}
		columns = append(columns, column)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(columns) == 0 {
		return nil, fmt.Errorf("objeto %s.%s não encontrado", schema, relation)
	}

	if identityRows, err := db.QueryContext(ctx, "SELECT column_name, generation_type FROM all_tab_identity_cols WHERE owner = :1 AND table_name = :2", schema, relation); err == nil {
		generations := map[string]string{}
		for identityRows.Next() {
			var name, generation string
			if identityRows.Scan(&name, &generation) == nil {
				generations[name] = generation
			}
		}
		identityRows.Close()
		for index := range columns {
			if generations[columns[index].Name] == "ALWAYS" {
				columns[index].Identity = "a"
			}
		}
	}

	keyRows, err := db.QueryContext(ctx, `SELECT cc.column_name, c.constraint_type
FROM all_constraints c
JOIN all_cons_columns cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
WHERE c.owner = :1 AND c.table_name = :2 AND c.constraint_type IN ('P', 'R')`, schema, relation)
	if err != nil {
		return nil, err
	}
	defer keyRows.Close()
	primaryKeys, foreignKeys := map[string]bool{}, map[string]bool{}
	for keyRows.Next() {
		var name, constraintType string
		if err := keyRows.Scan(&name, &constraintType); err != nil {
			return nil, err
		}
		if constraintType == "P" {
			primaryKeys[name] = true
		} else {
			foreignKeys[name] = true
		}
	}
	for index := range columns {
		columns[index].IsPrimaryKey = primaryKeys[columns[index].Name]
		columns[index].IsForeignKey = foreignKeys[columns[index].Name]
	}
	return columns, keyRows.Err()
}

func (engine *OracleEngine) objectKind(ctx context.Context, db Querier, schema string, name string) (string, error) {
	rows, err := db.QueryContext(ctx, "SELECT object_type FROM all_objects WHERE owner = :1 AND object_name = :2 AND object_type IN ('TABLE', 'VIEW', 'MATERIALIZED VIEW')", schema, name)
	if err != nil {
		return "", err
	}
	types, err := scanStrings(rows)
	if err != nil {
		return "", err
	}
	kind := ""
	for _, objectType := range types {
		switch {
		case objectType == "MATERIALIZED VIEW":
			return "m", nil
		case objectType == "VIEW":
			kind = "v"
		case objectType == "TABLE" && kind == "":
			kind = "r"
		}
	}
	if kind == "" {
		return "", fmt.Errorf("objeto %s.%s não encontrado", schema, name)
	}
	return kind, nil
}

func (engine *OracleEngine) constraints(ctx context.Context, db Querier, schema string, table string) ([]oracleConstraint, error) {
	rows, err := db.QueryContext(ctx, oracleConstraintsQuery, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	constraints := []oracleConstraint{}
	for rows.Next() {
		var constraint oracleConstraint
		var generated string
		var deleteRule, indexName, columns, targetOwner, targetTable, targetColumns, condition sql.NullString
		if err := rows.Scan(&constraint.name, &constraint.kind, &deleteRule, &generated, &indexName, &columns,
			&targetOwner, &targetTable, &targetColumns, &condition); err != nil {
			return nil, err
		}
		constraint.condition = strings.TrimSpace(condition.String)
		if constraint.kind == "C" && isNotNullCondition(constraint.condition) {
			continue
		}
		constraint.columns = splitList(columns)
		constraint.deleteRule = deleteRule.String
		constraint.targetOwner = targetOwner.String
		constraint.targetTable = targetTable.String
		constraint.targetColumns = splitList(targetColumns)
		constraint.backingIndexName = indexName.String
		constraint.generatedName = generated == "GENERATED NAME"
		constraints = append(constraints, constraint)
	}
	return constraints, rows.Err()
}

func isNotNullCondition(condition string) bool {
	return strings.HasPrefix(condition, `"`) && strings.HasSuffix(condition, `" IS NOT NULL`) && strings.Count(condition, `"`) == 2
}

func (engine *OracleEngine) constraintDefinition(constraint oracleConstraint) string {
	switch constraint.kind {
	case "P":
		return "PRIMARY KEY (" + engine.joinNames(constraint.columns) + ")"
	case "U":
		return "UNIQUE (" + engine.joinNames(constraint.columns) + ")"
	case "C":
		return "CHECK (" + constraint.condition + ")"
	}
	definition := fmt.Sprintf("FOREIGN KEY (%s) REFERENCES %s (%s)", engine.joinNames(constraint.columns),
		engine.qualified(constraint.targetOwner, constraint.targetTable), engine.joinNames(constraint.targetColumns))
	if constraint.deleteRule != "" && constraint.deleteRule != "NO ACTION" {
		definition += " ON DELETE " + constraint.deleteRule
	}
	return definition
}

func (engine *OracleEngine) relationSizes(ctx context.Context, db Querier, schema string, table string) (int64, int64) {
	var tableSize, indexSize int64
	indexFilter := "SELECT i.index_name FROM all_indexes i WHERE i.table_owner = :5 AND i.table_name = :6"
	err := db.QueryRowContext(ctx, `SELECT NVL(SUM(CASE WHEN s.segment_name = :1 THEN s.bytes END), 0),
       NVL(SUM(CASE WHEN s.segment_name <> :2 THEN s.bytes END), 0)
FROM dba_segments s
WHERE s.owner = :3 AND (s.segment_name = :4 OR s.segment_name IN (`+indexFilter+`))`,
		table, table, schema, table, schema, table).Scan(&tableSize, &indexSize)
	if err == nil {
		return tableSize, indexSize
	}
	err = db.QueryRowContext(ctx, `SELECT NVL(SUM(CASE WHEN s.segment_name = :1 THEN s.bytes END), 0),
       NVL(SUM(CASE WHEN s.segment_name <> :2 THEN s.bytes END), 0)
FROM user_segments s
WHERE USER = :3 AND (s.segment_name = :4 OR s.segment_name IN (`+indexFilter+`))`,
		table, table, schema, table, schema, table).Scan(&tableSize, &indexSize)
	if err != nil {
		return 0, 0
	}
	return tableSize, indexSize
}

func (engine *OracleEngine) TableDetails(ctx context.Context, db Querier, schema string, relation string) (*talpadbDtos.TableDetailsDto, error) {
	kind, err := engine.objectKind(ctx, db, schema, relation)
	if err != nil {
		return nil, err
	}
	details := emptyTableDetails(schema, relation, kind)
	details.Owner = schema

	if details.Columns, err = engine.ListColumns(ctx, db, schema, relation); err != nil {
		return nil, err
	}

	var comment sql.NullString
	if err := db.QueryRowContext(ctx, "SELECT comments FROM all_tab_comments WHERE owner = :1 AND table_name = :2", schema, relation).Scan(&comment); err == nil {
		details.Comment = nullableString(comment)
	}

	if kind != "v" {
		_ = db.QueryRowContext(ctx, "SELECT NVL(num_rows, 0) FROM all_tables WHERE owner = :1 AND table_name = :2", schema, relation).Scan(&details.EstimatedRows)
		details.TableSizeBytes, details.IndexSizeBytes = engine.relationSizes(ctx, db, schema, relation)
		details.TotalSizeBytes = details.TableSizeBytes + details.IndexSizeBytes
		if err := engine.fillIndexesAndConstraints(ctx, db, details); err != nil {
			return nil, err
		}
	}

	if details.Triggers, err = engine.triggers(ctx, db, schema, relation); err != nil {
		return nil, err
	}

	if details.Ddl, err = engine.relationDdl(ctx, db, details); err != nil {
		return nil, err
	}
	return details, nil
}

func (engine *OracleEngine) fillIndexesAndConstraints(ctx context.Context, db Querier, details *talpadbDtos.TableDetailsDto) error {
	constraints, err := engine.constraints(ctx, db, details.Schema, details.Name)
	if err != nil {
		return err
	}
	backingIndexes := map[string]string{}
	typeCodes := map[string]string{"P": "p", "U": "u", "R": "f", "C": "c"}
	for _, constraint := range constraints {
		if constraint.backingIndexName != "" {
			backingIndexes[constraint.backingIndexName] = constraint.kind
		}
		details.Constraints = append(details.Constraints, talpadbDtos.ConstraintDto{
			Name:       constraint.name,
			Type:       typeCodes[constraint.kind],
			IsLocal:    true,
			QuotedName: engine.displayName(constraint.name),
			Definition: engine.constraintDefinition(constraint),
		})
	}

	rows, err := db.QueryContext(ctx, oracleIndexesQuery, details.Schema, details.Name)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var name, uniqueness string
		var columns sql.NullString
		if err := rows.Scan(&name, &uniqueness, &columns); err != nil {
			return err
		}
		backingKind, backed := backingIndexes[name]
		unique := uniqueness == "UNIQUE"
		uniqueKeyword := ""
		if unique {
			uniqueKeyword = "UNIQUE "
		}
		details.Indexes = append(details.Indexes, talpadbDtos.IndexDto{
			Name:             name,
			IsUnique:         unique,
			IsPrimary:        backingKind == "P",
			QuotedName:       engine.displayName(name),
			ConstraintBacked: backed,
			Definition: fmt.Sprintf("CREATE %sINDEX %s ON %s (%s)", uniqueKeyword, engine.qualified(details.Schema, name),
				engine.qualified(details.Schema, details.Name), engine.joinNames(splitList(columns))),
		})
	}
	return rows.Err()
}

func (engine *OracleEngine) triggers(ctx context.Context, db Querier, schema string, table string) ([]talpadbDtos.TriggerDto, error) {
	rows, err := db.QueryContext(ctx, oracleTriggersQuery, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	triggers := []talpadbDtos.TriggerDto{}
	for rows.Next() {
		var name, status string
		var description, whenClause, body sql.NullString
		if err := rows.Scan(&name, &status, &description, &whenClause, &body); err != nil {
			return nil, err
		}
		definition := "CREATE OR REPLACE TRIGGER " + strings.TrimSpace(description.String)
		if strings.TrimSpace(whenClause.String) != "" {
			definition += "\nWHEN (" + strings.TrimSpace(whenClause.String) + ")"
		}
		definition += "\n" + strings.TrimSpace(body.String)
		triggers = append(triggers, talpadbDtos.TriggerDto{Name: name, Enabled: status == "ENABLED", Definition: definition})
	}
	return triggers, rows.Err()
}

func (engine *OracleEngine) longText(ctx context.Context, db Querier, query string, args ...any) (string, error) {
	var text sql.NullString
	if err := db.QueryRowContext(ctx, query, args...).Scan(&text); err != nil {
		return "", err
	}
	return strings.TrimRight(strings.TrimSpace(text.String), ";"), nil
}

func (engine *OracleEngine) writeComments(builder *strings.Builder, objectType string, details *talpadbDtos.TableDetailsDto) {
	qualified := engine.qualified(details.Schema, details.Name)
	if details.Comment != nil {
		fmt.Fprintf(builder, "\nCOMMENT ON %s %s IS %s;\n", objectType, qualified, talpadbFunctions.QuoteLiteral(*details.Comment))
	}
	for _, column := range details.Columns {
		if column.Comment != nil {
			fmt.Fprintf(builder, "\nCOMMENT ON COLUMN %s.%s IS %s;\n", qualified, column.QuotedName, talpadbFunctions.QuoteLiteral(*column.Comment))
		}
	}
}

func (engine *OracleEngine) columnDefinition(column talpadbDtos.ColumnDto) string {
	definition := "    " + column.QuotedName + " " + column.DataType
	switch {
	case column.Identity == "a":
		definition += " GENERATED ALWAYS AS IDENTITY"
	case column.Identity == "d":
		definition += " GENERATED BY DEFAULT AS IDENTITY"
	case column.Generated == "v" && column.DefaultValue != nil:
		return definition + " GENERATED ALWAYS AS (" + *column.DefaultValue + ") VIRTUAL"
	case column.DefaultValue != nil:
		definition += " DEFAULT " + *column.DefaultValue
	}
	if column.NotNull {
		definition += " NOT NULL"
	}
	return definition
}

func (engine *OracleEngine) relationDdl(ctx context.Context, db Querier, details *talpadbDtos.TableDetailsDto) (string, error) {
	var builder strings.Builder
	qualified := engine.qualified(details.Schema, details.Name)

	switch details.Kind {
	case "v":
		text, err := engine.longText(ctx, db, "SELECT text FROM all_views WHERE owner = :1 AND view_name = :2", details.Schema, details.Name)
		if err != nil {
			return "", err
		}
		fmt.Fprintf(&builder, "-- View: %s\n\n-- DROP VIEW %s;\n\nCREATE OR REPLACE VIEW %s AS\n%s;\n", qualified, qualified, qualified, text)
		engine.writeComments(&builder, "TABLE", details)
	case "m":
		text, err := engine.longText(ctx, db, "SELECT query FROM all_mviews WHERE owner = :1 AND mview_name = :2", details.Schema, details.Name)
		if err != nil {
			return "", err
		}
		fmt.Fprintf(&builder, "-- Materialized View: %s\n\n-- DROP MATERIALIZED VIEW %s;\n\nCREATE MATERIALIZED VIEW %s AS\n%s;\n", qualified, qualified, qualified, text)
		engine.writeComments(&builder, "MATERIALIZED VIEW", details)
	default:
		fmt.Fprintf(&builder, "-- Table: %s\n\n-- DROP TABLE %s CASCADE CONSTRAINTS;\n\n", qualified, qualified)
		lines := make([]string, 0, len(details.Columns)+len(details.Constraints))
		for _, column := range details.Columns {
			lines = append(lines, engine.columnDefinition(column))
		}
		for _, constraint := range details.Constraints {
			prefix := "    CONSTRAINT " + constraint.QuotedName + " "
			if strings.HasPrefix(constraint.Name, "SYS_C") {
				prefix = "    "
			}
			lines = append(lines, prefix+constraint.Definition)
		}
		fmt.Fprintf(&builder, "CREATE TABLE %s\n(\n%s\n);\n", qualified, strings.Join(lines, ",\n"))
		engine.writeComments(&builder, "TABLE", details)
		for _, index := range details.Indexes {
			if !index.ConstraintBacked {
				fmt.Fprintf(&builder, "\n%s;\n", index.Definition)
			}
		}
	}

	for _, trigger := range details.Triggers {
		fmt.Fprintf(&builder, "\n%s\n/\n", trigger.Definition)
	}
	return builder.String(), nil
}

func (engine *OracleEngine) sequenceDdl(ctx context.Context, db Querier, schema string, name string) (string, error) {
	var minValue, maxValue, increment, cache, lastNumber, cycle, order string
	err := db.QueryRowContext(ctx, `SELECT TO_CHAR(min_value), TO_CHAR(max_value), TO_CHAR(increment_by), TO_CHAR(cache_size),
       TO_CHAR(last_number), cycle_flag, order_flag
FROM all_sequences WHERE sequence_owner = :1 AND sequence_name = :2`, schema, name).Scan(&minValue, &maxValue, &increment, &cache, &lastNumber, &cycle, &order)
	if errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("sequência %s.%s não encontrada", schema, name)
	}
	if err != nil {
		return "", err
	}
	qualified := engine.qualified(schema, name)
	cacheClause := "CACHE " + cache
	if cache == "0" {
		cacheClause = "NOCACHE"
	}
	cycleClause := map[bool]string{true: "CYCLE", false: "NOCYCLE"}[cycle == "Y"]
	orderClause := map[bool]string{true: "ORDER", false: "NOORDER"}[order == "Y"]
	return fmt.Sprintf("-- SEQUENCE: %s\n\n-- DROP SEQUENCE %s;\n\nCREATE SEQUENCE %s\n    START WITH %s\n    INCREMENT BY %s\n    MINVALUE %s\n    MAXVALUE %s\n    %s\n    %s\n    %s;\n",
		qualified, qualified, qualified, lastNumber, increment, minValue, maxValue, cacheClause, cycleClause, orderClause), nil
}

func (engine *OracleEngine) programDdl(ctx context.Context, db Querier, objectID uint32) (string, error) {
	var owner, name, objectType string
	err := db.QueryRowContext(ctx, "SELECT owner, object_name, object_type FROM all_objects WHERE object_id = :1", int64(objectID)).Scan(&owner, &name, &objectType)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errors.New("função não encontrada")
	}
	if err != nil {
		return "", err
	}

	sourceTypes := []string{objectType}
	if objectType == "PACKAGE" {
		sourceTypes = append(sourceTypes, "PACKAGE BODY")
	}

	var builder strings.Builder
	qualified := engine.qualified(owner, name)
	fmt.Fprintf(&builder, "-- %s: %s\n\n-- DROP %s %s;\n", objectType, qualified, objectType, qualified)
	for _, sourceType := range sourceTypes {
		rows, err := db.QueryContext(ctx, "SELECT text FROM all_source WHERE owner = :1 AND name = :2 AND type = :3 ORDER BY line", owner, name, sourceType)
		if err != nil {
			return "", err
		}
		lines, err := scanStrings(rows)
		if err != nil {
			return "", err
		}
		if len(lines) == 0 {
			continue
		}
		fmt.Fprintf(&builder, "\nCREATE OR REPLACE %s\n/\n", strings.TrimRight(strings.Join(lines, ""), " \n\t"))
	}
	return builder.String(), nil
}

func (engine *OracleEngine) ObjectDdl(ctx context.Context, db Querier, object talpadbDtos.ObjectReferenceDto) (string, error) {
	switch object.Kind {
	case "table", "view", "matview":
		details, err := engine.TableDetails(ctx, db, object.Schema, object.Name)
		if err != nil {
			return "", err
		}
		return details.Ddl, nil
	case "sequence":
		return engine.sequenceDdl(ctx, db, object.Schema, object.Name)
	case "function":
		return engine.programDdl(ctx, db, object.Oid)
	case "schema":
		name := engine.displayName(object.Name)
		return fmt.Sprintf("-- SCHEMA (usuário): %s\n\n-- DROP USER %s CASCADE;\n\nCREATE USER %s IDENTIFIED BY \"<senha>\";\n", name, name, name), nil
	}
	return "", fmt.Errorf("tipo de objeto não suportado no Oracle: %s", object.Kind)
}

func (engine *OracleEngine) CompletionSchema(ctx context.Context, db Querier) ([]talpadbDtos.CompletionTableDto, error) {
	rows, err := queryWithFallback(ctx, db, userFilterQueries(`SELECT owner, table_name, column_name FROM (
  SELECT c.owner, c.table_name, c.column_name
  FROM all_tab_columns c
  WHERE c.table_name NOT LIKE 'BIN$%%' AND c.owner IN (SELECT u.username FROM all_users u WHERE %s)
  ORDER BY c.owner, c.table_name, c.column_id
) WHERE ROWNUM <= 50000`, "u"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tables := []talpadbDtos.CompletionTableDto{}
	for rows.Next() {
		var owner, table, column string
		if err := rows.Scan(&owner, &table, &column); err != nil {
			return nil, err
		}
		if len(tables) == 0 || tables[len(tables)-1].Name != table || tables[len(tables)-1].Schema != owner {
			if len(tables) == 5000 {
				break
			}
			tables = append(tables, talpadbDtos.CompletionTableDto{Schema: owner, Name: table, Columns: []string{}})
		}
		tables[len(tables)-1].Columns = append(tables[len(tables)-1].Columns, column)
	}
	return tables, rows.Err()
}

func (engine *OracleEngine) Diagram(ctx context.Context, db Querier, schema string) (*talpadbDtos.DatabaseDiagramDto, error) {
	if schema == "" {
		current, err := engine.DefaultSchema(ctx, db)
		if err != nil {
			return nil, err
		}
		schema = current
	}

	relations, err := engine.relations(ctx, db, oracleTablesQuery, "r", schema)
	if err != nil {
		return nil, err
	}
	diagram := &talpadbDtos.DatabaseDiagramDto{Tables: []talpadbDtos.DiagramTableDto{}, Relations: []talpadbDtos.DiagramRelationDto{}}
	tableIndex := map[string]int{}
	for _, relation := range relations {
		if len(diagram.Tables) == MaxDiagramTables {
			diagram.Truncated = true
			break
		}
		tableIndex[relation.Name] = len(diagram.Tables)
		diagram.Tables = append(diagram.Tables, talpadbDtos.DiagramTableDto{
			Name: relation.Name, Kind: "r", Schema: schema, Comment: relation.Comment, Columns: []talpadbDtos.DiagramColumnDto{},
		})
	}
	if len(diagram.Tables) == 0 {
		return diagram, nil
	}

	columnRows, err := db.QueryContext(ctx, `SELECT c.table_name, c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
       c.char_length, c.char_used, c.nullable
FROM all_tab_columns c
WHERE c.owner = :1
ORDER BY c.table_name, c.column_id`, schema)
	if err != nil {
		return nil, err
	}
	defer columnRows.Close()
	for columnRows.Next() {
		var table, name, nullable string
		var columnType oracleColumnType
		if err := columnRows.Scan(&table, &name, &columnType.dataType, &columnType.dataLength, &columnType.precision, &columnType.scale,
			&columnType.charLength, &columnType.charUsed, &nullable); err != nil {
			return nil, err
		}
		index, exists := tableIndex[table]
		if !exists {
			continue
		}
		diagram.Tables[index].Columns = append(diagram.Tables[index].Columns, talpadbDtos.DiagramColumnDto{
			Name: name, NotNull: nullable == "N", DataType: OracleTypeName(columnType),
		})
	}
	if err := columnRows.Err(); err != nil {
		return nil, err
	}

	constraintRows, err := db.QueryContext(ctx, `SELECT c.constraint_name, c.constraint_type, c.table_name,
       (SELECT LISTAGG(cc.column_name, ',') WITHIN GROUP (ORDER BY cc.position)
          FROM all_cons_columns cc WHERE cc.owner = c.owner AND cc.constraint_name = c.constraint_name),
       rc.owner, rc.table_name,
       (SELECT LISTAGG(rcc.column_name, ',') WITHIN GROUP (ORDER BY rcc.position)
          FROM all_cons_columns rcc WHERE rcc.owner = rc.owner AND rcc.constraint_name = rc.constraint_name)
FROM all_constraints c
LEFT JOIN all_constraints rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name
WHERE c.owner = :1 AND c.constraint_type IN ('P', 'U', 'R')
ORDER BY c.table_name, c.constraint_name`, schema)
	if err != nil {
		return nil, err
	}
	defer constraintRows.Close()
	for constraintRows.Next() {
		var name, constraintType, table string
		var columns, targetOwner, targetTable, targetColumns sql.NullString
		if err := constraintRows.Scan(&name, &constraintType, &table, &columns, &targetOwner, &targetTable, &targetColumns); err != nil {
			return nil, err
		}
		index, exists := tableIndex[table]
		if !exists {
			continue
		}
		sourceColumns := splitList(columns)
		markColumns(&diagram.Tables[index], sourceColumns, constraintType)
		if constraintType != "R" || targetOwner.String != schema {
			continue
		}
		if _, targetExists := tableIndex[targetTable.String]; !targetExists {
			continue
		}
		diagram.Relations = append(diagram.Relations, talpadbDtos.DiagramRelationDto{
			Name:          name,
			SourceSchema:  schema,
			SourceTable:   table,
			TargetSchema:  schema,
			TargetTable:   targetTable.String,
			SourceColumns: sourceColumns,
			TargetColumns: splitList(targetColumns),
		})
	}
	return diagram, constraintRows.Err()
}

func markColumns(table *talpadbDtos.DiagramTableDto, columns []string, constraintType string) {
	for index := range table.Columns {
		for _, name := range columns {
			if table.Columns[index].Name != name {
				continue
			}
			switch constraintType {
			case "P":
				table.Columns[index].IsPrimaryKey = true
			case "R":
				table.Columns[index].IsForeignKey = true
			case "U":
				table.Columns[index].IsUnique = table.Columns[index].IsUnique || len(columns) == 1
			}
		}
	}
}

func (engine *OracleEngine) TableColumns(ctx context.Context, db Querier, schema string, table string) ([]TableColumn, error) {
	rows, err := db.QueryContext(ctx, `SELECT c.column_id, c.column_name,
       NVL((SELECT MIN(cc.position)
              FROM all_constraints k
              JOIN all_cons_columns cc ON cc.owner = k.owner AND cc.constraint_name = k.constraint_name
             WHERE k.owner = c.owner AND k.table_name = c.table_name AND k.constraint_type = 'P'
               AND cc.column_name = c.column_name), 0)
FROM all_tab_columns c
WHERE c.owner = :1 AND c.table_name = :2
ORDER BY c.column_id`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	columns := []TableColumn{}
	for rows.Next() {
		var position, keyOrder int64
		var name string
		if err := rows.Scan(&position, &name, &keyOrder); err != nil {
			return nil, err
		}
		columns = append(columns, TableColumn{Position: uint16(position), Name: name, KeyOrder: int(keyOrder), QuotedName: engine.QuoteIdentifier(name)})
	}
	return columns, rows.Err()
}

func (engine *OracleEngine) DropStatement(ctx context.Context, db Querier, input talpadbDtos.DropObjectInputDto) (string, error) {
	if input.Kind != "relation" {
		return "", fmt.Errorf("%w: excluir %s no Oracle", ErrUnsupported, input.Kind)
	}
	kind, err := engine.objectKind(ctx, db, input.Schema, input.Name)
	if err != nil {
		return "", err
	}
	keyword := map[string]string{"r": "TABLE", "v": "VIEW", "m": "MATERIALIZED VIEW"}[kind]
	statement := "DROP " + keyword + " " + engine.QuoteIdentifier(input.Schema) + "." + engine.QuoteIdentifier(input.Name)
	if input.Cascade && kind != "m" {
		statement += " CASCADE CONSTRAINTS"
	}
	return statement + ";", nil
}
