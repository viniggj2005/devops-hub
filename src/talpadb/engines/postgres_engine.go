package talpadbEngines

import (
	"fmt"
	"errors"
	"context"
	"strings"
	"database/sql"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

const postgresListDatabasesSql = `
SELECT d.datname AS name,
       pg_catalog.pg_get_userbyid(d.datdba) AS owner,
       pg_catalog.pg_encoding_to_char(d.encoding) AS encoding,
       %s AS size_bytes,
       d.datallowconn AS allow_connect,
       pg_catalog.shobj_description(d.oid, 'pg_database') AS comment
FROM pg_catalog.pg_database d
WHERE NOT d.datistemplate
ORDER BY d.datname`

const postgresDatabaseSizeExpression = `CASE WHEN pg_catalog.has_database_privilege(d.oid, 'CONNECT') THEN pg_catalog.pg_database_size(d.oid) END`

const postgresListSchemasSql = `
SELECT n.nspname AS name,
       pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
       pg_catalog.obj_description(n.oid, 'pg_namespace') AS comment
FROM pg_catalog.pg_namespace n
WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
ORDER BY n.nspname`

const postgresCompletionSchemaSql = `
SELECT n.nspname AS schema,
       c.relname AS name,
       COALESCE(array_agg(a.attname::text ORDER BY a.attnum) FILTER (WHERE a.attname IS NOT NULL), '{}') AS columns
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relkind IN ('r', 'p', 'f', 'v', 'm')
  AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
GROUP BY n.nspname, c.relname
ORDER BY n.nspname, c.relname
LIMIT 5000`

const postgresDiagramTablesSql = `
SELECT c.oid, n.nspname, c.relname, c.relkind::text, pg_catalog.obj_description(c.oid, 'pg_class')
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  AND ($1::text = '' OR n.nspname = $1::text) %s
ORDER BY n.nspname, c.relname
LIMIT %d`

const postgresDiagramColumnsSql = `
SELECT a.attrelid,
       a.attname,
       pg_catalog.format_type(a.atttypid, a.atttypmod),
       a.attnotnull,
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'p' AND a.attnum = ANY (con.conkey)),
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'f' AND a.attnum = ANY (con.conkey)),
       EXISTS (SELECT 1 FROM pg_catalog.pg_index i
               WHERE i.indrelid = a.attrelid AND i.indisunique AND NOT i.indisprimary
                 AND i.indnatts = 1 AND i.indkey[0] = a.attnum AND i.indpred IS NULL)
FROM pg_catalog.pg_attribute a
WHERE a.attrelid = ANY ($1::oid[]) AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attrelid, a.attnum`

const postgresDiagramRelationsSql = `
SELECT con.conname AS name,
       sn.nspname AS source_schema,
       sc.relname AS source_table,
       tn.nspname AS target_schema,
       tc.relname AS target_table,
       ARRAY(SELECT a.attname::text
             FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
             ORDER BY k.ord) AS source_columns,
       ARRAY(SELECT a.attname::text
             FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum
             ORDER BY k.ord) AS target_columns
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class sc ON sc.oid = con.conrelid
JOIN pg_catalog.pg_namespace sn ON sn.oid = sc.relnamespace
JOIN pg_catalog.pg_class tc ON tc.oid = con.confrelid
JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
WHERE con.contype = 'f' AND con.conrelid = ANY ($1::oid[]) AND con.confrelid = ANY ($1::oid[]) %s
ORDER BY sn.nspname, sc.relname, con.conname`

const postgresServerOverviewSql = `
SELECT pg_catalog.version() AS version,
       pg_catalog.current_setting('server_version') AS server_version,
       pg_catalog.pg_postmaster_start_time() AS start_time,
       EXTRACT(EPOCH FROM (pg_catalog.now() - pg_catalog.pg_postmaster_start_time()))::bigint AS uptime_seconds,
       pg_catalog.current_setting('max_connections')::bigint AS max_connections,
       CURRENT_USER::text AS user_name,
       COALESCE((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = CURRENT_USER), false) AS is_superuser,
       pg_catalog.pg_is_in_recovery() AS in_recovery,
       EXTRACT(EPOCH FROM pg_catalog.clock_timestamp())::float8 AS sampled_at`

const postgresDatabaseStatsSql = `
SELECT d.datname AS name,
       CASE WHEN $1::boolean AND pg_catalog.has_database_privilege(d.oid, 'CONNECT')
            THEN pg_catalog.pg_database_size(d.oid) END AS size_bytes,
       COALESCE(s.numbackends, 0)::bigint AS connections,
       COALESCE(s.xact_commit, 0)::bigint AS xact_commit,
       COALESCE(s.xact_rollback, 0)::bigint AS xact_rollback,
       COALESCE(s.blks_read, 0)::bigint AS blocks_read,
       COALESCE(s.blks_hit, 0)::bigint AS blocks_hit,
       COALESCE(s.tup_returned, 0)::bigint AS tup_returned,
       COALESCE(s.tup_fetched, 0)::bigint AS tup_fetched,
       COALESCE(s.tup_inserted, 0)::bigint AS tup_inserted,
       COALESCE(s.tup_updated, 0)::bigint AS tup_updated,
       COALESCE(s.tup_deleted, 0)::bigint AS tup_deleted
FROM pg_catalog.pg_database d
LEFT JOIN pg_catalog.pg_stat_database s ON s.datid = d.oid
WHERE NOT d.datistemplate
ORDER BY d.datname`

const postgresDatabaseRolesSql = `
SELECT r.rolname FROM pg_catalog.pg_roles r
WHERE r.rolname !~ '^pg_'
ORDER BY r.rolname`

const postgresDatabaseTemplatesSql = `
SELECT d.datname FROM pg_catalog.pg_database d
WHERE d.datistemplate OR d.datallowconn
ORDER BY d.datistemplate DESC, d.datname`

const postgresDatabaseDefaultsSql = `
SELECT current_user, pg_catalog.pg_encoding_to_char(d.encoding), d.datcollate, d.datctype
FROM pg_catalog.pg_database d
WHERE d.datname = 'template1'`

const postgresEditableColumnsSql = `
SELECT a.attnum,
       a.attname,
       COALESCE((
           SELECT k.ord::int
           FROM pg_catalog.pg_index i,
                unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
           WHERE i.indrelid = c.oid AND i.indisprimary AND k.attnum = a.attnum
           LIMIT 1
       ), 0)
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2
  AND c.relkind IN ('r', 'p')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum`

var postgresRelationDropKeywords = map[string]string{
	"r": "TABLE",
	"p": "TABLE",
	"v": "VIEW",
	"f": "FOREIGN TABLE",
	"m": "MATERIALIZED VIEW",
}

type postgresRelationSummary struct {
	Oid           uint32
	EstimatedRows int64
	TotalSize     int64
	TableSize     int64
	IndexSize     int64
	Owner         string
	Ddl           talpadbFunctions.RelationDdlInfo
}

type PostgresEngine struct{}

var Postgres = &PostgresEngine{}

func (engine *PostgresEngine) Name() string {
	return talpadbFunctions.EnginePostgres
}

func (engine *PostgresEngine) Label() string {
	return "PostgreSQL"
}

func (engine *PostgresEngine) DriverName() string {
	return "pgx"
}

func (engine *PostgresEngine) DefaultPort() int64 {
	return 5432
}

func (engine *PostgresEngine) DateOnlyAtMidnight() bool {
	return false
}

func (engine *PostgresEngine) DataSourceName(params talpadbFunctions.ConnectionParams) (string, error) {
	return talpadbFunctions.BuildConnectionString(params), nil
}

func (engine *PostgresEngine) PrepareSession(_ context.Context, _ Querier) error {
	return nil
}

func (engine *PostgresEngine) ServerVersion(ctx context.Context, db Querier) (string, error) {
	var version string
	err := db.QueryRowContext(ctx, "SELECT pg_catalog.current_setting('server_version')").Scan(&version)
	return strings.TrimSpace(version), err
}

func (engine *PostgresEngine) DefaultSchema(ctx context.Context, db Querier) (string, error) {
	var schema string
	err := db.QueryRowContext(ctx, "SELECT COALESCE(pg_catalog.current_schema(), 'public')").Scan(&schema)
	return schema, err
}

func (engine *PostgresEngine) QuoteIdentifier(name string) string {
	return pgx.Identifier{name}.Sanitize()
}

func (engine *PostgresEngine) Placeholder(position int) string {
	return fmt.Sprintf("$%d", position)
}

func (engine *PostgresEngine) NormalizeIdentifier(name string, quoted bool) string {
	if quoted {
		return name
	}
	return strings.ToLower(name)
}

func (engine *PostgresEngine) SplitStatements(script string) []Statement {
	return splitStatements(script, postgresDialect)
}

func (engine *PostgresEngine) DefaultValuesInsert(_ string) string {
	return " DEFAULT VALUES"
}

func (engine *PostgresEngine) TransactionState(statement Statement, inTransaction bool) bool {
	switch statement.Keyword {
	case "BEGIN", "START", "SAVEPOINT":
		return true
	case "COMMIT", "ROLLBACK", "END", "ABORT":
		words := statement.LeadingWords(3)
		if len(words) >= 2 && words[1] == "TO" {
			return inTransaction
		}
		return false
	}
	return inTransaction
}

func (engine *PostgresEngine) ListDatabases(ctx context.Context, db Querier, _ talpadbFunctions.ConnectionParams) ([]talpadbDtos.DatabaseDto, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf(postgresListDatabasesSql, postgresDatabaseSizeExpression))
	if err != nil {
		rows, err = db.QueryContext(ctx, fmt.Sprintf(postgresListDatabasesSql, "NULL::bigint"))
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()

	databases := []talpadbDtos.DatabaseDto{}
	for rows.Next() {
		var database talpadbDtos.DatabaseDto
		var sizeBytes sql.NullInt64
		var comment sql.NullString
		if err := rows.Scan(&database.Name, &database.Owner, &database.Encoding, &sizeBytes, &database.AllowConnect, &comment); err != nil {
			return nil, err
		}
		if sizeBytes.Valid {
			size := sizeBytes.Int64
			database.SizeBytes = &size
		}
		database.Comment = nullableString(comment)
		databases = append(databases, database)
	}
	return databases, rows.Err()
}

func (engine *PostgresEngine) ListSchemas(ctx context.Context, db Querier) ([]talpadbDtos.SchemaDto, error) {
	rows, err := db.QueryContext(ctx, postgresListSchemasSql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	schemas := []talpadbDtos.SchemaDto{}
	for rows.Next() {
		var schema talpadbDtos.SchemaDto
		var comment sql.NullString
		if err := rows.Scan(&schema.Name, &schema.Owner, &comment); err != nil {
			return nil, err
		}
		schema.Comment = nullableString(comment)
		schemas = append(schemas, schema)
	}
	return schemas, rows.Err()
}

func (engine *PostgresEngine) ListSchemaObjects(ctx context.Context, db Querier, schema string) (*talpadbDtos.SchemaObjectsDto, error) {
	objects := emptySchemaObjects()
	rows, err := db.QueryContext(ctx, `
SELECT c.relname,
       c.relkind::text,
       GREATEST(c.reltuples, 0)::bigint,
       pg_catalog.obj_description(c.oid, 'pg_class')
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1
  AND c.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
ORDER BY c.relname`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var relation talpadbDtos.RelationDto
		var comment sql.NullString
		if err := rows.Scan(&relation.Name, &relation.Kind, &relation.EstimatedRows, &comment); err != nil {
			return nil, err
		}
		relation.Comment = nullableString(comment)
		switch relation.Kind {
		case "v":
			objects.Views = append(objects.Views, relation)
		case "m":
			objects.MaterializedViews = append(objects.MaterializedViews, relation)
		case "S":
			objects.Sequences = append(objects.Sequences, relation)
		default:
			objects.Tables = append(objects.Tables, relation)
		}
	}
	return objects, rows.Err()
}

func (engine *PostgresEngine) ListColumns(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.ColumnDto, error) {
	rows, err := db.QueryContext(ctx, `
SELECT a.attnum,
       a.attname,
       pg_catalog.quote_ident(a.attname),
       pg_catalog.format_type(a.atttypid, a.atttypmod),
       a.attnotnull,
       pg_catalog.pg_get_expr(ad.adbin, ad.adrelid),
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'p' AND a.attnum = ANY (con.conkey)),
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'f' AND a.attnum = ANY (con.conkey)),
       a.attidentity::text,
       a.attgenerated::text,
       CASE WHEN a.attcollation <> 0 AND a.attcollation <> t.typcollation
            THEN pg_catalog.quote_ident(cn.nspname) || '.' || pg_catalog.quote_ident(co.collname) END,
       pg_catalog.col_description(a.attrelid, a.attnum)
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
LEFT JOIN pg_catalog.pg_collation co ON co.oid = a.attcollation
LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid = co.collnamespace
WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum`, schema, relation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := []talpadbDtos.ColumnDto{}
	for rows.Next() {
		var column talpadbDtos.ColumnDto
		var defaultValue, collation, comment sql.NullString
		if err := rows.Scan(
			&column.Position,
			&column.Name,
			&column.QuotedName,
			&column.DataType,
			&column.NotNull,
			&defaultValue,
			&column.IsPrimaryKey,
			&column.IsForeignKey,
			&column.Identity,
			&column.Generated,
			&collation,
			&comment,
		); err != nil {
			return nil, err
		}
		column.DefaultValue = nullableString(defaultValue)
		column.Collation = nullableString(collation)
		column.Comment = nullableString(comment)
		columns = append(columns, column)
	}
	return columns, rows.Err()
}

func (engine *PostgresEngine) TableDetails(ctx context.Context, db Querier, schema string, relation string) (*talpadbDtos.TableDetailsDto, error) {
	columns, err := engine.ListColumns(ctx, db, schema, relation)
	if err != nil {
		return nil, err
	}
	details := emptyTableDetails(schema, relation, "r")
	details.Columns = columns
	return details, nil
}

func (engine *PostgresEngine) ObjectDdl(_ context.Context, _ Querier, _ talpadbDtos.ObjectReferenceDto) (string, error) {
	return "", ErrUnsupported
}

func (engine *PostgresEngine) CompletionSchema(_ context.Context, _ Querier) ([]talpadbDtos.CompletionTableDto, error) {
	return []talpadbDtos.CompletionTableDto{}, nil
}

func (engine *PostgresEngine) Diagram(_ context.Context, _ Querier, _ string) (*talpadbDtos.DatabaseDiagramDto, error) {
	return &talpadbDtos.DatabaseDiagramDto{
		Tables:    []talpadbDtos.DiagramTableDto{},
		Relations: []talpadbDtos.DiagramRelationDto{},
	}, nil
}

func (engine *PostgresEngine) TableColumns(ctx context.Context, db Querier, schema string, table string) ([]TableColumn, error) {
	rows, err := db.QueryContext(ctx, postgresEditableColumnsSql, schema, table)
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

func (engine *PostgresEngine) DropStatement(ctx context.Context, db Querier, input talpadbDtos.DropObjectInputDto) (string, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return "", errors.New("informe o objeto a excluir")
	}
	switch input.Kind {
	case "database":
		statement := "DROP DATABASE " + engine.QuoteIdentifier(name)
		if input.Force {
			statement += " WITH (FORCE)"
		}
		return statement + ";", nil
	case "schema":
		return "DROP SCHEMA " + engine.QuoteIdentifier(name) + PostgresCascadeClause(input.Cascade) + ";", nil
	case "relation":
		var kind string
		err := db.QueryRowContext(ctx, `
SELECT c.relkind::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2`, input.Schema, name).Scan(&kind)
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("objeto %s.%s não encontrado", input.Schema, name)
		}
		if err != nil {
			return "", err
		}
		return engine.BuildRelationDropSql(input.Schema, name, kind, input.Cascade)
	}
	return "", fmt.Errorf("tipo de objeto desconhecido: %s", input.Kind)
}

func PostgresCascadeClause(cascade bool) string {
	if cascade {
		return " CASCADE"
	}
	return ""
}

func (engine *PostgresEngine) BuildRelationDropSql(schema string, name string, kind string, cascade bool) (string, error) {
	keyword, supported := postgresRelationDropKeywords[kind]
	if !supported {
		return "", fmt.Errorf("%s.%s não é uma tabela ou view", schema, name)
	}
	qualified := engine.QuoteIdentifier(schema) + "." + engine.QuoteIdentifier(name)
	return "DROP " + keyword + " " + qualified + PostgresCascadeClause(cascade) + ";", nil
}

func (engine *PostgresEngine) BuildCreateDatabaseSql(input talpadbDtos.CreateDatabaseInputDto) (string, string, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return "", "", errors.New("informe o nome do banco")
	}
	if input.ConnectionLimit < -1 {
		return "", "", errors.New("o limite de conexões deve ser -1 (ilimitado) ou maior")
	}

	options := []string{}
	if owner := strings.TrimSpace(input.Owner); owner != "" {
		options = append(options, "OWNER = "+engine.QuoteIdentifier(owner))
	}
	if template := strings.TrimSpace(input.Template); template != "" {
		options = append(options, "TEMPLATE = "+engine.QuoteIdentifier(template))
	}
	if encoding := strings.TrimSpace(input.Encoding); encoding != "" {
		options = append(options, "ENCODING = "+talpadbFunctions.QuoteLiteral(encoding))
	}
	if collate := strings.TrimSpace(input.Collate); collate != "" {
		options = append(options, "LC_COLLATE = "+talpadbFunctions.QuoteLiteral(collate))
	}
	if ctype := strings.TrimSpace(input.Ctype); ctype != "" {
		options = append(options, "LC_CTYPE = "+talpadbFunctions.QuoteLiteral(ctype))
	}
	if input.ConnectionLimit != -1 {
		options = append(options, fmt.Sprintf("CONNECTION LIMIT = %d", input.ConnectionLimit))
	}

	createSql := "CREATE DATABASE " + engine.QuoteIdentifier(name)
	if len(options) > 0 {
		createSql += "\n    WITH " + strings.Join(options, "\n         ")
	}
	createSql += ";"

	commentSql := ""
	if comment := strings.TrimSpace(input.Comment); comment != "" {
		commentSql = fmt.Sprintf("COMMENT ON DATABASE %s IS %s;", engine.QuoteIdentifier(name), talpadbFunctions.QuoteLiteral(comment))
	}
	return createSql, commentSql, nil
}

func (engine *PostgresEngine) DatabaseOptions(ctx context.Context, pool *pgxpool.Pool) (*talpadbDtos.DatabaseOptionsDto, error) {
	options := &talpadbDtos.DatabaseOptionsDto{}
	if err := pool.QueryRow(ctx, postgresDatabaseDefaultsSql).Scan(
		&options.CurrentUser,
		&options.DefaultEncoding,
		&options.DefaultCollate,
		&options.DefaultCtype,
	); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	roles, err := pool.Query(ctx, postgresDatabaseRolesSql)
	if err != nil {
		return nil, err
	}
	if options.Roles, err = pgx.CollectRows(roles, pgx.RowTo[string]); err != nil {
		return nil, err
	}

	templates, err := pool.Query(ctx, postgresDatabaseTemplatesSql)
	if err != nil {
		return nil, err
	}
	if options.Templates, err = pgx.CollectRows(templates, pgx.RowTo[string]); err != nil {
		return nil, err
	}
	return options, nil
}

func (engine *PostgresEngine) ServerDashboard(ctx context.Context, pool *pgxpool.Pool, versionNumber int, includeSizes bool) (*talpadbDtos.ServerDashboardDto, error) {
	rows, err := pool.Query(ctx, postgresServerOverviewSql)
	if err != nil {
		return nil, err
	}
	dashboard, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[talpadbDtos.ServerDashboardDto])
	if err != nil {
		return nil, err
	}

	databases, err := collectPgxRows[talpadbDtos.DatabaseStatDto](ctx, pool, postgresDatabaseStatsSql, includeSizes)
	if err != nil && includeSizes {
		databases, err = collectPgxRows[talpadbDtos.DatabaseStatDto](ctx, pool, postgresDatabaseStatsSql, false)
	}
	if err != nil {
		return nil, err
	}
	dashboard.Databases = databases

	waitEventExpression := "NULL::text"
	if versionNumber >= 90600 {
		waitEventExpression = "CASE WHEN a.wait_event IS NOT NULL THEN a.wait_event_type || ': ' || a.wait_event END"
	}
	backendTypeExpression := "NULL::text"
	if versionNumber >= 100000 {
		backendTypeExpression = "a.backend_type"
	}
	sessions, err := collectPgxRows[talpadbDtos.ServerSessionDto](ctx, pool, fmt.Sprintf(`
SELECT a.pid,
       a.usename::text AS user_name,
       a.datname::text AS database,
       COALESCE(a.application_name, '') AS application_name,
       pg_catalog.host(a.client_addr) AS client_address,
       a.state,
       %s AS wait_event,
       %s AS backend_type,
       EXTRACT(EPOCH FROM (pg_catalog.now() - a.backend_start))::float8 AS backend_seconds,
       EXTRACT(EPOCH FROM (pg_catalog.now() - a.xact_start))::float8 AS transaction_seconds,
       EXTRACT(EPOCH FROM (pg_catalog.now() - a.query_start))::float8 AS query_seconds,
       pg_catalog.substr(a.query, 1, 4000) AS query,
       a.pid = pg_catalog.pg_backend_pid() AS is_current
FROM pg_catalog.pg_stat_activity a
ORDER BY a.pid`, waitEventExpression, backendTypeExpression))
	if err != nil {
		return nil, err
	}
	dashboard.Sessions = sessions
	return &dashboard, nil
}

