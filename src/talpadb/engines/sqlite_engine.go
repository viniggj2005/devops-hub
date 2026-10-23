package talpadbEngines

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sort"
	"strings"

	_ "github.com/glebarez/go-sqlite"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

type SqliteEngine struct{}

type sqliteForeignKey struct {
	table         string
	onDelete      string
	onUpdate      string
	sourceColumns []string
	targetColumns []string
}

type sqliteIndex struct {
	name    string
	origin  string
	unique  bool
	partial bool
}

func (engine *SqliteEngine) Name() string { return talpadbFunctions.EngineSqlite }

func (engine *SqliteEngine) Label() string { return "SQLite" }

func (engine *SqliteEngine) DriverName() string { return "sqlite" }

func (engine *SqliteEngine) DefaultPort() int64 { return 0 }

func (engine *SqliteEngine) DateOnlyAtMidnight() bool { return true }

func (engine *SqliteEngine) DataSourceName(params talpadbFunctions.ConnectionParams) (string, error) {
	return talpadbFunctions.BuildSqliteConnectionString(params)
}

func (engine *SqliteEngine) PrepareSession(ctx context.Context, conn Querier) error { return nil }

func (engine *SqliteEngine) ServerVersion(ctx context.Context, db Querier) (string, error) {
	var version string
	err := db.QueryRowContext(ctx, "SELECT sqlite_version()").Scan(&version)
	return version, err
}

func (engine *SqliteEngine) DefaultSchema(ctx context.Context, db Querier) (string, error) {
	return "main", nil
}

func (engine *SqliteEngine) QuoteIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func (engine *SqliteEngine) Placeholder(position int) string { return "?" }

func (engine *SqliteEngine) NormalizeIdentifier(name string, quoted bool) string { return name }

func (engine *SqliteEngine) SplitStatements(script string) []Statement {
	return splitStatements(script, sqliteDialect)
}

func (engine *SqliteEngine) DefaultValuesInsert(firstColumn string) string { return " DEFAULT VALUES" }

func (engine *SqliteEngine) TransactionState(statement Statement, inTransaction bool) bool {
	switch statement.Keyword {
	case "BEGIN", "SAVEPOINT":
		return true
	case "COMMIT", "END":
		return false
	case "ROLLBACK":
		for _, word := range statement.LeadingWords(3)[1:] {
			if word == "TO" {
				return inTransaction
			}
		}
		return false
	}
	return inTransaction
}

func (engine *SqliteEngine) displayName(name string) string {
	return quoteIfNeeded(name, engine.QuoteIdentifier, false)
}

func (engine *SqliteEngine) qualified(schema string, name string) string {
	return engine.QuoteIdentifier(schema) + "." + engine.QuoteIdentifier(name)
}

func (engine *SqliteEngine) master(schema string) string {
	if schema == "temp" {
		return "temp.sqlite_master"
	}
	return engine.QuoteIdentifier(schema) + ".sqlite_master"
}

func (engine *SqliteEngine) schemaNames(ctx context.Context, db Querier) ([]string, error) {
	rows, err := db.QueryContext(ctx, "SELECT name FROM pragma_database_list WHERE name <> 'temp' ORDER BY seq")
	if err != nil {
		return nil, err
	}
	return scanStrings(rows)
}

func (engine *SqliteEngine) ListDatabases(ctx context.Context, db Querier, params talpadbFunctions.ConnectionParams) ([]talpadbDtos.DatabaseDto, error) {
	var encoding string
	if err := db.QueryRowContext(ctx, "PRAGMA encoding").Scan(&encoding); err != nil {
		return nil, err
	}
	path := params.Host
	database := talpadbDtos.DatabaseDto{Name: "main", Encoding: encoding, AllowConnect: true, Comment: &path}
	if info, err := os.Stat(path); err == nil {
		size := info.Size()
		database.SizeBytes = &size
	}
	return []talpadbDtos.DatabaseDto{database}, nil
}

