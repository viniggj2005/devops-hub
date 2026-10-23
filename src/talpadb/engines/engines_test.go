package talpadbEngines

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
	"time"

	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

func TestSqliteSplitStatements(test *testing.T) {
	engine := &SqliteEngine{}
	script := `SELECT 1; -- comentário; ainda comentário
INSERT INTO t VALUES ('a;b', "x;y");
CREATE TRIGGER trg AFTER INSERT ON t BEGIN
  UPDATE t SET x = CASE WHEN 1 THEN 2 END;
  DELETE FROM u;
END;
/* bloco; */ INSERT INTO t VALUES (1) RETURNING id;
SELECT 2`

	statements := engine.SplitStatements(script)
	if len(statements) != 5 {
		test.Fatalf("expected 5 statements, got %d: %+v", len(statements), statements)
	}
	if statements[1].Text != `INSERT INTO t VALUES ('a;b', "x;y")` || statements[1].ReturnsRows {
		test.Fatalf("unexpected insert statement: %+v", statements[1])
	}
	if !strings.HasPrefix(statements[2].Text, "CREATE TRIGGER") || !strings.HasSuffix(statements[2].Text, "END") {
		test.Fatalf("unexpected trigger statement: %q", statements[2].Text)
	}
	if !statements[3].ReturnsRows || statements[3].Keyword != "INSERT" {
		test.Fatalf("expected RETURNING insert to return rows: %+v", statements[3])
	}
	if !statements[0].ReturnsRows || !statements[4].ReturnsRows {
		test.Fatalf("expected selects to return rows")
	}
	if len(engine.SplitStatements("-- só comentário\n/* nada */")) != 0 {
		test.Fatalf("expected no statements for comments only")
	}
}

func TestOracleSplitStatements(test *testing.T) {
	engine := &OracleEngine{}
	script := `SELECT * FROM dual;
BEGIN
  NULL;
  x := 'a;b';
END;
/
CREATE OR REPLACE PROCEDURE p IS
BEGIN
  NULL;
END;
/
select q'[it's; fine]' from dual
/
UPDATE t SET a = 1`

	statements := engine.SplitStatements(script)
	if len(statements) != 5 {
		test.Fatalf("expected 5 statements, got %d: %+v", len(statements), statements)
	}
	if statements[0].Text != "SELECT * FROM dual" || !statements[0].ReturnsRows {
		test.Fatalf("unexpected first statement: %+v", statements[0])
	}
	if !strings.HasSuffix(statements[1].Text, "END;") || !statements[1].IsBlock || CommandTag(statements[1], 0) != "PL/SQL" {
		test.Fatalf("unexpected anonymous block: %+v", statements[1])
	}
	if !strings.HasSuffix(statements[2].Text, "END;") || CommandTag(statements[2], 0) != "CREATE PROCEDURE" {
		test.Fatalf("unexpected procedure: %+v", statements[2])
	}
	if statements[3].Text != "select q'[it's; fine]' from dual" || !statements[3].ReturnsRows {
		test.Fatalf("unexpected q-quote statement: %+v", statements[3])
	}
	if statements[4].ReturnsRows || CommandTag(statements[4], 3) != "UPDATE 3" {
		test.Fatalf("unexpected update statement: %+v", statements[4])
	}
}