func (engine *PostgresEngine) PoolListDatabases(ctx context.Context, pool *pgxpool.Pool) ([]talpadbDtos.DatabaseDto, error) {
	databases, err := collectPgxRows[talpadbDtos.DatabaseDto](ctx, pool, fmt.Sprintf(postgresListDatabasesSql, postgresDatabaseSizeExpression))
	if err != nil {
		return collectPgxRows[talpadbDtos.DatabaseDto](ctx, pool, fmt.Sprintf(postgresListDatabasesSql, "NULL::bigint"))
	}
	return databases, nil
}

func (engine *PostgresEngine) PoolListSchemas(ctx context.Context, pool *pgxpool.Pool) ([]talpadbDtos.SchemaDto, error) {
	return collectPgxRows[talpadbDtos.SchemaDto](ctx, pool, postgresListSchemasSql)
}

func (engine *PostgresEngine) PoolListSchemaObjects(ctx context.Context, pool *pgxpool.Pool, versionNumber int, schema string) (*talpadbDtos.SchemaObjectsDto, error) {
	partitionFilter := ""
	if versionNumber >= 100000 {
		partitionFilter = "AND NOT c.relispartition"
	}
	relations, err := collectPgxRows[talpadbDtos.RelationDto](ctx, pool, fmt.Sprintf(`
SELECT c.relname AS name,
       c.relkind::text AS kind,
       GREATEST(c.reltuples, 0)::bigint AS estimated_rows,
       pg_catalog.obj_description(c.oid, 'pg_class') AS comment
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1
  AND c.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
  %s
ORDER BY c.relname`, partitionFilter), schema)
	if err != nil {
		return nil, err
	}

	kindExpression := "p.prokind::text"
	kindFilter := "AND p.prokind IN ('f', 'p')"
	if versionNumber < 110000 {
		kindExpression = "CASE WHEN p.proiswindow THEN 'w' ELSE 'f' END"
		kindFilter = "AND NOT p.proisagg"
	}
	functions, err := collectPgxRows[talpadbDtos.FunctionDto](ctx, pool, fmt.Sprintf(`
SELECT p.oid,
       p.proname AS name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       COALESCE(pg_catalog.pg_get_function_result(p.oid), '') AS result_type,
       %s AS kind
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = $1
  %s
  AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_depend d
      WHERE d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        AND d.objid = p.oid
        AND d.deptype = 'e')
ORDER BY p.proname, 3`, kindExpression, kindFilter), schema)
	if err != nil {
		return nil, err
	}

	objects := emptySchemaObjects()
	objects.Functions = functions
	for _, relation := range relations {
		switch relation.Kind {
		case "v":
			objects.Views = append(objects.Views, relation)
		case "m":
			objects.MaterializedViews = append(objects.MaterializedViews, relation)
		case "S":
			objects.Sequences = append(objects.Sequences, relation)
		default:
			objects.Tables = append(objects.Tables, relation)
		}
	}
	return objects, nil
}

