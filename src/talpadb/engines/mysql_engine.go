package talpadbEngines

import (
	"fmt"
	"errors"
	"context"
	"strings"
	"hash/fnv"
	"database/sql"

	_ "github.com/go-sql-driver/mysql"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

const mysqlDatabasesSql = `
SELECT COALESCE(
           NULLIF(DATABASE(), ''),
           (SELECT s.schema_name
            FROM information_schema.schemata s
            WHERE s.schema_name NOT IN ('information_schema', 'performance_schema', 'sys', 'mysql')
            ORDER BY s.schema_name
            LIMIT 1),
           'information_schema'
       ),
       COALESCE(CURRENT_USER(), ''),
       COALESCE(@@character_set_server, 'utf8mb4'),
       (SELECT CAST(COALESCE(SUM(t.data_length + t.index_length), 0) AS SIGNED)
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('information_schema', 'performance_schema', 'sys', 'mysql'))`

const mysqlSchemasSql = `
SELECT s.schema_name,
       s.default_character_set_name
FROM information_schema.schemata s
WHERE s.schema_name NOT IN ('information_schema', 'performance_schema', 'sys')
  AND (s.schema_name <> 'mysql' OR s.schema_name = COALESCE(DATABASE(), ''))
ORDER BY CASE WHEN s.schema_name = COALESCE(DATABASE(), '') THEN 0 ELSE 1 END, s.schema_name`

const mysqlRelationsSql = `
SELECT t.table_name,
       CASE WHEN t.table_type = 'VIEW' THEN 'v' ELSE 'r' END,
       CAST(COALESCE(t.table_rows, 0) AS SIGNED),
       CASE WHEN t.table_type = 'VIEW' AND t.table_comment = 'VIEW' THEN NULL ELSE NULLIF(t.table_comment, '') END
FROM information_schema.tables t
WHERE t.table_schema = ?
  AND t.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY t.table_name`

const mysqlRoutinesSql = `
SELECT r.routine_name,
       r.routine_type,
       COALESCE(r.dtd_identifier, '')
FROM information_schema.routines r
WHERE r.routine_schema = ?
  AND r.routine_type IN ('FUNCTION', 'PROCEDURE')
ORDER BY r.routine_name, r.routine_type`

const mysqlColumnsSql = `
SELECT CAST(c.ordinal_position AS UNSIGNED),
       c.column_name,
       c.column_type,
       c.is_nullable = 'NO',
       c.column_default,
       c.extra,
       c.collation_name,
       NULLIF(c.column_comment, ''),
       EXISTS (
           SELECT 1
           FROM information_schema.key_column_usage k
           WHERE k.table_schema = c.table_schema
             AND k.table_name = c.table_name
             AND k.column_name = c.column_name
             AND k.constraint_name = 'PRIMARY'
       ),
       EXISTS (
           SELECT 1
           FROM information_schema.key_column_usage k
           WHERE k.table_schema = c.table_schema
             AND k.table_name = c.table_name
             AND k.column_name = c.column_name
             AND k.referenced_table_name IS NOT NULL
       )
FROM information_schema.columns c
WHERE c.table_schema = ? AND c.table_name = ?
ORDER BY c.ordinal_position`

const mysqlTableSummarySql = `
SELECT CASE WHEN t.table_type = 'VIEW' THEN 'v' ELSE 'r' END,
       CAST(COALESCE(t.table_rows, 0) AS SIGNED),
       CAST(COALESCE(t.data_length, 0) AS SIGNED),
       CAST(COALESCE(t.index_length, 0) AS SIGNED),
       CASE WHEN t.table_type = 'VIEW' AND t.table_comment = 'VIEW' THEN NULL ELSE NULLIF(t.table_comment, '') END
FROM information_schema.tables t
WHERE t.table_schema = ? AND t.table_name = ?`

const mysqlIndexesSql = `
SELECT s.index_name,
       s.non_unique = 0,
       s.index_type,
       GROUP_CONCAT(
           CONCAT(
               '` + "`" + `', REPLACE(s.column_name, '` + "`" + `', '` + "``" + `'), '` + "`" + `',
               CASE WHEN s.collation = 'D' THEN ' DESC' ELSE '' END
           )
           ORDER BY s.seq_in_index
           SEPARATOR ', '
       ),
       EXISTS (
           SELECT 1
           FROM information_schema.table_constraints tc
           WHERE tc.table_schema = s.table_schema
             AND tc.table_name = s.table_name
             AND tc.constraint_name = s.index_name
             AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
       )
FROM information_schema.statistics s
WHERE s.table_schema = ? AND s.table_name = ?
GROUP BY s.table_schema, s.table_name, s.index_name, s.non_unique, s.index_type
ORDER BY CASE WHEN s.index_name = 'PRIMARY' THEN 0 ELSE 1 END, s.index_name`

const mysqlKeyConstraintsSql = `
SELECT tc.constraint_name,
       tc.constraint_type,
       GROUP_CONCAT(
           CONCAT('` + "`" + `', REPLACE(kcu.column_name, '` + "`" + `', '` + "``" + `'), '` + "`" + `')
           ORDER BY kcu.ordinal_position
           SEPARATOR ', '
       ),
       COALESCE(MAX(kcu.referenced_table_schema), ''),
       COALESCE(MAX(kcu.referenced_table_name), ''),
       COALESCE(GROUP_CONCAT(
           CASE WHEN kcu.referenced_column_name IS NOT NULL
                THEN CONCAT('` + "`" + `', REPLACE(kcu.referenced_column_name, '` + "`" + `', '` + "``" + `'), '` + "`" + `')
           END
           ORDER BY kcu.ordinal_position
           SEPARATOR ', '
       ), ''),
       COALESCE(MAX(rc.delete_rule), ''),
       COALESCE(MAX(rc.update_rule), '')
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.table_name = tc.table_name
 AND kcu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.table_name = tc.table_name
 AND rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = ? AND tc.table_name = ?
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY CASE tc.constraint_type WHEN 'PRIMARY KEY' THEN 0 WHEN 'UNIQUE' THEN 1 ELSE 2 END, tc.constraint_name`

const mysqlCheckConstraintsSql = `
SELECT tc.constraint_name,
       cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON cc.constraint_schema = tc.constraint_schema
 AND cc.constraint_name = tc.constraint_name
WHERE tc.table_schema = ? AND tc.table_name = ?
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.constraint_name`

const mysqlTriggersSql = `
SELECT tr.trigger_name,
       tr.action_timing,
       tr.event_manipulation,
       tr.action_statement
FROM information_schema.triggers tr
WHERE tr.event_object_schema = ? AND tr.event_object_table = ?
ORDER BY tr.trigger_name`

const mysqlCompletionSql = `
SELECT c.table_schema,
       c.table_name,
       c.column_name
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema
 AND t.table_name = c.table_name
WHERE c.table_schema NOT IN ('information_schema', 'performance_schema', 'sys')
  AND (c.table_schema <> 'mysql' OR c.table_schema = COALESCE(DATABASE(), ''))
  AND t.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY c.table_schema, c.table_name, c.ordinal_position`

const mysqlEditableColumnsSql = `
SELECT CAST(c.ordinal_position AS UNSIGNED),
       c.column_name,
       COALESCE((
           SELECT CAST(k.ordinal_position AS UNSIGNED)
           FROM information_schema.key_column_usage k
           WHERE k.table_schema = c.table_schema
             AND k.table_name = c.table_name
             AND k.column_name = c.column_name
             AND k.constraint_name = 'PRIMARY'
           LIMIT 1
       ), 0)
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema
 AND t.table_name = c.table_name
WHERE c.table_schema = ? AND c.table_name = ?
  AND t.table_type = 'BASE TABLE'
ORDER BY c.ordinal_position`

const mysqlDiagramTablesSql = `
SELECT t.table_schema,
       t.table_name,
       NULLIF(t.table_comment, '')
FROM information_schema.tables t
WHERE t.table_type = 'BASE TABLE'
  AND t.table_schema NOT IN ('information_schema', 'performance_schema', 'sys')
  AND (t.table_schema <> 'mysql' OR t.table_schema = COALESCE(DATABASE(), ''))
  AND (? = '' OR t.table_schema = ?)
ORDER BY t.table_schema, t.table_name
LIMIT 401`

const mysqlDiagramColumnsSql = `
SELECT c.table_schema,
       c.table_name,
       c.column_name,
       c.column_type,
       c.is_nullable = 'NO',
       EXISTS (
           SELECT 1
           FROM information_schema.key_column_usage k
           WHERE k.table_schema = c.table_schema
             AND k.table_name = c.table_name
             AND k.column_name = c.column_name
             AND k.constraint_name = 'PRIMARY'
       ),
       EXISTS (
           SELECT 1
           FROM information_schema.key_column_usage k
           WHERE k.table_schema = c.table_schema
             AND k.table_name = c.table_name
             AND k.column_name = c.column_name
             AND k.referenced_table_name IS NOT NULL
       ),
       EXISTS (
           SELECT 1
           FROM information_schema.statistics s
           WHERE s.table_schema = c.table_schema
             AND s.table_name = c.table_name
             AND s.non_unique = 0
             AND s.index_name <> 'PRIMARY'
           GROUP BY s.index_name
           HAVING COUNT(*) = 1 AND MAX(s.column_name) = c.column_name
       )
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema
 AND t.table_name = c.table_name
WHERE t.table_type = 'BASE TABLE'
  AND c.table_schema NOT IN ('information_schema', 'performance_schema', 'sys')
  AND (c.table_schema <> 'mysql' OR c.table_schema = COALESCE(DATABASE(), ''))
  AND (? = '' OR c.table_schema = ?)
ORDER BY c.table_schema, c.table_name, c.ordinal_position`

const mysqlDiagramRelationsSql = `
SELECT k.constraint_name,
       k.table_schema,
       k.table_name,
       k.referenced_table_schema,
       k.referenced_table_name,
       k.column_name,
       k.referenced_column_name
FROM information_schema.key_column_usage k
WHERE k.referenced_table_name IS NOT NULL
  AND k.table_schema NOT IN ('information_schema', 'performance_schema', 'sys')
  AND (? = '' OR k.table_schema = ? OR k.referenced_table_schema = ?)
ORDER BY k.table_schema, k.table_name, k.constraint_name, k.ordinal_position`

type MysqlEngine struct{}

func (engine *MysqlEngine) Name() string {
	return talpadbFunctions.EngineMysql
}

func (engine *MysqlEngine) Label() string {
	return "MySQL"
}

func (engine *MysqlEngine) DriverName() string {
	return "mysql"
}

func (engine *MysqlEngine) DefaultPort() int64 {
	return 3306
}

func (engine *MysqlEngine) DateOnlyAtMidnight() bool {
	return false
}

func (engine *MysqlEngine) DataSourceName(params talpadbFunctions.ConnectionParams) (string, error) {
	return talpadbFunctions.BuildMysqlConnectionString(params), nil
}

func (engine *MysqlEngine) PrepareSession(_ context.Context, _ Querier) error {
	return nil
}

func (engine *MysqlEngine) ServerVersion(ctx context.Context, db Querier) (string, error) {
	var version string
	err := db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version)
	return strings.TrimSpace(version), err
}