func TestSingleTableDetection(test *testing.T) {
	sqlite := &SqliteEngine{}
	oracle := &OracleEngine{}
	cases := []struct {
		script string
		engine Engine
		schema string
		table  string
		quoted bool
		single bool
	}{
		{script: "SELECT * FROM users WHERE id = 1", engine: sqlite, table: "users", single: true},
		{script: "select a, b from main.users u order by a limit 10", engine: sqlite, schema: "main", table: "users", single: true},
		{script: `SELECT * FROM "Mixed Case" AS m`, engine: sqlite, table: "Mixed Case", quoted: true, single: true},
		{script: "SELECT (SELECT max(id) FROM other) AS biggest, name FROM people", engine: sqlite, table: "people", single: true},
		{script: "SELECT * FROM emp FETCH FIRST 10 ROWS ONLY", engine: oracle, table: "emp", single: true},
		{script: "SELECT * FROM a JOIN b ON a.id = b.id", engine: sqlite},
		{script: "SELECT * FROM a, b", engine: sqlite},
		{script: "SELECT DISTINCT name FROM people", engine: sqlite},
		{script: "SELECT name, count(*) FROM people GROUP BY name", engine: sqlite},
		{script: "SELECT * FROM (SELECT 1)", engine: sqlite},
		{script: "WITH x AS (SELECT 1) SELECT * FROM x", engine: sqlite},
		{script: "SELECT 1", engine: sqlite},
	}
	for _, testCase := range cases {
		statements := testCase.engine.SplitStatements(testCase.script)
		reference, single := statements[0].SingleTable()
		if single != testCase.single {
			test.Fatalf("%q: expected single=%v, got %v", testCase.script, testCase.single, single)
		}
		if single && (reference.Schema != testCase.schema || reference.Name != testCase.table || reference.NameQuoted != testCase.quoted) {
			test.Fatalf("%q: unexpected reference %+v", testCase.script, reference)
		}
	}

	if oracle.NormalizeIdentifier("emp", false) != "EMP" || oracle.NormalizeIdentifier("emp", true) != "emp" {
		test.Fatalf("unexpected oracle identifier normalization")
	}
	if sqlite.NormalizeIdentifier("Emp", false) != "Emp" {
		test.Fatalf("unexpected sqlite identifier normalization")
	}
}

func TestCommandTagsAndTransactions(test *testing.T) {
	engine := &SqliteEngine{}
	tagOf := func(script string, affected int64) string {
		return CommandTag(engine.SplitStatements(script)[0], affected)
	}
	if tagOf("CREATE OR REPLACE VIEW v AS SELECT 1", 0) != "CREATE VIEW" || tagOf("CREATE UNIQUE INDEX i ON t(a)", 0) != "CREATE INDEX" {
		test.Fatalf("unexpected create command tags")
	}
	if tagOf("DELETE FROM t", 4) != "DELETE 4" || tagOf("VACUUM", 0) != "VACUUM" {
		test.Fatalf("unexpected command tags")
	}

	stateAfter := func(script string, current bool) bool {
		return engine.TransactionState(engine.SplitStatements(script)[0], current)
	}
	if !stateAfter("BEGIN", false) || stateAfter("COMMIT", true) || stateAfter("ROLLBACK", true) || !stateAfter("ROLLBACK TO sp", true) {
		test.Fatalf("unexpected sqlite transaction tracking")
	}
	if (&OracleEngine{}).TransactionState(engine.SplitStatements("BEGIN")[0], true) {
		test.Fatalf("oracle sessions are autocommit")
	}
}

func TestOracleTypeNames(test *testing.T) {
	valid := func(value int64) sql.NullInt64 { return sql.NullInt64{Int64: value, Valid: true} }
	cases := map[string]oracleColumnType{
		"VARCHAR2(100 CHAR)": {dataType: "VARCHAR2", charLength: valid(100), dataLength: valid(400), charUsed: sql.NullString{String: "C", Valid: true}},
		"VARCHAR2(50)":       {dataType: "VARCHAR2", charLength: valid(50), dataLength: valid(50), charUsed: sql.NullString{String: "B", Valid: true}},
		"NVARCHAR2(20)":      {dataType: "NVARCHAR2", charLength: valid(20), dataLength: valid(40)},
		"NUMBER(10,2)":       {dataType: "NUMBER", precision: valid(10), scale: valid(2)},
		"NUMBER(5)":          {dataType: "NUMBER", precision: valid(5), scale: valid(0)},
		"INTEGER":            {dataType: "NUMBER", scale: valid(0)},
		"NUMBER":             {dataType: "NUMBER"},
		"RAW(16)":            {dataType: "RAW", dataLength: valid(16)},
		"TIMESTAMP(6)":       {dataType: "TIMESTAMP(6)"},
	}
	for expected, columnType := range cases {
		if got := OracleTypeName(columnType); got != expected {
			test.Fatalf("expected %s, got %s", expected, got)
		}
	}
}