func (engine *PostgresEngine) RelationOid(ctx context.Context, pool *pgxpool.Pool, schema string, relation string) (uint32, string, error) {
	var oid uint32
	var kind string
	err := pool.QueryRow(ctx, `
SELECT c.oid, c.relkind::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2`, schema, relation).Scan(&oid, &kind)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, "", fmt.Errorf("objeto %s.%s não encontrado", schema, relation)
	}
	return oid, kind, err
}

func (engine *PostgresEngine) PoolListColumns(ctx context.Context, pool *pgxpool.Pool, versionNumber int, oid uint32) ([]talpadbDtos.ColumnDto, error) {
	identityExpression := "''"
	if versionNumber >= 100000 {
		identityExpression = "a.attidentity::text"
	}
	generatedExpression := "''"
	if versionNumber >= 120000 {
		generatedExpression = "a.attgenerated::text"
	}

	return collectPgxRows[talpadbDtos.ColumnDto](ctx, pool, fmt.Sprintf(`
SELECT a.attnum AS position,
       a.attname AS name,
       pg_catalog.quote_ident(a.attname) AS quoted_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null,
       pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS default_value,
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'p' AND a.attnum = ANY (con.conkey)) AS is_primary_key,
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'f' AND a.attnum = ANY (con.conkey)) AS is_foreign_key,
       %s AS identity,
       %s AS generated,
       CASE WHEN a.attcollation <> 0 AND a.attcollation <> t.typcollation
            THEN pg_catalog.quote_ident(cn.nspname) || '.' || pg_catalog.quote_ident(co.collname) END AS collation,
       pg_catalog.col_description(a.attrelid, a.attnum) AS comment
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
LEFT JOIN pg_catalog.pg_collation co ON co.oid = a.attcollation
LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid = co.collnamespace
WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum`, identityExpression, generatedExpression), oid)
}

