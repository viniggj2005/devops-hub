package postgresDtos

import "time"

type ServerDashboardDto struct {
	Version        string             `json:"version" db:"version"`
	ServerVersion  string             `json:"serverVersion" db:"server_version"`
	StartTime      time.Time          `json:"startTime" db:"start_time"`
	UptimeSeconds  int64              `json:"uptimeSeconds" db:"uptime_seconds"`
	MaxConnections int64              `json:"maxConnections" db:"max_connections"`
	CurrentUser    string             `json:"currentUser" db:"user_name"`
	IsSuperuser    bool               `json:"isSuperuser" db:"is_superuser"`
	InRecovery     bool               `json:"inRecovery" db:"in_recovery"`
	SampledAt      float64            `json:"sampledAt" db:"sampled_at"`
	Databases      []DatabaseStatDto  `json:"databases" db:"-"`
	Sessions       []ServerSessionDto `json:"sessions" db:"-"`
}

type DatabaseStatDto struct {
	Name         string `json:"name" db:"name"`
	SizeBytes    *int64 `json:"sizeBytes" db:"size_bytes"`
	Connections  int64  `json:"connections" db:"connections"`
	XactCommit   int64  `json:"xactCommit" db:"xact_commit"`
	XactRollback int64  `json:"xactRollback" db:"xact_rollback"`
	BlocksRead   int64  `json:"blocksRead" db:"blocks_read"`
	BlocksHit    int64  `json:"blocksHit" db:"blocks_hit"`
	TupReturned  int64  `json:"tupReturned" db:"tup_returned"`
	TupFetched   int64  `json:"tupFetched" db:"tup_fetched"`
	TupInserted  int64  `json:"tupInserted" db:"tup_inserted"`
	TupUpdated   int64  `json:"tupUpdated" db:"tup_updated"`
	TupDeleted   int64  `json:"tupDeleted" db:"tup_deleted"`
}

type ServerSessionDto struct {
	Pid                int32    `json:"pid" db:"pid"`
	User               *string  `json:"user" db:"user_name"`
	Database           *string  `json:"database" db:"database"`
	ApplicationName    string   `json:"applicationName" db:"application_name"`
	ClientAddress      *string  `json:"clientAddress" db:"client_address"`
	State              *string  `json:"state" db:"state"`
	WaitEvent          *string  `json:"waitEvent" db:"wait_event"`
	BackendType        *string  `json:"backendType" db:"backend_type"`
	BackendSeconds     *float64 `json:"backendSeconds" db:"backend_seconds"`
	TransactionSeconds *float64 `json:"transactionSeconds" db:"transaction_seconds"`
	QuerySeconds       *float64 `json:"querySeconds" db:"query_seconds"`
	Query              *string  `json:"query" db:"query"`
	IsCurrent          bool     `json:"isCurrent" db:"is_current"`
}