func (engine *SqliteEngine) ListSchemas(ctx context.Context, db Querier) ([]talpadbDtos.SchemaDto, error) {
	rows, err := db.QueryContext(ctx, "SELECT name, file FROM pragma_database_list WHERE name <> 'temp' ORDER BY seq")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	schemas := []talpadbDtos.SchemaDto{}
	for rows.Next() {
		var name string
		var file sql.NullString
		if err := rows.Scan(&name, &file); err != nil {
			return nil, err
		}
		schemas = append(schemas, talpadbDtos.SchemaDto{Name: name, Comment: nullableString(file)})
	}
	return schemas, rows.Err()
}

func (engine *SqliteEngine) ListSchemaObjects(ctx context.Context, db Querier, schema string) (*talpadbDtos.SchemaObjectsDto, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf(
		"SELECT name, type FROM %s WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%%' ORDER BY name",
		engine.master(schema),
	))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	objects := emptySchemaObjects()
	for rows.Next() {
		var name, objectType string
		if err := rows.Scan(&name, &objectType); err != nil {
			return nil, err
		}
		if objectType == "view" {
			objects.Views = append(objects.Views, talpadbDtos.RelationDto{Name: name, Kind: "v"})
		} else {
			objects.Tables = append(objects.Tables, talpadbDtos.RelationDto{Name: name, Kind: "r"})
		}
	}
	return objects, rows.Err()
}