func (engine *PostgresEngine) PoolTableDetails(ctx context.Context, pool *pgxpool.Pool, versionNumber int, schema string, relation string) (*talpadbDtos.TableDetailsDto, error) {
	oid, kind, err := engine.RelationOid(ctx, pool, schema, relation)
	if err != nil {
		return nil, err
	}
	switch kind {
	case "r", "p", "f", "v", "m":
	default:
		return nil, fmt.Errorf("%s.%s não é uma tabela ou view", schema, relation)
	}

	info, err := engine.loadRelationSummary(ctx, pool, versionNumber, oid)
	if err != nil {
		return nil, err
	}

	columns, err := engine.PoolListColumns(ctx, pool, versionNumber, oid)
	if err != nil {
		return nil, err
	}

	indexes, err := collectPgxRows[talpadbDtos.IndexDto](ctx, pool, `
SELECT i.relname AS name,
       pg_catalog.quote_ident(i.relname) AS quoted_name,
       pg_catalog.pg_get_indexdef(ix.indexrelid) AS definition,
       ix.indisunique AS is_unique,
       ix.indisprimary AS is_primary,
       pg_catalog.pg_relation_size(ix.indexrelid) AS size_bytes,
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conindid = ix.indexrelid AND con.conrelid = ix.indrelid
                 AND con.contype IN ('p', 'u', 'x')) AS constraint_backed
FROM pg_catalog.pg_index ix
JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
WHERE ix.indrelid = $1
ORDER BY ix.indisprimary DESC, i.relname`, oid)
	if err != nil {
		return nil, err
	}

	constraints, err := collectPgxRows[talpadbDtos.ConstraintDto](ctx, pool, `
SELECT con.conname AS name,
       pg_catalog.quote_ident(con.conname) AS quoted_name,
       con.contype::text AS type,
       pg_catalog.pg_get_constraintdef(con.oid, true) AS definition,
       con.conislocal AS is_local
FROM pg_catalog.pg_constraint con
WHERE con.conrelid = $1 AND con.contype <> 'n'
ORDER BY CASE con.contype WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'f' THEN 2 WHEN 'c' THEN 3 ELSE 4 END, con.conname`, oid)
	if err != nil {
		return nil, err
	}

	triggers, err := collectPgxRows[talpadbDtos.TriggerDto](ctx, pool, `
SELECT t.tgname AS name,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS definition,
       t.tgenabled <> 'D' AS enabled
FROM pg_catalog.pg_trigger t
WHERE t.tgrelid = $1 AND NOT t.tgisinternal
ORDER BY t.tgname`, oid)
	if err != nil {
		return nil, err
	}

	details := &talpadbDtos.TableDetailsDto{
		Schema:         schema,
		Name:           relation,
		Kind:           kind,
		Owner:          info.Owner,
		EstimatedRows:  info.EstimatedRows,
		TotalSizeBytes: info.TotalSize,
		TableSizeBytes: info.TableSize,
		IndexSizeBytes: info.IndexSize,
		Comment:        info.Ddl.Comment,
		Columns:        columns,
		Indexes:        indexes,
		Constraints:    constraints,
		Triggers:       triggers,
	}

	if kind == "v" || kind == "m" {
		details.Ddl = talpadbFunctions.BuildViewDdl(info.Ddl, columns, indexes, triggers)
	} else {
		details.Ddl = talpadbFunctions.BuildTableDdl(info.Ddl, columns, constraints, indexes, triggers)
	}
	return details, nil
}

