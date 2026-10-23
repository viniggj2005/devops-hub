package talpadbFunctions

import (
	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	"strings"
	"testing"
)

func TestNormalizeSslModeAndBuildConnectionString(test *testing.T) {
	defaultMode, err := NormalizeSslMode("  ")
	if err != nil || defaultMode != "prefer" {
		test.Fatalf("expected default sslMode prefer, got %q, err=%v", defaultMode, err)
	}

	validModes := []string{"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
	for _, mode := range validModes {
		normalized, err := NormalizeSslMode(strings.ToUpper(mode))
		if err != nil || normalized != mode {
			test.Fatalf("expected normalized mode %q, got %q, err=%v", mode, normalized, err)
		}
	}

	if _, err := NormalizeSslMode("invalid-mode"); err == nil {
		test.Fatalf("expected error for invalid SSL mode")
	}

	connectionString := BuildConnectionString(ConnectionParams{
		Host:     "127.0.0.1",
		Port:     5432,
		Database: "my_db",
		Username: "admin",
		Password: "p@ss:word/1",
		SslMode:  "require",
	})
	if !strings.HasPrefix(connectionString, "postgres://admin:") || !strings.Contains(connectionString, "@127.0.0.1:5432/my_db?") || !strings.Contains(connectionString, "sslmode=require") {
		test.Fatalf("unexpected connection string: %s", connectionString)
	}

	noPasswordString := BuildConnectionString(ConnectionParams{
		Host:     "localhost",
		Port:     5432,
		Database: "postgres",
		Username: "postgres",
		SslMode:  "disable",
	})
	if !strings.HasPrefix(noPasswordString, "postgres://postgres@localhost:5432/postgres?") {
		test.Fatalf("unexpected connection string without password: %s", noPasswordString)
	}
}

func TestDdlBuilders(test *testing.T) {
	if QuoteLiteral("O'Reilly") != "'O''Reilly'" {
		test.Fatalf("unexpected QuoteLiteral result: %s", QuoteLiteral("O'Reilly"))
	}

	defaultVal := "now()"
	collation := `"en_US"`
	tableComment := "Users table"
	colComment := "Primary key"
	partitionKey := "RANGE (created_at)"
	tablespace := "pg_default"

	tableDdl := BuildTableDdl(
		RelationDdlInfo{
			QualifiedName: `"public"."users"`,
			QuotedSchema:  `"public"`,
			Kind:          "r",
			Persistence:   "u",
			QuotedOwner:   `"postgres"`,
			Comment:       &tableComment,
			PartitionKey:  &partitionKey,
			Options:       []string{"fillfactor=90"},
			Tablespace:    &tablespace,
		},
		[]talpadbDtos.ColumnDto{
			{QuotedName: `"id"`, DataType: "bigint", Identity: "a", NotNull: true, Comment: &colComment},
			{QuotedName: `"name"`, DataType: "text", Collation: &collation, DefaultValue: &defaultVal},
		},
		[]talpadbDtos.ConstraintDto{
			{QuotedName: `"users_pkey"`, Definition: "PRIMARY KEY (id)", IsLocal: true},
			{QuotedName: `"inherited_chk"`, Definition: "CHECK (id > 0)", IsLocal: false},
		},
		[]talpadbDtos.IndexDto{
			{Name: "users_pkey", QuotedName: `"users_pkey"`, ConstraintBacked: true},
			{Name: "idx_users_name", QuotedName: `"idx_users_name"`, Definition: "CREATE INDEX idx_users_name ON public.users (name)"},
		},
		[]talpadbDtos.TriggerDto{
			{Name: "trg_audit", Definition: "CREATE TRIGGER trg_audit AFTER INSERT ON public.users EXECUTE FUNCTION audit()", Enabled: false},
		},
	)

	expectedTableParts := []string{
		"CREATE UNLOGGED TABLE IF NOT EXISTS \"public\".\"users\"",
		"\"id\" bigint GENERATED ALWAYS AS IDENTITY NOT NULL",
		"CONSTRAINT \"users_pkey\" PRIMARY KEY (id)",
		"PARTITION BY RANGE (created_at)",
		"WITH (\n    fillfactor=90\n)",
		"TABLESPACE pg_default;",
		"COMMENT ON TABLE \"public\".\"users\"\n    IS 'Users table';",
		"CREATE INDEX idx_users_name",
		"-- (trigger desabilitado)",
	}
	for _, part := range expectedTableParts {
		if !strings.Contains(tableDdl, part) {
			test.Fatalf("expected tableDdl to contain %q, got:\n%s", part, tableDdl)
		}
	}

	viewDef := "SELECT 1 AS id;"
	viewDdl := BuildViewDdl(
		RelationDdlInfo{
			QualifiedName:  `"public"."v_test"`,
			QuotedSchema:   `"public"`,
			Kind:           "v",
			QuotedOwner:    `"postgres"`,
			ViewDefinition: &viewDef,
		},
		nil,
		nil,
		nil,
	)
	if !strings.Contains(viewDdl, "CREATE OR REPLACE VIEW \"public\".\"v_test\"") {
		test.Fatalf("unexpected viewDdl:\n%s", viewDdl)
	}

	matViewDdl := BuildViewDdl(
		RelationDdlInfo{
			QualifiedName:  `"public"."mv_test"`,
			QuotedSchema:   `"public"`,
			Kind:           "m",
			QuotedOwner:    `"postgres"`,
			ViewDefinition: &viewDef,
		},
		nil,
		nil,
		nil,
	)
	if !strings.Contains(matViewDdl, "CREATE MATERIALIZED VIEW IF NOT EXISTS \"public\".\"mv_test\"") {
		test.Fatalf("unexpected matViewDdl:\n%s", matViewDdl)
	}

	seqDdl := BuildSequenceDdl(SequenceDdlInfo{
		QualifiedName: `"public"."seq_id"`,
		QuotedOwner:   `"postgres"`,
		DataType:      "bigint",
		Start:         1,
		Increment:     1,
		MinValue:      1,
		MaxValue:      999999,
		Cache:         1,
		Cycle:         true,
	})
	if !strings.Contains(seqDdl, "CREATE SEQUENCE IF NOT EXISTS \"public\".\"seq_id\"") || !strings.Contains(seqDdl, "CYCLE;") {
		test.Fatalf("unexpected seqDdl:\n%s", seqDdl)
	}

	fnDdl := BuildFunctionDdl(FunctionDdlInfo{
		Signature:   `"public"."my_proc"()`,
		IsProcedure: true,
		QuotedOwner: `"postgres"`,
		Definition:  "CREATE PROCEDURE public.my_proc() LANGUAGE sql AS $$ SELECT 1 $$",
	})
	if !strings.Contains(fnDdl, "-- PROCEDURE: \"public\".\"my_proc\"()") || !strings.Contains(fnDdl, "ALTER PROCEDURE") {
		test.Fatalf("unexpected fnDdl:\n%s", fnDdl)
	}

	schemaComment := "Main schema"
	schemaDdl := BuildSchemaDdl(`"public"`, `"postgres"`, &schemaComment)
	if !strings.Contains(schemaDdl, "CREATE SCHEMA IF NOT EXISTS \"public\"") || !strings.Contains(schemaDdl, "COMMENT ON SCHEMA \"public\"") {
		test.Fatalf("unexpected schemaDdl:\n%s", schemaDdl)
	}
}