func (engine *MysqlEngine) DefaultSchema(ctx context.Context, db Querier) (string, error) {
	var schema string
	err := db.QueryRowContext(ctx, `
SELECT COALESCE(
    NULLIF(DATABASE(), ''),
    (SELECT s.schema_name
     FROM information_schema.schemata s
     WHERE s.schema_name NOT IN ('information_schema', 'performance_schema', 'sys', 'mysql')
     ORDER BY s.schema_name
     LIMIT 1),
    ''
)`).Scan(&schema)
	return schema, err
}

func (engine *MysqlEngine) QuoteIdentifier(name string) string {
	return "`" + strings.ReplaceAll(name, "`", "``") + "`"
}

func (engine *MysqlEngine) quoteSimple(name string) string {
	return quoteIfNeeded(name, engine.QuoteIdentifier, false)
}

func (engine *MysqlEngine) Placeholder(_ int) string {
	return "?"
}

func (engine *MysqlEngine) NormalizeIdentifier(name string, _ bool) string {
	return name
}

func (engine *MysqlEngine) SplitStatements(script string) []Statement {
	return splitStatements(script, mysqlDialect)
}

func (engine *MysqlEngine) DefaultValuesInsert(_ string) string {
	return " () VALUES ()"
}

func (engine *MysqlEngine) TransactionState(statement Statement, inTransaction bool) bool {
	switch statement.Keyword {
	case "BEGIN", "START", "SAVEPOINT":
		return true
	case "COMMIT", "ROLLBACK":
		words := statement.LeadingWords(3)
		if len(words) >= 2 && words[1] == "TO" {
			return inTransaction
		}
		return false
	}
	return inTransaction
}