func (engine *PostgresEngine) PoolObjectDdl(ctx context.Context, pool *pgxpool.Pool, versionNumber int, object talpadbDtos.ObjectReferenceDto) (string, error) {
	switch object.Kind {
	case "table", "view", "matview":
		details, err := engine.PoolTableDetails(ctx, pool, versionNumber, object.Schema, object.Name)
		if err != nil {
			return "", err
		}
		return details.Ddl, nil
	case "sequence":
		return engine.sequenceDdl(ctx, pool, versionNumber, object.Schema, object.Name)
	case "function":
		return engine.functionDdl(ctx, pool, versionNumber, object.Oid)
	case "schema":
		return engine.schemaDdl(ctx, pool, object.Name)
	}
	return "", fmt.Errorf("tipo de objeto não suportado: %s", object.Kind)
}

func (engine *PostgresEngine) PoolCompletionSchema(ctx context.Context, pool *pgxpool.Pool) ([]talpadbDtos.CompletionTableDto, error) {
	return collectPgxRows[talpadbDtos.CompletionTableDto](ctx, pool, postgresCompletionSchemaSql)
}

func (engine *PostgresEngine) PoolDiagram(ctx context.Context, pool *pgxpool.Pool, versionNumber int, schema string) (*talpadbDtos.DatabaseDiagramDto, error) {
	partitionFilter := ""
	if versionNumber >= 100000 {
		partitionFilter = "AND NOT c.relispartition"
	}
	inheritedFilter := ""
	if versionNumber >= 110000 {
		inheritedFilter = "AND con.conparentid = 0"
	}

	tableRows, err := pool.Query(ctx, fmt.Sprintf(postgresDiagramTablesSql, partitionFilter, MaxDiagramTables+1), schema)
	if err != nil {
		return nil, err
	}
	diagram := &talpadbDtos.DatabaseDiagramDto{
		Tables:    []talpadbDtos.DiagramTableDto{},
		Relations: []talpadbDtos.DiagramRelationDto{},
	}
	oids := []uint32{}
	tableIndexByOid := map[uint32]int{}
	for tableRows.Next() {
		var oid uint32
		table := talpadbDtos.DiagramTableDto{Columns: []talpadbDtos.DiagramColumnDto{}}
		if err := tableRows.Scan(&oid, &table.Schema, &table.Name, &table.Kind, &table.Comment); err != nil {
			tableRows.Close()
			return nil, err
		}
		if len(diagram.Tables) == MaxDiagramTables {
			diagram.Truncated = true
			continue
		}
		tableIndexByOid[oid] = len(diagram.Tables)
		oids = append(oids, oid)
		diagram.Tables = append(diagram.Tables, table)
	}
	tableRows.Close()
	if err := tableRows.Err(); err != nil {
		return nil, err
	}
	if len(oids) == 0 {
		return diagram, nil
	}

	columnRows, err := pool.Query(ctx, postgresDiagramColumnsSql, oids)
	if err != nil {
		return nil, err
	}
	for columnRows.Next() {
		var oid uint32
		var column talpadbDtos.DiagramColumnDto
		if err := columnRows.Scan(&oid, &column.Name, &column.DataType, &column.NotNull, &column.IsPrimaryKey, &column.IsForeignKey, &column.IsUnique); err != nil {
			columnRows.Close()
			return nil, err
		}
		index := tableIndexByOid[oid]
		diagram.Tables[index].Columns = append(diagram.Tables[index].Columns, column)
	}
	columnRows.Close()
	if err := columnRows.Err(); err != nil {
		return nil, err
	}

	relations, err := collectPgxRows[talpadbDtos.DiagramRelationDto](ctx, pool, fmt.Sprintf(postgresDiagramRelationsSql, inheritedFilter), oids)
	if err != nil {
		return nil, err
	}
	diagram.Relations = relations
	return diagram, nil
}

