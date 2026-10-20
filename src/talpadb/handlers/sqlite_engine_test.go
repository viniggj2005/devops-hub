package talpadbHandlers

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/glebarez/go-sqlite"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
)

const sqliteFixture = `
CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, created DATE DEFAULT '2024-01-01');
CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  title TEXT,
  price REAL CHECK (price >= 0)
);
CREATE INDEX idx_books_title ON books(title);
CREATE VIEW book_titles AS SELECT title FROM books;
CREATE TRIGGER trg_books AFTER INSERT ON books BEGIN UPDATE books SET title = upper(title) WHERE id = NEW.id; END;
INSERT INTO authors (name) VALUES ('Ana'), ('Bruno');
INSERT INTO books (author_id, title, price) VALUES (1, 'go', 10.5);
`

func createSqliteFixture(test *testing.T) string {
	path := filepath.Join(test.TempDir(), "library.db")
	database, err := sql.Open("sqlite", path)
	if err != nil {
		test.Fatalf("unexpected error creating sqlite fixture: %v", err)
	}
	defer database.Close()
	if _, err := database.Exec(sqliteFixture); err != nil {
		test.Fatalf("unexpected error seeding sqlite fixture: %v", err)
	}
	return path
}

func TestSqliteEngineEndToEnd(test *testing.T) {
	talpadbHandler, clientHandler, token := setupTalpadbTestHandlers(test)
	defer clientHandler.closeResourcesAndWait(func(string, *querySession) bool { return true })
	path := createSqliteFixture(test)

	unsupported := "mysql"
	if _, err := talpadbHandler.CreateConnection(token, talpadbDtos.CreateConnectionInputDto{Engine: &unsupported, Host: "x", Username: "y"}); err == nil {
		test.Fatalf("expected error for unsupported engine")
	}

	engine := "sqlite"
	missing := filepath.Join(test.TempDir(), "missing.db")
	if _, err := clientHandler.TestConnection(token, 0, talpadbDtos.CreateConnectionInputDto{Engine: &engine, Host: missing}); err == nil {
		test.Fatalf("expected error testing missing sqlite file")
	}

	result, err := clientHandler.TestConnection(token, 0, talpadbDtos.CreateConnectionInputDto{Engine: &engine, Host: path})
	if err != nil || result.ServerVersion == "" {
		test.Fatalf("unexpected sqlite test result: %+v, err=%v", result, err)
	}

	password := "ignored"
	created, err := talpadbHandler.CreateConnection(token, talpadbDtos.CreateConnectionInputDto{Engine: &engine, Host: path, Password: &password})
	if err != nil {
		test.Fatalf("unexpected error creating sqlite connection: %v", err)
	}
	if created.Engine != "sqlite" || created.Port != 0 || created.Database != "main" || created.Username != "" || created.HasPassword {
		test.Fatalf("unexpected sqlite connection defaults: %+v", created)
	}
	connectionID := created.ID

	databases, err := clientHandler.ListDatabases(token, connectionID)
	if err != nil || len(databases) != 1 || databases[0].Name != "main" || databases[0].SizeBytes == nil || *databases[0].SizeBytes == 0 {
		test.Fatalf("unexpected databases: %+v, err=%v", databases, err)
	}

	schemas, err := clientHandler.ListSchemas(token, connectionID, "main")
	if err != nil || len(schemas) != 1 || schemas[0].Name != "main" {
		test.Fatalf("unexpected schemas: %+v, err=%v", schemas, err)
	}

	objects, err := clientHandler.ListSchemaObjects(token, connectionID, "main", "main")
	if err != nil || len(objects.Tables) != 2 || objects.Tables[0].Name != "authors" || len(objects.Views) != 1 || len(objects.Functions) != 0 {
		test.Fatalf("unexpected schema objects: %+v, err=%v", objects, err)
	}

	columns, err := clientHandler.ListColumns(token, connectionID, "main", "main", "books")
	if err != nil || len(columns) != 4 {
		test.Fatalf("unexpected columns: %+v, err=%v", columns, err)
	}
	if !columns[0].IsPrimaryKey || columns[0].Identity != "d" || !columns[1].IsForeignKey || !columns[1].NotNull || columns[2].NotNull {
		test.Fatalf("unexpected column flags: %+v", columns)
	}

	details, err := clientHandler.GetTableDetails(token, connectionID, "main", "main", "books")
	if err != nil {
		test.Fatalf("unexpected error loading table details: %v", err)
	}
	if details.Kind != "r" || details.EstimatedRows != 1 || len(details.Triggers) != 1 || !strings.Contains(details.Ddl, "CREATE TABLE books") || !strings.Contains(details.Ddl, "CREATE INDEX idx_books_title") {
		test.Fatalf("unexpected table details: %+v", details)
	}
	constraintTypes := ""
	for _, constraint := range details.Constraints {
		constraintTypes += constraint.Type
	}
	if constraintTypes != "pf" {
		test.Fatalf("unexpected constraints: %+v", details.Constraints)
	}
	foundIndex := false
	for _, index := range details.Indexes {
		foundIndex = foundIndex || (index.Name == "idx_books_title" && !index.ConstraintBacked)
	}
	if !foundIndex {
		test.Fatalf("expected idx_books_title in indexes: %+v", details.Indexes)
	}

	authorDetails, err := clientHandler.GetTableDetails(token, connectionID, "main", "main", "authors")
	if err != nil || len(authorDetails.Constraints) != 2 || authorDetails.Constraints[1].Type != "u" {
		test.Fatalf("unexpected author constraints: %+v, err=%v", authorDetails, err)
	}

	viewDdl, err := clientHandler.GetObjectDdl(token, connectionID, "main", talpadbDtos.ObjectReferenceDto{Kind: "view", Schema: "main", Name: "book_titles"})
	if err != nil || !strings.Contains(viewDdl, "CREATE VIEW book_titles") {
		test.Fatalf("unexpected view ddl: %q, err=%v", viewDdl, err)
	}
	if _, err := clientHandler.GetObjectDdl(token, connectionID, "main", talpadbDtos.ObjectReferenceDto{Kind: "sequence", Schema: "main", Name: "x"}); err == nil {
		test.Fatalf("expected error for unsupported sqlite ddl kind")
	}

	if count, err := clientHandler.CountRows(token, connectionID, "main", "main", "authors"); err != nil || count != 2 {
		test.Fatalf("unexpected count: %d, err=%v", count, err)
	}

	completion, err := clientHandler.GetCompletionSchema(token, connectionID, "main")
	if err != nil || len(completion) != 3 || completion[1].Name != "book_titles" || len(completion[2].Columns) != 4 {
		test.Fatalf("unexpected completion schema: %+v, err=%v", completion, err)
	}

	diagram, err := clientHandler.GetDatabaseDiagram(token, connectionID, "main", "")
	if err != nil || len(diagram.Tables) != 2 || len(diagram.Relations) != 1 {
		test.Fatalf("unexpected diagram: %+v, err=%v", diagram, err)
	}
	relation := diagram.Relations[0]
	if relation.SourceTable != "books" || relation.TargetTable != "authors" || relation.SourceColumns[0] != "author_id" || relation.TargetColumns[0] != "id" {
		test.Fatalf("unexpected diagram relation: %+v", relation)
	}
	if !diagram.Tables[0].Columns[1].IsUnique {
		test.Fatalf("expected authors.name to be unique in diagram: %+v", diagram.Tables[0].Columns)
	}

	dropView := talpadbDtos.DropObjectInputDto{Kind: "relation", Schema: "main", Name: "book_titles"}
	if preview, err := clientHandler.PreviewDropObject(token, connectionID, "main", dropView); err != nil || preview != `DROP VIEW "main"."book_titles";` {
		test.Fatalf("unexpected drop preview: %q, err=%v", preview, err)
	}
	if _, err := clientHandler.PreviewDropObject(token, connectionID, "main", talpadbDtos.DropObjectInputDto{Kind: "database", Name: "main"}); err == nil {
		test.Fatalf("expected error dropping sqlite database")
	}

	if _, err := clientHandler.GetServerDashboard(token, connectionID, false); err == nil || !strings.Contains(err.Error(), "PostgreSQL") {
		test.Fatalf("expected postgres-only error for dashboard, got %v", err)
	}

	session, err := clientHandler.OpenQuerySession(token, connectionID, "main")
	if err != nil || session.Engine != "sqlite" || session.ServerVersion == "" {
		test.Fatalf("unexpected query session: %+v, err=%v", session, err)
	}

	execution, err := clientHandler.ExecuteQuery(token, session.SessionId, "SELECT * FROM authors ORDER BY id; SELECT count(*) AS total FROM books", 100)
	if err != nil || execution.Error != nil || len(execution.ResultSets) != 2 {
		test.Fatalf("unexpected execution: %+v, err=%v", execution, err)
	}
	authors := execution.ResultSets[0]
	if authors.CommandTag != "SELECT 2" || *authors.Rows[0][1] != "Ana" || *authors.Rows[0][2] != "2024-01-01" {
		test.Fatalf("unexpected authors result: %+v", authors)
	}
	if authors.Editable == nil || authors.Editable.KeyColumns[0] != 0 || authors.Editable.ColumnNumbers[1] != 2 {
		test.Fatalf("expected editable authors result: %+v", authors.Editable)
	}
	if execution.ResultSets[1].Editable != nil {
		test.Fatalf("aggregate result should not be editable")
	}

	firstID, secondID, missingID, newName, insertedName := "1", "2", "99", "Ana Maria", "Carla"
	saved, err := clientHandler.SaveTableChanges(token, session.SessionId, talpadbDtos.TableChangesDto{
		TableOid: authors.Editable.TableOid,
		Updates:  []talpadbDtos.RowChangeDto{{Key: []talpadbDtos.CellValueDto{{Column: 1, Value: &firstID}}, Values: []talpadbDtos.CellValueDto{{Column: 2, Value: &newName}}}},
		Deletes:  []talpadbDtos.RowChangeDto{{Key: []talpadbDtos.CellValueDto{{Column: 1, Value: &secondID}}}},
		Inserts:  []talpadbDtos.RowChangeDto{{Values: []talpadbDtos.CellValueDto{{Column: 2, Value: &insertedName}}}},
	})
	if err != nil || !saved.Committed || saved.Updated != 1 || saved.Deleted != 1 || saved.Inserted != 1 || saved.TxStatus != "idle" {
		test.Fatalf("unexpected save result: %+v, err=%v", saved, err)
	}

	if _, err := clientHandler.SaveTableChanges(token, session.SessionId, talpadbDtos.TableChangesDto{
		TableOid: authors.Editable.TableOid,
		Deletes:  []talpadbDtos.RowChangeDto{{Key: []talpadbDtos.CellValueDto{{Column: 1, Value: &missingID}}}},
	}); err == nil || !strings.Contains(err.Error(), "Nada foi salvo") {
		test.Fatalf("expected error deleting missing row, got %v", err)
	}

	transaction, err := clientHandler.ExecuteQuery(token, session.SessionId, "BEGIN; UPDATE authors SET name = 'Temporário' WHERE id = 1", 100)
	if err != nil || transaction.Error != nil || transaction.TxStatus != "transaction" || transaction.ResultSets[1].CommandTag != "UPDATE 1" {
		test.Fatalf("unexpected transaction execution: %+v, err=%v", transaction, err)
	}
	rollback, err := clientHandler.ExecuteQuery(token, session.SessionId, "ROLLBACK; SELECT name FROM authors WHERE id = 1", 100)
	if err != nil || rollback.TxStatus != "idle" || *rollback.ResultSets[1].Rows[0][0] != "Ana Maria" {
		test.Fatalf("unexpected rollback execution: %+v, err=%v", rollback, err)
	}

	triggered, err := clientHandler.ExecuteQuery(token, session.SessionId, "INSERT INTO books (author_id, title) VALUES (1, 'sql'); SELECT title FROM books ORDER BY id DESC LIMIT 1", 100)
	if err != nil || triggered.ResultSets[0].CommandTag != "INSERT 1" || *triggered.ResultSets[1].Rows[0][0] != "SQL" {
		test.Fatalf("unexpected trigger execution: %+v, err=%v", triggered, err)
	}

	failed, err := clientHandler.ExecuteQuery(token, session.SessionId, "SELECT 1; SELECT * FROM missing_table; SELECT 2", 100)
	if err != nil || failed.Error == nil || len(failed.ResultSets) != 1 || !strings.Contains(failed.Error.Message, "missing_table") {
		test.Fatalf("expected error result for missing table: %+v, err=%v", failed, err)
	}

	truncated, err := clientHandler.ExecuteQuery(token, session.SessionId, "SELECT * FROM authors", 1)
	if err != nil || !truncated.ResultSets[0].Truncated || truncated.ResultSets[0].RowCount != 2 || len(truncated.ResultSets[0].Rows) != 1 {
		test.Fatalf("unexpected truncated result: %+v, err=%v", truncated, err)
	}

	if err := clientHandler.CancelQuery(token, session.SessionId); err != nil {
		test.Fatalf("unexpected cancel error: %v", err)
	}
	if err := clientHandler.CloseQuerySession(token, session.SessionId); err != nil {
		test.Fatalf("unexpected close session error: %v", err)
	}

	if err := clientHandler.DropObject(token, connectionID, "main", dropView); err != nil {
		test.Fatalf("unexpected error dropping view: %v", err)
	}
	objects, err = clientHandler.ListSchemaObjects(token, connectionID, "main", "main")
	if err != nil || len(objects.Views) != 0 {
		test.Fatalf("expected view to be dropped: %+v, err=%v", objects, err)
	}

	clientHandler.closeResourcesAndWait(func(string, *querySession) bool { return true })
	if err := talpadbHandler.DeleteConnection(token, connectionID); err != nil {
		test.Fatalf("unexpected error deleting sqlite connection: %v", err)
	}
}

func TestOracleConnectionValidation(test *testing.T) {
	talpadbHandler, _, token := setupTalpadbTestHandlers(test)
	engine := "oracle"

	if _, err := talpadbHandler.CreateConnection(token, talpadbDtos.CreateConnectionInputDto{Engine: &engine, Host: "db", Username: "app"}); err == nil {
		test.Fatalf("expected error without oracle service name")
	}
	invalidSsl := "prefer"
	service := "FREEPDB1"
	if _, err := talpadbHandler.CreateConnection(token, talpadbDtos.CreateConnectionInputDto{Engine: &engine, Host: "db", Username: "app", Database: &service, SslMode: &invalidSsl}); err == nil {
		test.Fatalf("expected error for invalid oracle ssl mode")
	}

	created, err := talpadbHandler.CreateConnection(token, talpadbDtos.CreateConnectionInputDto{Engine: &engine, Host: "db", Username: "app", Database: &service})
	if err != nil {
		test.Fatalf("unexpected error creating oracle connection: %v", err)
	}
	if created.Engine != "oracle" || created.Port != 1521 || created.Database != "FREEPDB1" || created.SslMode != "disable" {
		test.Fatalf("unexpected oracle defaults: %+v", created)
	}
}
