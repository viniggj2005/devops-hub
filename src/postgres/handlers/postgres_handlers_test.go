package postgresHandlers

import (
	"bytes"
	"context"
	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	postgresDtos "docker-manager-go/src/postgres/dtos"
	"docker-manager-go/src/types"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

func setupPostgresTestHandlers(test *testing.T) (*PostgresHandlerStruct, *PostgresClientHandlerStruct, string) {
	sessionKey := hex.EncodeToString(bytes.Repeat([]byte{0x99}, 32))
	if err := types.SetSessionKey(sessionKey); err != nil {
		test.Fatalf("unexpected error setting session key: %v", err)
	}

	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(
		&models.UserModel{},
		&models.PostgresConnectionModel{},
		&models.PostgresDiagramLayoutModel{},
	); err != nil {
		test.Fatalf("unexpected error migrating models: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	token, _, err := sessionManager.Create(1)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	ctx := context.Background()
	postgresHandler := NewPostgresHandler(dataBase, sessionManager)
	postgresHandler.Startup(ctx)

	clientHandler := NewPostgresClientHandler(postgresHandler)
	clientHandler.Startup(ctx)

	return postgresHandler, clientHandler, token
}

func TestPostgresConnectionsAndDiagramLayoutsCRUD(test *testing.T) {
	postgresHandler, clientHandler, token := setupPostgresTestHandlers(test)

	if _, err := postgresHandler.CreateConnection("invalid", postgresDtos.CreatePostgresConnectionInputDto{}); err == nil {
		test.Fatalf("expected error with invalid token")
	}

	if _, err := postgresHandler.CreateConnection(token, postgresDtos.CreatePostgresConnectionInputDto{
		Host:     "",
		Username: "postgres",
	}); err == nil {
		test.Fatalf("expected error for empty host")
	}

	if _, err := postgresHandler.CreateConnection(token, postgresDtos.CreatePostgresConnectionInputDto{
		Host:     "localhost",
		Username: "",
	}); err == nil {
		test.Fatalf("expected error for empty username")
	}

	invalidPort := int64(70000)
	if _, err := postgresHandler.CreateConnection(token, postgresDtos.CreatePostgresConnectionInputDto{
		Host:     "localhost",
		Username: "postgres",
		Port:     &invalidPort,
	}); err == nil {
		test.Fatalf("expected error for invalid port")
	}

	invalidSsl := "invalid-ssl"
	if _, err := postgresHandler.CreateConnection(token, postgresDtos.CreatePostgresConnectionInputDto{
		Host:     "localhost",
		Username: "postgres",
		SslMode:  &invalidSsl,
	}); err == nil {
		test.Fatalf("expected error for invalid sslMode")
	}

	alias := "Primary DB"
	password := "supersecret"
	created, err := postgresHandler.CreateConnection(token, postgresDtos.CreatePostgresConnectionInputDto{
		Alias:    &alias,
		Host:     "localhost",
		Username: "postgres",
		Password: &password,
	})
	if err != nil {
		test.Fatalf("unexpected error creating connection: %v", err)
	}
	if created.Port != 5432 || created.Database != "postgres" || created.SslMode != "prefer" || !created.HasPassword {
		test.Fatalf("unexpected created connection defaults: %+v", created)
	}

	allConnections, err := postgresHandler.FindAllConnections(token)
	if err != nil || len(allConnections) != 1 {
		test.Fatalf("expected 1 connection, got %+v, err=%v", allConnections, err)
	}

	fetched, err := postgresHandler.GetConnectionById(token, created.ID)
	if err != nil || fetched.Alias != "Primary DB" {
		test.Fatalf("unexpected GetConnectionById: %+v, err=%v", fetched, err)
	}

	newAlias := "Updated DB"
	updated, err := postgresHandler.UpdateConnection(token, created.ID, postgresDtos.CreatePostgresConnectionInputDto{
		Alias:         &newAlias,
		Host:          "127.0.0.1",
		Username:      "admin",
		ClearPassword: true,
	})
	if err != nil || updated.Alias != "Updated DB" || updated.HasPassword {
		test.Fatalf("unexpected updated connection: %+v, err=%v", updated, err)
	}

	if err := postgresHandler.SaveDiagramLayout(token, created.ID, "postgres", "public", "not-json"); err == nil {
		test.Fatalf("expected error saving invalid JSON diagram layout")
	}

	oversizeLayout := strings.Repeat("a", maxDiagramLayoutBytes+1)
	if err := postgresHandler.SaveDiagramLayout(token, created.ID, "postgres", "public", oversizeLayout); err == nil {
		test.Fatalf("expected error saving oversize diagram layout")
	}

	validLayout := `{"nodes":[{"id":"users","x":10,"y":20}]}`
	if err := postgresHandler.SaveDiagramLayout(token, created.ID, "postgres", "public", validLayout); err != nil {
		test.Fatalf("unexpected error saving diagram layout: %v", err)
	}

	updatedLayout := `{"nodes":[{"id":"users","x":50,"y":60}]}`
	if err := postgresHandler.SaveDiagramLayout(token, created.ID, "postgres", "public", updatedLayout); err != nil {
		test.Fatalf("unexpected error upserting diagram layout: %v", err)
	}

	loadedLayout, err := postgresHandler.GetDiagramLayout(token, created.ID, "postgres", "public")
	if err != nil || loadedLayout != updatedLayout {
		test.Fatalf("unexpected loaded diagram layout: %q, err=%v", loadedLayout, err)
	}

	if err := clientHandler.DisconnectServer(token, created.ID); err != nil {
		test.Fatalf("unexpected DisconnectServer error: %v", err)
	}
	if err := clientHandler.DisconnectAll(token); err != nil {
		test.Fatalf("unexpected DisconnectAll error: %v", err)
	}
	if err := clientHandler.CloseQuerySession(token, "non-existent"); err != nil {
		test.Fatalf("unexpected CloseQuerySession error: %v", err)
	}

	if err := postgresHandler.DeleteConnection(token, created.ID); err != nil {
		test.Fatalf("unexpected error deleting connection: %v", err)
	}

	if err := postgresHandler.DeleteConnection(token, created.ID); err == nil {
		test.Fatalf("expected error deleting already deleted connection")
	}
}

func TestDatabasePreviewAndTableMetaStatements(test *testing.T) {
	_, clientHandler, _ := setupPostgresTestHandlers(test)

	if _, err := clientHandler.PreviewCreateDatabase(postgresDtos.CreateDatabaseInputDto{
		Name:            "",
		ConnectionLimit: -1,
	}); err == nil {
		test.Fatalf("expected error when database name is empty")
	}

	if _, err := clientHandler.PreviewCreateDatabase(postgresDtos.CreateDatabaseInputDto{
		Name:            "app_db",
		ConnectionLimit: -5,
	}); err == nil {
		test.Fatalf("expected error when connection limit is less than -1")
	}

	previewSql, err := clientHandler.PreviewCreateDatabase(postgresDtos.CreateDatabaseInputDto{
		Name:            "app_db",
		Owner:           "postgres",
		Template:        "template0",
		Encoding:        "UTF8",
		Collate:         "en_US.UTF-8",
		Ctype:           "en_US.UTF-8",
		ConnectionLimit: 50,
		Comment:         "Application database",
	})
	if err != nil {
		test.Fatalf("unexpected error previewing create database: %v", err)
	}
	if !strings.Contains(previewSql, `CREATE DATABASE "app_db"`) || !strings.Contains(previewSql, "CONNECTION LIMIT = 50") || !strings.Contains(previewSql, `COMMENT ON DATABASE "app_db" IS 'Application database';`) {
		test.Fatalf("unexpected preview SQL:\n%s", previewSql)
	}

	if cascadeClause(true) != " CASCADE" || cascadeClause(false) != "" {
		test.Fatalf("unexpected cascadeClause result")
	}

	if !isEditableRelation("r") || !isEditableRelation("p") || isEditableRelation("v") {
		test.Fatalf("unexpected isEditableRelation behavior")
	}
	if !isUserColumn(1) || isUserColumn(0) {
		test.Fatalf("unexpected isUserColumn behavior")
	}

	oid, single := singleSourceTable([]postgresDtos.QueryColumnDto{
		{Name: "id", SourceTableOid: 100},
		{Name: "name", SourceTableOid: 100},
	})
	if !single || oid != 100 {
		test.Fatalf("expected single source table 100, got oid=%d single=%v", oid, single)
	}

	_, single = singleSourceTable([]postgresDtos.QueryColumnDto{
		{Name: "id", SourceTableOid: 100},
		{Name: "other", SourceTableOid: 200},
	})
	if single {
		test.Fatalf("expected false when columns come from different tables")
	}

	meta := &tableMeta{
		qualifiedName: `"public"."users"`,
		keys:          []uint16{1},
		columns: map[uint16]string{
			1: `"id"`,
			2: `"name"`,
		},
	}

	idVal := "42"
	nameVal := "Alice"

	deleteSql, deleteParams, err := meta.deleteStatement(postgresDtos.RowChangeDto{
		Key: []postgresDtos.CellValueDto{{Column: 1, Value: &idVal}},
	})
	if err != nil || deleteSql != `DELETE FROM "public"."users" WHERE "id" = $1` || len(deleteParams) != 1 {
		test.Fatalf("unexpected deleteStatement: sql=%q params=%v err=%v", deleteSql, deleteParams, err)
	}

	updateSql, updateParams, err := meta.updateStatement(postgresDtos.RowChangeDto{
		Key:    []postgresDtos.CellValueDto{{Column: 1, Value: &idVal}},
		Values: []postgresDtos.CellValueDto{{Column: 2, Value: &nameVal}},
	})
	if err != nil || updateSql != `UPDATE "public"."users" SET "name" = $1 WHERE "id" = $2` || len(updateParams) != 2 {
		test.Fatalf("unexpected updateStatement: sql=%q params=%v err=%v", updateSql, updateParams, err)
	}

	insertSql, insertParams, err := meta.insertStatement(postgresDtos.RowChangeDto{
		Values: []postgresDtos.CellValueDto{{Column: 2, Value: &nameVal}},
	})
	if err != nil || insertSql != `INSERT INTO "public"."users" ("name") VALUES ($1)` || len(insertParams) != 1 {
		test.Fatalf("unexpected insertStatement: sql=%q params=%v err=%v", insertSql, insertParams, err)
	}

	defaultInsertSql, _, err := meta.insertStatement(postgresDtos.RowChangeDto{})
	if err != nil || defaultInsertSql != `INSERT INTO "public"."users" DEFAULT VALUES` {
		test.Fatalf("unexpected default insertStatement: %q, err=%v", defaultInsertSql, err)
	}

	pgErr := &pgconn.PgError{
		Severity: "ERROR",
		Code:     "23505",
		Message:  "duplicate key value",
		Detail:   "Key (id)=(1) already exists.",
	}
	if describeError(pgErr) != "duplicate key value (Key (id)=(1) already exists.)" {
		test.Fatalf("unexpected describeError for PgError: %s", describeError(pgErr))
	}
	if describeError(errors.New("plain error")) != "plain error" {
		test.Fatalf("unexpected describeError for plain error")
	}

	if clientHandler.builtinTypeName(23) != "int4" || clientHandler.builtinTypeName(1009) != "text[]" {
		test.Fatalf("unexpected builtinTypeName results: 23=%s 1009=%s", clientHandler.builtinTypeName(23), clientHandler.builtinTypeName(1009))
	}
}