func (engine *PostgresEngine) loadRelationSummary(ctx context.Context, pool *pgxpool.Pool, versionNumber int, oid uint32) (*postgresRelationSummary, error) {
	partitionKeyExpression := "NULL::text"
	if versionNumber >= 100000 {
		partitionKeyExpression = "CASE WHEN c.relkind = 'p' THEN pg_catalog.pg_get_partkeydef(c.oid) END"
	}

	summary := &postgresRelationSummary{Oid: oid}
	err := pool.QueryRow(ctx, fmt.Sprintf(`
SELECT pg_catalog.quote_ident(n.nspname) || '.' || pg_catalog.quote_ident(c.relname),
       pg_catalog.quote_ident(n.nspname),
       c.relkind::text,
       c.relpersistence::text,
       pg_catalog.pg_get_userbyid(c.relowner),
       pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(c.relowner)),
       GREATEST(c.reltuples, 0)::bigint,
       pg_catalog.pg_total_relation_size(c.oid),
       pg_catalog.pg_relation_size(c.oid),
       pg_catalog.pg_indexes_size(c.oid),
       pg_catalog.obj_description(c.oid, 'pg_class'),
       CASE WHEN c.relkind IN ('v', 'm') THEN pg_catalog.pg_get_viewdef(c.oid, true) END,
       %s,
       COALESCE(c.reloptions, '{}'),
       (SELECT pg_catalog.quote_ident(ts.spcname) FROM pg_catalog.pg_tablespace ts WHERE ts.oid = c.reltablespace),
       (SELECT pg_catalog.quote_ident(fs.srvname)
        FROM pg_catalog.pg_foreign_table ft
        JOIN pg_catalog.pg_foreign_server fs ON fs.oid = ft.ftserver
        WHERE ft.ftrelid = c.oid)
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.oid = $1`, partitionKeyExpression), oid).Scan(
		&summary.Ddl.QualifiedName,
		&summary.Ddl.QuotedSchema,
		&summary.Ddl.Kind,
		&summary.Ddl.Persistence,
		&summary.Owner,
		&summary.Ddl.QuotedOwner,
		&summary.EstimatedRows,
		&summary.TotalSize,
		&summary.TableSize,
		&summary.IndexSize,
		&summary.Ddl.Comment,
		&summary.Ddl.ViewDefinition,
		&summary.Ddl.PartitionKey,
		&summary.Ddl.Options,
		&summary.Ddl.Tablespace,
		&summary.Ddl.ForeignServer,
	)
	if err != nil {
		return nil, err
	}
	return summary, nil
}