func TestFormatValueAndQuoting(test *testing.T) {
	midnight := time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC)
	if *FormatValue(midnight, true) != "2024-03-01" || *FormatValue(midnight, false) != "2024-03-01 00:00:00" {
		test.Fatalf("unexpected date formatting")
	}
	if *FormatValue(time.Date(2024, 3, 1, 10, 30, 0, 500000000, time.UTC), true) != "2024-03-01 10:30:00.5" {
		test.Fatalf("unexpected timestamp formatting")
	}
	if *FormatValue([]byte{0xff, 0x00}, true) != `\xff00` || *FormatValue([]byte("texto"), true) != "texto" {
		test.Fatalf("unexpected bytes formatting")
	}
	if FormatValue(nil, true) != nil || *FormatValue(int64(42), true) != "42" || *FormatValue(1.5, true) != "1.5" || *FormatValue(true, true) != "true" {
		test.Fatalf("unexpected scalar formatting")
	}

	sqlite := &SqliteEngine{}
	oracle := &OracleEngine{}
	if sqlite.displayName("users") != "users" || sqlite.displayName("order") != `"order"` || sqlite.displayName("Nome Completo") != `"Nome Completo"` {
		test.Fatalf("unexpected sqlite display names")
	}
	if oracle.displayName("EMP") != "EMP" || oracle.displayName("emp") != `"emp"` || oracle.displayName("DATE") != `"DATE"` {
		test.Fatalf("unexpected oracle display names")
	}
	if oracle.QuoteIdentifier(`a"b`) != `"a""b"` || oracle.Placeholder(2) != ":2" || sqlite.Placeholder(2) != "?" {
		test.Fatalf("unexpected quoting or placeholders")
	}
}

func TestConnectionStrings(test *testing.T) {
	if engine, err := talpadbFunctions.NormalizeEngine(" Oracle "); err != nil || engine != "oracle" {
		test.Fatalf("unexpected NormalizeEngine: %s %v", engine, err)
	}
	if engine, err := talpadbFunctions.NormalizeEngine(""); err != nil || engine != "postgres" {
		test.Fatalf("expected postgres as default engine")
	}
	if _, err := talpadbFunctions.NormalizeEngine("mysql"); err == nil {
		test.Fatalf("expected error for unsupported engine")
	}
	if _, err := talpadbFunctions.NormalizeOracleSslMode("prefer"); err == nil {
		test.Fatalf("expected error for unsupported oracle ssl mode")
	}

	url := talpadbFunctions.BuildOracleConnectionString(talpadbFunctions.ConnectionParams{
		Host: "db.local", Port: 1521, Database: "FREEPDB1", Username: "app", Password: "p@ss word", SslMode: "require",
	})
	if !strings.HasPrefix(url, "oracle://app:p@ss%20word@db.local:1521/FREEPDB1?") || !strings.Contains(url, "SSL=enable") {
		test.Fatalf("unexpected oracle url: %s", url)
	}

	if _, err := talpadbFunctions.BuildSqliteConnectionString(talpadbFunctions.ConnectionParams{Host: filepath.Join(test.TempDir(), "missing.db")}); err == nil {
		test.Fatalf("expected error for missing sqlite file")
	}
	if _, err := talpadbFunctions.BuildSqliteConnectionString(talpadbFunctions.ConnectionParams{Host: test.TempDir()}); err == nil {
		test.Fatalf("expected error for sqlite directory")
	}
}