func (engine *MysqlEngine) ListDatabases(ctx context.Context, db Querier, params talpadbFunctions.ConnectionParams) ([]talpadbDtos.DatabaseDto, error) {
	var name, owner, encoding string
	var sizeBytes sql.NullInt64
	if err := db.QueryRowContext(ctx, mysqlDatabasesSql).Scan(&name, &owner, &encoding, &sizeBytes); err != nil {
		return nil, err
	}
	if strings.TrimSpace(params.Database) != "" {
		name = strings.TrimSpace(params.Database)
	}
	var totalSize *int64
	if sizeBytes.Valid {
		value := sizeBytes.Int64
		totalSize = &value
	}
	return []talpadbDtos.DatabaseDto{{
		Name:         name,
		Owner:        owner,
		Encoding:     encoding,
		SizeBytes:    totalSize,
		AllowConnect: true,
	}}, nil
}

func (engine *MysqlEngine) ListSchemas(ctx context.Context, db Querier) ([]talpadbDtos.SchemaDto, error) {
	rows, err := db.QueryContext(ctx, mysqlSchemasSql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	schemas := []talpadbDtos.SchemaDto{}
	for rows.Next() {
		var name, charset string
		if err := rows.Scan(&name, &charset); err != nil {
			return nil, err
		}
		schemas = append(schemas, talpadbDtos.SchemaDto{Name: name})
	}
	return schemas, rows.Err()
}

func (engine *MysqlEngine) ListSchemaObjects(ctx context.Context, db Querier, schema string) (*talpadbDtos.SchemaObjectsDto, error) {
	objects := emptySchemaObjects()

	relationRows, err := db.QueryContext(ctx, mysqlRelationsSql, schema)
	if err != nil {
		return nil, err
	}
	defer relationRows.Close()

	for relationRows.Next() {
		var relation talpadbDtos.RelationDto
		var comment sql.NullString
		if err := relationRows.Scan(&relation.Name, &relation.Kind, &relation.EstimatedRows, &comment); err != nil {
			return nil, err
		}
		relation.Comment = nullableString(comment)
		if relation.Kind == "v" {
			objects.Views = append(objects.Views, relation)
		} else {
			objects.Tables = append(objects.Tables, relation)
		}
	}
	if err := relationRows.Err(); err != nil {
		return nil, err
	}

	routineRows, err := db.QueryContext(ctx, mysqlRoutinesSql, schema)
	if err != nil {
		return nil, err
	}
	defer routineRows.Close()

	for routineRows.Next() {
		var name, routineType, returnType string
		if err := routineRows.Scan(&name, &routineType, &returnType); err != nil {
			return nil, err
		}
		kind := "f"
		resultType := strings.ToLower(returnType)
		if strings.EqualFold(routineType, "PROCEDURE") {
			kind = "p"
			resultType = "procedure"
		}
		objects.Functions = append(objects.Functions, talpadbDtos.FunctionDto{
			Name:       name,
			Kind:       kind,
			ResultType: resultType,
			Oid:        mysqlRoutineOid(routineType, name),
		})
	}
	return objects, routineRows.Err()
}

func (engine *MysqlEngine) ListColumns(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.ColumnDto, error) {
	rows, err := db.QueryContext(ctx, mysqlColumnsSql, schema, relation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := []talpadbDtos.ColumnDto{}
	for rows.Next() {
		var column talpadbDtos.ColumnDto
		var defaultValue, collation, comment sql.NullString
		var extra string
		if err := rows.Scan(
			&column.Position,
			&column.Name,
			&column.DataType,
			&column.NotNull,
			&defaultValue,
			&extra,
			&collation,
			&comment,
			&column.IsPrimaryKey,
			&column.IsForeignKey,
		); err != nil {
			return nil, err
		}
		column.QuotedName = engine.quoteSimple(column.Name)
		column.DefaultValue = nullableString(defaultValue)
		column.Collation = nullableString(collation)
		column.Comment = nullableString(comment)
		lowerExtra := strings.ToLower(extra)
		if strings.Contains(lowerExtra, "auto_increment") {
			column.Identity = "d"
		}
		if strings.Contains(lowerExtra, "generated") {
			column.Generated = "s"
		}
		columns = append(columns, column)
	}
	return columns, rows.Err()
}

func (engine *MysqlEngine) TableDetails(ctx context.Context, db Querier, schema string, relation string) (*talpadbDtos.TableDetailsDto, error) {
	var kind string
	var estimatedRows, tableSize, indexSize int64
	var comment sql.NullString
	err := db.QueryRowContext(ctx, mysqlTableSummarySql, schema, relation).Scan(
		&kind,
		&estimatedRows,
		&tableSize,
		&indexSize,
		&comment,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("objeto %s.%s não encontrado", schema, relation)
	}
	if err != nil {
		return nil, err
	}

	details := emptyTableDetails(schema, relation, kind)
	details.EstimatedRows = estimatedRows
	details.TableSizeBytes = tableSize
	details.IndexSizeBytes = indexSize
	details.TotalSizeBytes = tableSize + indexSize
	details.Comment = nullableString(comment)

	columns, err := engine.ListColumns(ctx, db, schema, relation)
	if err != nil {
		return nil, err
	}
	details.Columns = columns

	if kind == "r" {
		indexes, err := engine.tableIndexes(ctx, db, schema, relation)
		if err != nil {
			return nil, err
		}
		details.Indexes = indexes

		constraints, err := engine.tableConstraints(ctx, db, schema, relation)
		if err != nil {
			return nil, err
		}
		details.Constraints = constraints
	}

	triggers, err := engine.tableTriggers(ctx, db, schema, relation)
	if err != nil {
		return nil, err
	}
	details.Triggers = triggers

	ddl, err := engine.relationDdl(ctx, db, schema, relation, kind, triggers)
	if err != nil {
		return nil, err
	}
	details.Ddl = ddl
	return details, nil
}

func (engine *MysqlEngine) tableIndexes(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.IndexDto, error) {
	rows, err := db.QueryContext(ctx, mysqlIndexesSql, schema, relation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	qualifiedTable := engine.QuoteIdentifier(schema) + "." + engine.QuoteIdentifier(relation)
	indexes := []talpadbDtos.IndexDto{}
	for rows.Next() {
		var name, indexType, columns string
		var isUnique, constraintBacked bool
		if err := rows.Scan(&name, &isUnique, &indexType, &columns, &constraintBacked); err != nil {
			return nil, err
		}
		isPrimary := name == "PRIMARY"
		quotedName := engine.quoteSimple(name)
		definition := fmt.Sprintf("CREATE INDEX %s ON %s (%s)", quotedName, qualifiedTable, columns)
		if isPrimary {
			definition = fmt.Sprintf("PRIMARY KEY (%s)", columns)
		} else if isUnique {
			definition = fmt.Sprintf("CREATE UNIQUE INDEX %s ON %s (%s)", quotedName, qualifiedTable, columns)
		}
		indexes = append(indexes, talpadbDtos.IndexDto{
			Name:             name,
			QuotedName:       quotedName,
			Definition:       definition,
			IsUnique:         isUnique,
			IsPrimary:        isPrimary,
			ConstraintBacked: isPrimary || constraintBacked,
		})
	}
	return indexes, rows.Err()
}

func (engine *MysqlEngine) tableConstraints(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.ConstraintDto, error) {
	rows, err := db.QueryContext(ctx, mysqlKeyConstraintsSql, schema, relation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	constraints := []talpadbDtos.ConstraintDto{}
	for rows.Next() {
		var name, constraintType, columns, refSchema, refTable, refColumns, deleteRule, updateRule string
		if err := rows.Scan(&name, &constraintType, &columns, &refSchema, &refTable, &refColumns, &deleteRule, &updateRule); err != nil {
			return nil, err
		}
		code := "u"
		definition := fmt.Sprintf("UNIQUE (%s)", columns)
		switch constraintType {
		case "PRIMARY KEY":
			code = "p"
			definition = fmt.Sprintf("PRIMARY KEY (%s)", columns)
		case "FOREIGN KEY":
			code = "f"
			target := engine.quoteSimple(refTable)
			if refSchema != "" && refSchema != schema {
				target = engine.quoteSimple(refSchema) + "." + target
			}
			definition = fmt.Sprintf("FOREIGN KEY (%s) REFERENCES %s (%s)", columns, target, refColumns)
			if deleteRule != "" && deleteRule != "RESTRICT" && deleteRule != "NO ACTION" {
				definition += " ON DELETE " + deleteRule
			}
			if updateRule != "" && updateRule != "RESTRICT" && updateRule != "NO ACTION" {
				definition += " ON UPDATE " + updateRule
			}
		}
		constraints = append(constraints, talpadbDtos.ConstraintDto{
			Name:       name,
			QuotedName: engine.quoteSimple(name),
			Type:       code,
			Definition: definition,
			IsLocal:    true,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	checkRows, err := db.QueryContext(ctx, mysqlCheckConstraintsSql, schema, relation)
	if err == nil {
		defer checkRows.Close()
		for checkRows.Next() {
			var name, clause string
			if err := checkRows.Scan(&name, &clause); err != nil {
				break
			}
			constraints = append(constraints, talpadbDtos.ConstraintDto{
				Name:       name,
				QuotedName: engine.quoteSimple(name),
				Type:       "c",
				Definition: fmt.Sprintf("CHECK (%s)", clause),
				IsLocal:    true,
			})
		}
	}
	return constraints, nil
}

func (engine *MysqlEngine) tableTriggers(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.TriggerDto, error) {
	rows, err := db.QueryContext(ctx, mysqlTriggersSql, schema, relation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	qualifiedTable := engine.QuoteIdentifier(schema) + "." + engine.QuoteIdentifier(relation)
	triggers := []talpadbDtos.TriggerDto{}
	for rows.Next() {
		var name, timing, manipulation, statement string
		if err := rows.Scan(&name, &timing, &manipulation, &statement); err != nil {
			return nil, err
		}
		definition := fmt.Sprintf(
			"CREATE TRIGGER %s %s %s ON %s FOR EACH ROW %s",
			engine.quoteSimple(name),
			timing,
			manipulation,
			qualifiedTable,
			statement,
		)
		triggers = append(triggers, talpadbDtos.TriggerDto{
			Name:       name,
			Definition: definition,
			Enabled:    true,
		})
	}
	return triggers, rows.Err()
}

func (engine *MysqlEngine) relationDdl(ctx context.Context, db Querier, schema string, relation string, kind string, triggers []talpadbDtos.TriggerDto) (string, error) {
	qualified := engine.QuoteIdentifier(schema) + "." + engine.QuoteIdentifier(relation)
	command := "SHOW CREATE TABLE " + qualified
	if kind == "v" {
		command = "SHOW CREATE VIEW " + qualified
	}
	statement, err := readShowCreate(ctx, db, command, 1)
	if err != nil {
		return "", err
	}
	parts := []string{ensureSemicolon(statement)}
	for _, trigger := range triggers {
		parts = append(parts, ensureSemicolon(trigger.Definition))
	}
	return strings.Join(parts, "\n\n"), nil
}

func (engine *MysqlEngine) ObjectDdl(ctx context.Context, db Querier, object talpadbDtos.ObjectReferenceDto) (string, error) {
	switch object.Kind {
	case "table", "view":
		details, err := engine.TableDetails(ctx, db, object.Schema, object.Name)
		if err != nil {
			return "", err
		}
		return details.Ddl, nil
	case "function":
		return engine.routineDdl(ctx, db, object)
	case "schema":
		statement, err := readShowCreate(ctx, db, "SHOW CREATE DATABASE "+engine.QuoteIdentifier(object.Name), 1)
		if err != nil {
			return "", err
		}
		return ensureSemicolon(statement), nil
	}
	return "", ErrUnsupported
}

func (engine *MysqlEngine) routineDdl(ctx context.Context, db Querier, object talpadbDtos.ObjectReferenceDto) (string, error) {
	rows, err := db.QueryContext(ctx, `
SELECT r.routine_type
FROM information_schema.routines r
WHERE r.routine_schema = ? AND r.routine_name = ?
ORDER BY r.routine_type`, object.Schema, object.Name)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	selectedType := ""
	for rows.Next() {
		var routineType string
		if err := rows.Scan(&routineType); err != nil {
			return "", err
		}
		if selectedType == "" || mysqlRoutineOid(routineType, object.Name) == object.Oid {
			selectedType = strings.ToUpper(routineType)
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	if selectedType != "FUNCTION" && selectedType != "PROCEDURE" {
		return "", fmt.Errorf("rotina %s.%s não encontrada", object.Schema, object.Name)
	}

	qualified := engine.QuoteIdentifier(object.Schema) + "." + engine.QuoteIdentifier(object.Name)
	statement, err := readShowCreate(ctx, db, fmt.Sprintf("SHOW CREATE %s %s", selectedType, qualified), 2)
	if err != nil {
		return "", err
	}
	return ensureSemicolon(statement), nil
}

func (engine *MysqlEngine) CompletionSchema(ctx context.Context, db Querier) ([]talpadbDtos.CompletionTableDto, error) {
	rows, err := db.QueryContext(ctx, mysqlCompletionSql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := []talpadbDtos.CompletionTableDto{}
	indexByKey := map[string]int{}
	for rows.Next() {
		var schema, table, column string
		if err := rows.Scan(&schema, &table, &column); err != nil {
			return nil, err
		}
		key := schema + "\x00" + table
		index, exists := indexByKey[key]
		if !exists {
			if len(tables) >= 5000 {
				break
			}
			index = len(tables)
			indexByKey[key] = index
			tables = append(tables, talpadbDtos.CompletionTableDto{
				Schema:  schema,
				Name:    table,
				Columns: []string{},
			})
		}
		tables[index].Columns = append(tables[index].Columns, column)
	}
	return tables, rows.Err()
}

func (engine *MysqlEngine) Diagram(ctx context.Context, db Querier, schema string) (*talpadbDtos.DatabaseDiagramDto, error) {
	tableRows, err := db.QueryContext(ctx, mysqlDiagramTablesSql, schema, schema)
	if err != nil {
		return nil, err
	}
	defer tableRows.Close()

	diagram := &talpadbDtos.DatabaseDiagramDto{
		Tables:    []talpadbDtos.DiagramTableDto{},
		Relations: []talpadbDtos.DiagramRelationDto{},
	}
	indexByKey := map[string]int{}
	for tableRows.Next() {
		var tableSchema, tableName string
		var comment sql.NullString
		if err := tableRows.Scan(&tableSchema, &tableName, &comment); err != nil {
			return nil, err
		}
		if len(diagram.Tables) >= MaxDiagramTables {
			diagram.Truncated = true
			continue
		}
		key := tableSchema + "\x00" + tableName
		indexByKey[key] = len(diagram.Tables)
		diagram.Tables = append(diagram.Tables, talpadbDtos.DiagramTableDto{
			Kind:    "r",
			Name:    tableName,
			Schema:  tableSchema,
			Comment: nullableString(comment),
			Columns: []talpadbDtos.DiagramColumnDto{},
		})
	}
	if err := tableRows.Err(); err != nil || len(diagram.Tables) == 0 {
		return diagram, err
	}

	columnRows, err := db.QueryContext(ctx, mysqlDiagramColumnsSql, schema, schema)
	if err != nil {
		return nil, err
	}
	defer columnRows.Close()

	for columnRows.Next() {
		var tableSchema, tableName string
		var column talpadbDtos.DiagramColumnDto
		if err := columnRows.Scan(
			&tableSchema,
			&tableName,
			&column.Name,
			&column.DataType,
			&column.NotNull,
			&column.IsPrimaryKey,
			&column.IsForeignKey,
			&column.IsUnique,
		); err != nil {
			return nil, err
		}
		if index, exists := indexByKey[tableSchema+"\x00"+tableName]; exists {
			diagram.Tables[index].Columns = append(diagram.Tables[index].Columns, column)
		}
	}
	if err := columnRows.Err(); err != nil {
		return nil, err
	}

	relationRows, err := db.QueryContext(ctx, mysqlDiagramRelationsSql, schema, schema, schema)
	if err != nil {
		return nil, err
	}
	defer relationRows.Close()

	relationIndexByKey := map[string]int{}
	for relationRows.Next() {
		var name, sourceSchema, sourceTable, targetSchema, targetTable, sourceColumn, targetColumn string
		if err := relationRows.Scan(&name, &sourceSchema, &sourceTable, &targetSchema, &targetTable, &sourceColumn, &targetColumn); err != nil {
			return nil, err
		}
		_, hasSource := indexByKey[sourceSchema+"\x00"+sourceTable]
		_, hasTarget := indexByKey[targetSchema+"\x00"+targetTable]
		if !hasSource || !hasTarget {
			continue
		}
		key := sourceSchema + "\x00" + sourceTable + "\x00" + name
		index, exists := relationIndexByKey[key]
		if !exists {
			index = len(diagram.Relations)
			relationIndexByKey[key] = index
			diagram.Relations = append(diagram.Relations, talpadbDtos.DiagramRelationDto{
				Name:          name,
				SourceSchema:  sourceSchema,
				SourceTable:   sourceTable,
				TargetSchema:  targetSchema,
				TargetTable:   targetTable,
				SourceColumns: []string{},
				TargetColumns: []string{},
			})
		}
		diagram.Relations[index].SourceColumns = append(diagram.Relations[index].SourceColumns, sourceColumn)
		diagram.Relations[index].TargetColumns = append(diagram.Relations[index].TargetColumns, targetColumn)
	}
	return diagram, relationRows.Err()
}

func (engine *MysqlEngine) TableColumns(ctx context.Context, db Querier, schema string, table string) ([]TableColumn, error) {
	rows, err := db.QueryContext(ctx, mysqlEditableColumnsSql, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := []TableColumn{}
	for rows.Next() {
		var column TableColumn
		if err := rows.Scan(&column.Position, &column.Name, &column.KeyOrder); err != nil {
			return nil, err
		}
		column.QuotedName = engine.QuoteIdentifier(column.Name)
		columns = append(columns, column)
	}
	return columns, rows.Err()
}

func (engine *MysqlEngine) DropStatement(ctx context.Context, db Querier, input talpadbDtos.DropObjectInputDto) (string, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return "", errors.New("informe o objeto a excluir")
	}

	switch input.Kind {
	case "schema", "database":
		return "DROP DATABASE " + engine.QuoteIdentifier(name) + ";", nil
	case "relation":
		var tableType string
		err := db.QueryRowContext(ctx, `
SELECT t.table_type
FROM information_schema.tables t
WHERE t.table_schema = ? AND t.table_name = ?`, input.Schema, name).Scan(&tableType)
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("objeto %s.%s não encontrado", input.Schema, name)
		}
		if err != nil {
			return "", err
		}
		keyword := "TABLE"
		if tableType == "VIEW" {
			keyword = "VIEW"
		}
		qualified := engine.QuoteIdentifier(input.Schema) + "." + engine.QuoteIdentifier(name)
		return fmt.Sprintf("DROP %s %s;", keyword, qualified), nil
	}
	return "", ErrUnsupported
}

func readShowCreate(ctx context.Context, db Querier, query string, columnIndex int) (string, error) {
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return "", err
	}
	if columnIndex >= len(columns) {
		return "", fmt.Errorf("resposta inesperada para %s", query)
	}
	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return "", err
		}
		return "", sql.ErrNoRows
	}
	values := make([]sql.NullString, len(columns))
	targets := make([]any, len(columns))
	for index := range values {
		targets[index] = &values[index]
	}
	if err := rows.Scan(targets...); err != nil {
		return "", err
	}
	return strings.TrimSpace(values[columnIndex].String), rows.Err()
}

func ensureSemicolon(statement string) string {
	trimmed := strings.TrimSpace(statement)
	if trimmed == "" || strings.HasSuffix(trimmed, ";") {
		return trimmed
	}
	return trimmed + ";"
}

func mysqlRoutineOid(routineType string, name string) uint32 {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(strings.ToUpper(routineType) + ":" + name))
	return hasher.Sum32()
}