func (engine *PostgresEngine) sequenceDdl(ctx context.Context, pool *pgxpool.Pool, versionNumber int, schema string, name string) (string, error) {
	if versionNumber < 100000 {
		return "", errors.New("script de sequências requer PostgreSQL 10 ou superior")
	}
	oid, kind, err := engine.RelationOid(ctx, pool, schema, name)
	if err != nil {
		return "", err
	}
	if kind != "S" {
		return "", fmt.Errorf("%s.%s não é uma sequência", schema, name)
	}

	var sequence talpadbFunctions.SequenceDdlInfo
	err = pool.QueryRow(ctx, `
SELECT pg_catalog.quote_ident(n.nspname) || '.' || pg_catalog.quote_ident(c.relname),
       pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(c.relowner)),
       pg_catalog.format_type(s.seqtypid, NULL),
       s.seqstart, s.seqincrement, s.seqmin, s.seqmax, s.seqcache, s.seqcycle
FROM pg_catalog.pg_sequence s
JOIN pg_catalog.pg_class c ON c.oid = s.seqrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE s.seqrelid = $1`, oid).Scan(
		&sequence.QualifiedName,
		&sequence.QuotedOwner,
		&sequence.DataType,
		&sequence.Start,
		&sequence.Increment,
		&sequence.MinValue,
		&sequence.MaxValue,
		&sequence.Cache,
		&sequence.Cycle,
	)
	if err != nil {
		return "", err
	}
	return talpadbFunctions.BuildSequenceDdl(sequence), nil
}

