package talpadbEngines

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

const MaxDiagramTables = 400

var ErrUnsupported = errors.New("operação não suportada por este banco")

type Querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type TableColumn struct {
	Position   uint16
	Name       string
	KeyOrder   int
	QuotedName string
}

type Engine interface {
	Name() string
	Label() string
	DriverName() string
	DefaultPort() int64
	DateOnlyAtMidnight() bool
	DataSourceName(params talpadbFunctions.ConnectionParams) (string, error)
	PrepareSession(ctx context.Context, conn Querier) error
	ServerVersion(ctx context.Context, db Querier) (string, error)
	DefaultSchema(ctx context.Context, db Querier) (string, error)
	QuoteIdentifier(name string) string
	Placeholder(position int) string
	NormalizeIdentifier(name string, quoted bool) string
	SplitStatements(script string) []Statement
	ListDatabases(ctx context.Context, db Querier, params talpadbFunctions.ConnectionParams) ([]talpadbDtos.DatabaseDto, error)
	ListSchemas(ctx context.Context, db Querier) ([]talpadbDtos.SchemaDto, error)
	ListSchemaObjects(ctx context.Context, db Querier, schema string) (*talpadbDtos.SchemaObjectsDto, error)
	ListColumns(ctx context.Context, db Querier, schema string, relation string) ([]talpadbDtos.ColumnDto, error)
	TableDetails(ctx context.Context, db Querier, schema string, relation string) (*talpadbDtos.TableDetailsDto, error)
	ObjectDdl(ctx context.Context, db Querier, object talpadbDtos.ObjectReferenceDto) (string, error)
	CompletionSchema(ctx context.Context, db Querier) ([]talpadbDtos.CompletionTableDto, error)
	Diagram(ctx context.Context, db Querier, schema string) (*talpadbDtos.DatabaseDiagramDto, error)
	TableColumns(ctx context.Context, db Querier, schema string, table string) ([]TableColumn, error)
	DropStatement(ctx context.Context, db Querier, input talpadbDtos.DropObjectInputDto) (string, error)
	DefaultValuesInsert(firstColumn string) string
	TransactionState(statement Statement, inTransaction bool) bool
}

var engines = map[string]Engine{
	talpadbFunctions.EngineSqlite: &SqliteEngine{},
	talpadbFunctions.EngineOracle: &OracleEngine{},
}

func ForName(name string) (Engine, error) {
	engine, exists := engines[name]
	if !exists {
		return nil, fmt.Errorf("banco não suportado: %s", name)
	}
	return engine, nil
}

func emptySchemaObjects() *talpadbDtos.SchemaObjectsDto {
	return &talpadbDtos.SchemaObjectsDto{
		Tables:            []talpadbDtos.RelationDto{},
		Views:             []talpadbDtos.RelationDto{},
		MaterializedViews: []talpadbDtos.RelationDto{},
		Sequences:         []talpadbDtos.RelationDto{},
		Functions:         []talpadbDtos.FunctionDto{},
	}
}

func emptyTableDetails(schema string, relation string, kind string) *talpadbDtos.TableDetailsDto {
	return &talpadbDtos.TableDetailsDto{
		Schema:      schema,
		Name:        relation,
		Kind:        kind,
		Columns:     []talpadbDtos.ColumnDto{},
		Indexes:     []talpadbDtos.IndexDto{},
		Constraints: []talpadbDtos.ConstraintDto{},
		Triggers:    []talpadbDtos.TriggerDto{},
	}
}

func scanStrings(rows *sql.Rows) ([]string, error) {
	defer rows.Close()
	values := []string{}
	for rows.Next() {
		var value sql.NullString
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		values = append(values, value.String)
	}
	return values, rows.Err()
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	text := value.String
	return &text
}
