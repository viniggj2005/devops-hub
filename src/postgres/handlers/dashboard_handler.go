package postgresHandlers

import (
	"fmt"

	"github.com/jackc/pgx/v5"

	postgresDtos "docker-manager-go/src/postgres/dtos"
)

const serverOverviewSql = `
SELECT pg_catalog.version() AS version,
       pg_catalog.current_setting('server_version') AS server_version,
       pg_catalog.pg_postmaster_start_time() AS start_time,
       EXTRACT(EPOCH FROM (pg_catalog.now() - pg_catalog.pg_postmaster_start_time()))::bigint AS uptime_seconds,
       pg_catalog.current_setting('max_connections')::bigint AS max_connections,
       CURRENT_USER::text AS user_name,
       COALESCE((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = CURRENT_USER), false) AS is_superuser,
       pg_catalog.pg_is_in_recovery() AS in_recovery,
       EXTRACT(EPOCH FROM pg_catalog.clock_timestamp())::float8 AS sampled_at`

const databaseStatsSql = `
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

func (handlerStruct *PostgresClientHandlerStruct) GetServerDashboard(token string, connectionId uint, includeSizes bool) (*postgresDtos.ServerDashboardDto, error) {
	entry, err := handlerStruct.getPool(token, connectionId, "")
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	rows, err := entry.pool.Query(ctx, serverOverviewSql)
	if err != nil {
		return nil, err
	}
	dashboard, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[postgresDtos.ServerDashboardDto])
	if err != nil {
		return nil, err
	}

	databases, err := collectRows[postgresDtos.DatabaseStatDto](ctx, entry, databaseStatsSql, includeSizes)
	if err != nil && includeSizes {
		databases, err = collectRows[postgresDtos.DatabaseStatDto](ctx, entry, databaseStatsSql, false)
	}
	if err != nil {
		return nil, err
	}
	dashboard.Databases = databases

	waitEventExpression := "NULL::text"
	if entry.versionNumber >= 90600 {
		waitEventExpression = "CASE WHEN a.wait_event IS NOT NULL THEN a.wait_event_type || ': ' || a.wait_event END"
	}
	backendTypeExpression := "NULL::text"
	if entry.versionNumber >= 100000 {
		backendTypeExpression = "a.backend_type"
	}
	sessions, err := collectRows[postgresDtos.ServerSessionDto](ctx, entry, fmt.Sprintf(`
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

func (handlerStruct *PostgresClientHandlerStruct) CancelBackend(token string, connectionId uint, pid int32) (bool, error) {
	return handlerStruct.signalBackend(token, connectionId, "pg_cancel_backend", pid)
}

func (handlerStruct *PostgresClientHandlerStruct) TerminateBackend(token string, connectionId uint, pid int32) (bool, error) {
	return handlerStruct.signalBackend(token, connectionId, "pg_terminate_backend", pid)
}

func (handlerStruct *PostgresClientHandlerStruct) signalBackend(token string, connectionId uint, function string, pid int32) (bool, error) {
	entry, err := handlerStruct.getPool(token, connectionId, "")
	if err != nil {
		return false, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	var signaled bool
	err = entry.pool.QueryRow(ctx, fmt.Sprintf("SELECT pg_catalog.%s($1)", function), pid).Scan(&signaled)
	return signaled, err
}
