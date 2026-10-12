package postgresHandlers

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	postgresDtos "docker-manager-go/src/postgres/dtos"
	postgresFunctions "docker-manager-go/src/postgres/functions"
)

const listDatabasesSql = `
SELECT d.datname AS name,
       pg_catalog.pg_get_userbyid(d.datdba) AS owner,
       pg_catalog.pg_encoding_to_char(d.encoding) AS encoding,
       %s AS size_bytes,
       d.datallowconn AS allow_connect,
       pg_catalog.shobj_description(d.oid, 'pg_database') AS comment
FROM pg_catalog.pg_database d
WHERE NOT d.datistemplate
ORDER BY d.datname`

const databaseSizeExpression = `CASE WHEN pg_catalog.has_database_privilege(d.oid, 'CONNECT') THEN pg_catalog.pg_database_size(d.oid) END`

const listSchemasSql = `
SELECT n.nspname AS name,
       pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
       pg_catalog.obj_description(n.oid, 'pg_namespace') AS comment
FROM pg_catalog.pg_namespace n
WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
ORDER BY n.nspname`

const completionSchemaSql = `
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

type relationInfo struct {
	Oid           uint32
	EstimatedRows int64
	TotalSize     int64
	TableSize     int64
	IndexSize     int64
	Owner         string
	Ddl           postgresFunctions.RelationDdlInfo
}

func (handlerStruct *PostgresClientHandlerStruct) ListDatabases(token string, connectionId uint) ([]postgresDtos.DatabaseDto, error) {
	entry, err := handlerStruct.getPool(token, connectionId, "")
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	databases, err := collectRows[postgresDtos.DatabaseDto](ctx, entry, fmt.Sprintf(listDatabasesSql, databaseSizeExpression))
	if err != nil {
		// Alguns provedores gerenciados bloqueiam pg_database_size em bancos internos.
		return collectRows[postgresDtos.DatabaseDto](ctx, entry, fmt.Sprintf(listDatabasesSql, "NULL::bigint"))
	}
	return databases, nil
}

func (handlerStruct *PostgresClientHandlerStruct) ListSchemas(token string, connectionId uint, database string) ([]postgresDtos.SchemaDto, error) {
	entry, err := handlerStruct.getPool(token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return collectRows[postgresDtos.SchemaDto](ctx, entry, listSchemasSql)
}

func (handlerStruct *PostgresClientHandlerStruct) ListSchemaObjects(token string, connectionId uint, database string, schema string) (*postgresDtos.SchemaObjectsDto, error) {
	entry, err := handlerStruct.getPool(token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	partitionFilter := ""
	if entry.versionNumber >= 100000 {
		partitionFilter = "AND NOT c.relispartition"
	}
	relations, err := collectRows[postgresDtos.RelationDto](ctx, entry, fmt.Sprintf(`
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
	if entry.versionNumber < 110000 {
		kindExpression = "CASE WHEN p.proiswindow THEN 'w' ELSE 'f' END"
		kindFilter = "AND NOT p.proisagg"
	}
	functions, err := collectRows[postgresDtos.FunctionDto](ctx, entry, fmt.Sprintf(`
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

	objects := &postgresDtos.SchemaObjectsDto{
		Tables:            []postgresDtos.RelationDto{},
		Views:             []postgresDtos.RelationDto{},
		MaterializedViews: []postgresDtos.RelationDto{},
		Sequences:         []postgresDtos.RelationDto{},
		Functions:         functions,
	}
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

func (handlerStruct *PostgresClientHandlerStruct) ListColumns(token string, connectionId uint, database string, schema string, relation string) ([]postgresDtos.ColumnDto, error) {
	entry, err := handlerStruct.getPool(token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	oid, _, err := relationOid(ctx, entry, schema, relation)
	if err != nil {
		return nil, err
	}
	return listColumns(ctx, entry, oid)
}

func (handlerStruct *PostgresClientHandlerStruct) GetTableDetails(token string, connectionId uint, database string, schema string, relation string) (*postgresDtos.TableDetailsDto, error) {
	entry, err := handlerStruct.getPool(token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return buildRelationDetails(ctx, entry, schema, relation)
}

func (handlerStruct *PostgresClientHandlerStruct) GetObjectDdl(token string, connectionId uint, database string, object postgresDtos.ObjectReferenceDto) (string, error) {
	entry, err := handlerStruct.getPool(token, connectionId, database)
	if err != nil {
		return "", err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	switch object.Kind {
	case "table", "view", "matview":
		details, err := buildRelationDetails(ctx, entry, object.Schema, object.Name)
		if err != nil {
			return "", err
		}
		return details.Ddl, nil
	case "sequence":
		return sequenceDdl(ctx, entry, object.Schema, object.Name)
	case "function":
		return functionDdl(ctx, entry, object.Oid)
	case "schema":
		return schemaDdl(ctx, entry, object.Name)
	}
	return "", fmt.Errorf("tipo de objeto não suportado: %s", object.Kind)
}

func (handlerStruct *PostgresClientHandlerStruct) CountRows(token string, connectionId uint, database string, schema string, relation string) (int64, error) {
	entry, err := handlerStruct.getPool(token, connectionId, database)
	if err != nil {
		return 0, err
	}
	ctx, cancel := context.WithTimeout(handlerStruct.baseContext(), 5*time.Minute)
	defer cancel()

	var count int64
	err = entry.pool.QueryRow(ctx, "SELECT count(*) FROM "+pgx.Identifier{schema, relation}.Sanitize()).Scan(&count)
	return count, err
}

func (handlerStruct *PostgresClientHandlerStruct) GetCompletionSchema(token string, connectionId uint, database string) ([]postgresDtos.CompletionTableDto, error) {
	entry, err := handlerStruct.getPool(token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return collectRows[postgresDtos.CompletionTableDto](ctx, entry, completionSchemaSql)
}

func collectRows[T any](ctx context.Context, entry *poolEntry, sql string, arguments ...any) ([]T, error) {
	rows, err := entry.pool.Query(ctx, sql, arguments...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[T])
}

func relationOid(ctx context.Context, entry *poolEntry, schema string, relation string) (uint32, string, error) {
	var oid uint32
	var kind string
	err := entry.pool.QueryRow(ctx, `
SELECT c.oid, c.relkind::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2`, schema, relation).Scan(&oid, &kind)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, "", fmt.Errorf("objeto %s.%s não encontrado", schema, relation)
	}
	return oid, kind, err
}

func listColumns(ctx context.Context, entry *poolEntry, oid uint32) ([]postgresDtos.ColumnDto, error) {
	identityExpression := "''"
	if entry.versionNumber >= 100000 {
		identityExpression = "a.attidentity::text"
	}
	generatedExpression := "''"
	if entry.versionNumber >= 120000 {
		generatedExpression = "a.attgenerated::text"
	}

	return collectRows[postgresDtos.ColumnDto](ctx, entry, fmt.Sprintf(`
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

func loadRelationInfo(ctx context.Context, entry *poolEntry, oid uint32) (*relationInfo, error) {
	partitionKeyExpression := "NULL::text"
	if entry.versionNumber >= 100000 {
		partitionKeyExpression = "CASE WHEN c.relkind = 'p' THEN pg_catalog.pg_get_partkeydef(c.oid) END"
	}

	info := &relationInfo{Oid: oid}
	err := entry.pool.QueryRow(ctx, fmt.Sprintf(`
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
		&info.Ddl.QualifiedName,
		&info.Ddl.QuotedSchema,
		&info.Ddl.Kind,
		&info.Ddl.Persistence,
		&info.Owner,
		&info.Ddl.QuotedOwner,
		&info.EstimatedRows,
		&info.TotalSize,
		&info.TableSize,
		&info.IndexSize,
		&info.Ddl.Comment,
		&info.Ddl.ViewDefinition,
		&info.Ddl.PartitionKey,
		&info.Ddl.Options,
		&info.Ddl.Tablespace,
		&info.Ddl.ForeignServer,
	)
	if err != nil {
		return nil, err
	}
	return info, nil
}

func buildRelationDetails(ctx context.Context, entry *poolEntry, schema string, relation string) (*postgresDtos.TableDetailsDto, error) {
	oid, kind, err := relationOid(ctx, entry, schema, relation)
	if err != nil {
		return nil, err
	}
	switch kind {
	case "r", "p", "f", "v", "m":
	default:
		return nil, fmt.Errorf("%s.%s não é uma tabela ou view", schema, relation)
	}

	info, err := loadRelationInfo(ctx, entry, oid)
	if err != nil {
		return nil, err
	}

	columns, err := listColumns(ctx, entry, oid)
	if err != nil {
		return nil, err
	}

	indexes, err := collectRows[postgresDtos.IndexDto](ctx, entry, `
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

	// contype 'n' (NOT NULL, PostgreSQL 18+) já aparece na definição das colunas.
	constraints, err := collectRows[postgresDtos.ConstraintDto](ctx, entry, `
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

	triggers, err := collectRows[postgresDtos.TriggerDto](ctx, entry, `
SELECT t.tgname AS name,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS definition,
       t.tgenabled <> 'D' AS enabled
FROM pg_catalog.pg_trigger t
WHERE t.tgrelid = $1 AND NOT t.tgisinternal
ORDER BY t.tgname`, oid)
	if err != nil {
		return nil, err
	}

	details := &postgresDtos.TableDetailsDto{
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
		details.Ddl = postgresFunctions.BuildViewDdl(info.Ddl, columns, indexes, triggers)
	} else {
		details.Ddl = postgresFunctions.BuildTableDdl(info.Ddl, columns, constraints, indexes, triggers)
	}
	return details, nil
}

func sequenceDdl(ctx context.Context, entry *poolEntry, schema string, name string) (string, error) {
	if entry.versionNumber < 100000 {
		return "", errors.New("script de sequências requer PostgreSQL 10 ou superior")
	}
	oid, kind, err := relationOid(ctx, entry, schema, name)
	if err != nil {
		return "", err
	}
	if kind != "S" {
		return "", fmt.Errorf("%s.%s não é uma sequência", schema, name)
	}

	var sequence postgresFunctions.SequenceDdlInfo
	err = entry.pool.QueryRow(ctx, `
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
	return postgresFunctions.BuildSequenceDdl(sequence), nil
}

func functionDdl(ctx context.Context, entry *poolEntry, oid uint32) (string, error) {
	isProcedureExpression := "false"
	if entry.versionNumber >= 110000 {
		isProcedureExpression = "p.prokind = 'p'"
	}

	var function postgresFunctions.FunctionDdlInfo
	err := entry.pool.QueryRow(ctx, fmt.Sprintf(`
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
	return postgresFunctions.BuildFunctionDdl(function), nil
}

func schemaDdl(ctx context.Context, entry *poolEntry, name string) (string, error) {
	var quotedName, quotedOwner string
	var comment *string
	err := entry.pool.QueryRow(ctx, `
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
	return postgresFunctions.BuildSchemaDdl(quotedName, quotedOwner, comment), nil
}