func (engine *PostgresEngine) functionDdl(ctx context.Context, pool *pgxpool.Pool, versionNumber int, oid uint32) (string, error) {
	isProcedureExpression := "false"
	if versionNumber >= 110000 {
		isProcedureExpression = "p.prokind = 'p'"
	}

	var function talpadbFunctions.FunctionDdlInfo
	err := pool.QueryRow(ctx, fmt.Sprintf(`
SELECT pg_catalog.quote_ident(n.nspname) || '.' || pg_catalog.quote_ident(p.proname)
           || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
       %s,
       pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(p.proowner)),
       pg_catalog.pg_get_functiondef(p.oid)
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.oid = $1`, isProcedureExpression), oid).Scan(
		&function.Signature,
		&function.IsProcedure,
		&function.QuotedOwner,
		&function.Definition,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errors.New("função não encontrada")
	}
	if err != nil {
		return "", err
	}
	return talpadbFunctions.BuildFunctionDdl(function), nil
}

func (engine *PostgresEngine) schemaDdl(ctx context.Context, pool *pgxpool.Pool, name string) (string, error) {
	var quotedName, quotedOwner string
	var comment *string
	err := pool.QueryRow(ctx, `
SELECT pg_catalog.quote_ident(n.nspname),
       pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(n.nspowner)),
       pg_catalog.obj_description(n.oid, 'pg_namespace')
FROM pg_catalog.pg_namespace n
WHERE n.nspname = $1`, name).Scan(&quotedName, &quotedOwner, &comment)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("schema %s não encontrado", name)
	}
	if err != nil {
		return "", err
	}
	return talpadbFunctions.BuildSchemaDdl(quotedName, quotedOwner, comment), nil
}

func collectPgxRows[Result any](ctx context.Context, pool *pgxpool.Pool, sqlQuery string, arguments ...any) ([]Result, error) {
	rows, err := pool.Query(ctx, sqlQuery, arguments...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[Result])
}