func (engine *SqliteEngine) foreignKeys(ctx context.Context, db Querier, schema string, table string) ([]sqliteForeignKey, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, "table", "from", "to", on_update, on_delete FROM pragma_foreign_key_list(?, ?) ORDER BY id, seq`, table, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	keys := []sqliteForeignKey{}
	lastID := -1
	for rows.Next() {
		var id int
		var target sql.NullString
		var targetTable, source, onUpdate, onDelete string
		if err := rows.Scan(&id, &targetTable, &source, &target, &onUpdate, &onDelete); err != nil {
			return nil, err
		}
		if id != lastID {
			keys = append(keys, sqliteForeignKey{table: targetTable, onUpdate: onUpdate, onDelete: onDelete})
			lastID = id
		}
		current := &keys[len(keys)-1]
		current.sourceColumns = append(current.sourceColumns, source)
		current.targetColumns = append(current.targetColumns, target.String)
	}
	return keys, rows.Err()
}

func (engine *SqliteEngine) indexes(ctx context.Context, db Querier, schema string, table string) ([]sqliteIndex, error) {
	rows, err := db.QueryContext(ctx, `SELECT name, "unique", origin, partial FROM pragma_index_list(?, ?) ORDER BY name`, table, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := []sqliteIndex{}
	for rows.Next() {
		var index sqliteIndex
		if err := rows.Scan(&index.name, &index.unique, &index.origin, &index.partial); err != nil {
			return nil, err
		}
		indexes = append(indexes, index)
	}
	return indexes, rows.Err()
}

func (engine *SqliteEngine) indexColumns(ctx context.Context, db Querier, schema string, index string) ([]string, error) {
	rows, err := db.QueryContext(ctx, "SELECT COALESCE(name, '<expressão>') FROM pragma_index_info(?, ?) ORDER BY seqno", index, schema)
	if err != nil {
		return nil, err
	}
	return scanStrings(rows)
}

func (engine *SqliteEngine) ListColumns(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.ColumnDto, error) {
	rows, err := db.QueryContext(ctx, `SELECT cid, name, type, "notnull", dflt_value, pk, hidden FROM pragma_table_xinfo(?, ?) ORDER BY cid`, relation, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := []talpadbDtos.ColumnDto{}
	primaryKeyCount := 0
	for rows.Next() {
		var cid, primaryKey, hidden int
		var notNull bool
		var defaultValue sql.NullString
		var name, dataType string
		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &primaryKey, &hidden); err != nil {
			return nil, err
		}
		if hidden == 1 {
			continue
		}
		column := talpadbDtos.ColumnDto{
			Position:     int16(cid + 1),
			Name:         name,
			NotNull:      notNull || primaryKey > 0,
			DataType:     strings.ToLower(dataType),
			QuotedName:   engine.displayName(name),
			IsPrimaryKey: primaryKey > 0,
			DefaultValue: nullableString(defaultValue),
		}
		switch hidden {
		case 2:
			column.Generated = "v"
		case 3:
			column.Generated = "s"
		}
		if primaryKey > 0 {
			primaryKeyCount++
		}
		columns = append(columns, column)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(columns) == 0 {
		return nil, fmt.Errorf("objeto %s.%s não encontrado", schema, relation)
	}

	if primaryKeyCount == 1 {
		for index := range columns {
			if columns[index].IsPrimaryKey && columns[index].DataType == "integer" {
				columns[index].Identity = "d"
			}
		}
	}

	keys, err := engine.foreignKeys(ctx, db, schema, relation)
	if err != nil {
		return nil, err
	}
	foreignColumns := map[string]bool{}
	for _, key := range keys {
		for _, column := range key.sourceColumns {
			foreignColumns[column] = true
		}
	}
	for index := range columns {
		columns[index].IsForeignKey = foreignColumns[columns[index].Name]
	}
	return columns, nil
}

func (engine *SqliteEngine) objectType(ctx context.Context, db Querier, schema string, name string) (string, error) {
	var objectType string
	err := db.QueryRowContext(ctx, fmt.Sprintf("SELECT type FROM %s WHERE name = ? AND type IN ('table', 'view')", engine.master(schema)), name).Scan(&objectType)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("objeto %s.%s não encontrado", schema, name)
	}
	return objectType, err
}

func (engine *SqliteEngine) definitions(ctx context.Context, db Querier, schema string, query string, args ...any) ([]string, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf(query, engine.master(schema)), args...)
	if err != nil {
		return nil, err
	}
	definitions, err := scanStrings(rows)
	if err != nil {
		return nil, err
	}
	filled := []string{}
	for _, definition := range definitions {
		if strings.TrimSpace(definition) != "" {
			filled = append(filled, definition)
		}
	}
	return filled, nil
}

func (engine *SqliteEngine) relationSizes(ctx context.Context, db Querier, schema string, table string) (int64, int64) {
	var tableSize, indexSize int64
	query := fmt.Sprintf(`SELECT COALESCE(SUM(CASE WHEN name = ? THEN pgsize END), 0),
       COALESCE(SUM(CASE WHEN name <> ? THEN pgsize END), 0)
FROM dbstat(?)
WHERE name = ? OR name IN (SELECT name FROM %s WHERE type = 'index' AND tbl_name = ?)`, engine.master(schema))
	if err := db.QueryRowContext(ctx, query, table, table, schema, table, table).Scan(&tableSize, &indexSize); err != nil {
		return 0, 0
	}
	return tableSize, indexSize
}

func describeReferentialAction(keyword string, action string) string {
	if action == "" || strings.EqualFold(action, "NO ACTION") {
		return ""
	}
	return " " + keyword + " " + action
}

func (engine *SqliteEngine) joinNames(names []string) string {
	display := make([]string, len(names))
	for index, name := range names {
		display[index] = engine.displayName(name)
	}
	return strings.Join(display, ", ")
}

func (engine *SqliteEngine) TableDetails(ctx context.Context, db Querier, schema string, relation string) (*talpadbDtos.TableDetailsDto, error) {
	objectType, err := engine.objectType(ctx, db, schema, relation)
	if err != nil {
		return nil, err
	}
	kind := "r"
	if objectType == "view" {
		kind = "v"
	}
	details := emptyTableDetails(schema, relation, kind)

	if details.Columns, err = engine.ListColumns(ctx, db, schema, relation); err != nil {
		return nil, err
	}

	if kind == "r" {
		if err := db.QueryRowContext(ctx, "SELECT count(*) FROM "+engine.qualified(schema, relation)).Scan(&details.EstimatedRows); err != nil {
			return nil, err
		}
		details.TableSizeBytes, details.IndexSizeBytes = engine.relationSizes(ctx, db, schema, relation)
		details.TotalSizeBytes = details.TableSizeBytes + details.IndexSizeBytes

		if err := engine.fillIndexesAndConstraints(ctx, db, details); err != nil {
			return nil, err
		}
	}

	triggerRows, err := db.QueryContext(ctx, fmt.Sprintf("SELECT name, COALESCE(sql, '') FROM %s WHERE type = 'trigger' AND tbl_name = ? ORDER BY name", engine.master(schema)), relation)
	if err != nil {
		return nil, err
	}
	defer triggerRows.Close()
	for triggerRows.Next() {
		trigger := talpadbDtos.TriggerDto{Enabled: true}
		if err := triggerRows.Scan(&trigger.Name, &trigger.Definition); err != nil {
			return nil, err
		}
		details.Triggers = append(details.Triggers, trigger)
	}
	if err := triggerRows.Err(); err != nil {
		return nil, err
	}

	if details.Ddl, err = engine.relationDdl(ctx, db, schema, relation); err != nil {
		return nil, err
	}
	return details, nil
}

func (engine *SqliteEngine) fillIndexesAndConstraints(ctx context.Context, db Querier, details *talpadbDtos.TableDetailsDto) error {
	schema, relation := details.Schema, details.Name

	primaryKeys := []talpadbDtos.ColumnDto{}
	for _, column := range details.Columns {
		if column.IsPrimaryKey {
			primaryKeys = append(primaryKeys, column)
		}
	}
	if len(primaryKeys) > 0 {
		names := make([]string, len(primaryKeys))
		for index, column := range primaryKeys {
			names[index] = column.Name
		}
		details.Constraints = append(details.Constraints, talpadbDtos.ConstraintDto{
			Name:       "PRIMARY KEY",
			Type:       "p",
			IsLocal:    true,
			Definition: "PRIMARY KEY (" + engine.joinNames(names) + ")",
		})
	}

	indexes, err := engine.indexes(ctx, db, schema, relation)
	if err != nil {
		return err
	}
	for _, index := range indexes {
		columns, err := engine.indexColumns(ctx, db, schema, index.name)
		if err != nil {
			return err
		}
		definition := ""
		if found, err := engine.definitions(ctx, db, schema, "SELECT COALESCE(sql, '') FROM %s WHERE type = 'index' AND name = ?", index.name); err == nil && len(found) > 0 {
			definition = found[0]
		}
		if definition == "" {
			definition = fmt.Sprintf("-- índice automático (%s) em (%s)", strings.ToUpper(index.origin), engine.joinNames(columns))
		}
		details.Indexes = append(details.Indexes, talpadbDtos.IndexDto{
			Name:             index.name,
			QuotedName:       engine.displayName(index.name),
			Definition:       definition,
			IsUnique:         index.unique,
			IsPrimary:        index.origin == "pk",
			ConstraintBacked: index.origin != "c",
		})
		if index.origin == "u" {
			details.Constraints = append(details.Constraints, talpadbDtos.ConstraintDto{
				Name:       index.name,
				Type:       "u",
				IsLocal:    true,
				Definition: "UNIQUE (" + engine.joinNames(columns) + ")",
			})
		}
	}

	keys, err := engine.foreignKeys(ctx, db, schema, relation)
	if err != nil {
		return err
	}
	for position, key := range keys {
		targets := key.targetColumns
		if strings.Join(targets, "") == "" {
			targets = nil
		}
		definition := fmt.Sprintf("FOREIGN KEY (%s) REFERENCES %s", engine.joinNames(key.sourceColumns), engine.displayName(key.table))
		if len(targets) > 0 {
			definition += " (" + engine.joinNames(targets) + ")"
		}
		definition += describeReferentialAction("ON DELETE", key.onDelete) + describeReferentialAction("ON UPDATE", key.onUpdate)
		details.Constraints = append(details.Constraints, talpadbDtos.ConstraintDto{
			Name:       fmt.Sprintf("FOREIGN KEY #%d", position+1),
			Type:       "f",
			IsLocal:    true,
			Definition: definition,
		})
	}
	return nil
}

func (engine *SqliteEngine) relationDdl(ctx context.Context, db Querier, schema string, relation string) (string, error) {
	statements, err := engine.definitions(ctx, db, schema, `SELECT COALESCE(sql, '') FROM %s
WHERE (name = ? AND type IN ('table', 'view')) OR (tbl_name = ? AND type IN ('index', 'trigger'))
ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name`, relation, relation)
	if err != nil {
		return "", err
	}
	var builder strings.Builder
	fmt.Fprintf(&builder, "-- %s: %s.%s\n\n", "SQLite", schema, relation)
	for _, statement := range statements {
		builder.WriteString(strings.TrimRight(strings.TrimSpace(statement), ";") + ";\n\n")
	}
	return strings.TrimRight(builder.String(), "\n") + "\n", nil
}

func (engine *SqliteEngine) ObjectDdl(ctx context.Context, db Querier, object talpadbDtos.ObjectReferenceDto) (string, error) {
	switch object.Kind {
	case "table", "view":
		if _, err := engine.objectType(ctx, db, object.Schema, object.Name); err != nil {
			return "", err
		}
		return engine.relationDdl(ctx, db, object.Schema, object.Name)
	case "schema":
		var file sql.NullString
		err := db.QueryRowContext(ctx, "SELECT file FROM pragma_database_list WHERE name = ?", object.Name).Scan(&file)
		if err != nil {
			return "", fmt.Errorf("schema %s não encontrado", object.Name)
		}
		return fmt.Sprintf("-- SCHEMA: %s\n\nATTACH DATABASE %s AS %s;\n", object.Name, talpadbFunctions.QuoteLiteral(file.String), engine.displayName(object.Name)), nil
	}
	return "", fmt.Errorf("tipo de objeto não suportado no SQLite: %s", object.Kind)
}

func (engine *SqliteEngine) CompletionSchema(ctx context.Context, db Querier) ([]talpadbDtos.CompletionTableDto, error) {
	schemas, err := engine.schemaNames(ctx, db)
	if err != nil {
		return nil, err
	}
	tables := []talpadbDtos.CompletionTableDto{}
	for _, schema := range schemas {
		rows, err := db.QueryContext(ctx, fmt.Sprintf(`SELECT m.name, p.name
FROM %s m
JOIN pragma_table_info(m.name, ?) p
WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite_%%'
ORDER BY m.name, p.cid`, engine.master(schema)), schema)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var table, column string
			if err := rows.Scan(&table, &column); err != nil {
				rows.Close()
				return nil, err
			}
			if len(tables) == 0 || tables[len(tables)-1].Name != table || tables[len(tables)-1].Schema != schema {
				tables = append(tables, talpadbDtos.CompletionTableDto{Schema: schema, Name: table, Columns: []string{}})
			}
			tables[len(tables)-1].Columns = append(tables[len(tables)-1].Columns, column)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}
	return tables, nil
}

func (engine *SqliteEngine) Diagram(ctx context.Context, db Querier, schema string) (*talpadbDtos.DatabaseDiagramDto, error) {
	schemas := []string{schema}
	if schema == "" {
		names, err := engine.schemaNames(ctx, db)
		if err != nil {
			return nil, err
		}
		schemas = names
	}

	diagram := &talpadbDtos.DatabaseDiagramDto{Tables: []talpadbDtos.DiagramTableDto{}, Relations: []talpadbDtos.DiagramRelationDto{}}
	tableSchemas := map[string]string{}
	for _, schemaName := range schemas {
		rows, err := db.QueryContext(ctx, fmt.Sprintf("SELECT name FROM %s WHERE type = 'table' AND name NOT LIKE 'sqlite_%%' ORDER BY name", engine.master(schemaName)))
		if err != nil {
			return nil, err
		}
		names, err := scanStrings(rows)
		if err != nil {
			return nil, err
		}
		for _, name := range names {
			if len(diagram.Tables) == MaxDiagramTables {
				diagram.Truncated = true
				break
			}
			table, err := engine.diagramTable(ctx, db, schemaName, name)
			if err != nil {
				return nil, err
			}
			tableSchemas[strings.ToLower(name)] = schemaName
			diagram.Tables = append(diagram.Tables, table)
		}
	}

	for _, table := range diagram.Tables {
		keys, err := engine.foreignKeys(ctx, db, table.Schema, table.Name)
		if err != nil {
			return nil, err
		}
		for position, key := range keys {
			targetSchema, exists := tableSchemas[strings.ToLower(key.table)]
			if !exists {
				continue
			}
			targets := key.targetColumns
			if strings.Join(targets, "") == "" {
				targets = primaryKeyNames(diagram.Tables, targetSchema, key.table)
			}
			diagram.Relations = append(diagram.Relations, talpadbDtos.DiagramRelationDto{
				Name:          fmt.Sprintf("fk_%s_%d", table.Name, position+1),
				SourceSchema:  table.Schema,
				SourceTable:   table.Name,
				TargetSchema:  targetSchema,
				TargetTable:   canonicalTableName(diagram.Tables, targetSchema, key.table),
				SourceColumns: key.sourceColumns,
				TargetColumns: targets,
			})
		}
	}
	return diagram, nil
}

func canonicalTableName(tables []talpadbDtos.DiagramTableDto, schema string, name string) string {
	for _, table := range tables {
		if table.Schema == schema && strings.EqualFold(table.Name, name) {
			return table.Name
		}
	}
	return name
}

func primaryKeyNames(tables []talpadbDtos.DiagramTableDto, schema string, name string) []string {
	names := []string{}
	for _, table := range tables {
		if table.Schema != schema || !strings.EqualFold(table.Name, name) {
			continue
		}
		for _, column := range table.Columns {
			if column.IsPrimaryKey {
				names = append(names, column.Name)
			}
		}
	}
	return names
}

func (engine *SqliteEngine) diagramTable(ctx context.Context, db Querier, schema string, name string) (talpadbDtos.DiagramTableDto, error) {
	table := talpadbDtos.DiagramTableDto{Name: name, Kind: "r", Schema: schema, Columns: []talpadbDtos.DiagramColumnDto{}}
	columns, err := engine.ListColumns(ctx, db, schema, name)
	if err != nil {
		return table, err
	}
	indexes, err := engine.indexes(ctx, db, schema, name)
	if err != nil {
		return table, err
	}
	uniqueColumns := map[string]bool{}
	for _, index := range indexes {
		if !index.unique || index.partial || index.origin == "pk" {
			continue
		}
		indexColumns, err := engine.indexColumns(ctx, db, schema, index.name)
		if err == nil && len(indexColumns) == 1 {
			uniqueColumns[indexColumns[0]] = true
		}
	}
	for _, column := range columns {
		table.Columns = append(table.Columns, talpadbDtos.DiagramColumnDto{
			Name:         column.Name,
			NotNull:      column.NotNull,
			IsUnique:     uniqueColumns[column.Name],
			DataType:     column.DataType,
			IsPrimaryKey: column.IsPrimaryKey,
			IsForeignKey: column.IsForeignKey,
		})
	}
	return table, nil
}

func (engine *SqliteEngine) TableColumns(ctx context.Context, db Querier, schema string, table string) ([]TableColumn, error) {
	rows, err := db.QueryContext(ctx, "SELECT cid, name, pk FROM pragma_table_info(?, ?) ORDER BY cid", table, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	columns := []TableColumn{}
	for rows.Next() {
		var cid, keyOrder int
		var name string
		if err := rows.Scan(&cid, &name, &keyOrder); err != nil {
			return nil, err
		}
		columns = append(columns, TableColumn{Position: uint16(cid + 1), Name: name, KeyOrder: keyOrder, QuotedName: engine.QuoteIdentifier(name)})
	}
	sort.SliceStable(columns, func(first, second int) bool { return columns[first].Position < columns[second].Position })
	return columns, rows.Err()
}

func (engine *SqliteEngine) DropStatement(ctx context.Context, db Querier, input talpadbDtos.DropObjectInputDto) (string, error) {
	if input.Kind != "relation" {
		return "", fmt.Errorf("%w: excluir %s no SQLite", ErrUnsupported, input.Kind)
	}
	objectType, err := engine.objectType(ctx, db, input.Schema, input.Name)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("DROP %s %s;", strings.ToUpper(objectType), engine.qualified(input.Schema, input.Name)), nil
}
