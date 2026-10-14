package postgresDtos

type DatabaseDto struct {
	Name         string  `json:"name" db:"name"`
	Owner        string  `json:"owner" db:"owner"`
	Encoding     string  `json:"encoding" db:"encoding"`
	SizeBytes    *int64  `json:"sizeBytes" db:"size_bytes"`
	AllowConnect bool    `json:"allowConnect" db:"allow_connect"`
	Comment      *string `json:"comment" db:"comment"`
}

type SchemaDto struct {
	Name    string  `json:"name" db:"name"`
	Owner   string  `json:"owner" db:"owner"`
	Comment *string `json:"comment" db:"comment"`
}

type RelationDto struct {
	Name          string  `json:"name" db:"name"`
	Kind          string  `json:"kind" db:"kind"`
	EstimatedRows int64   `json:"estimatedRows" db:"estimated_rows"`
	Comment       *string `json:"comment" db:"comment"`
}

type FunctionDto struct {
	Oid        uint32 `json:"oid" db:"oid"`
	Name       string `json:"name" db:"name"`
	Arguments  string `json:"arguments" db:"arguments"`
	ResultType string `json:"resultType" db:"result_type"`
	Kind       string `json:"kind" db:"kind"`
}

type SchemaObjectsDto struct {
	Tables            []RelationDto `json:"tables"`
	Views             []RelationDto `json:"views"`
	MaterializedViews []RelationDto `json:"materializedViews"`
	Sequences         []RelationDto `json:"sequences"`
	Functions         []FunctionDto `json:"functions"`
}

type ColumnDto struct {
	Position     int16   `json:"position" db:"position"`
	Name         string  `json:"name" db:"name"`
	QuotedName   string  `json:"quotedName" db:"quoted_name"`
	DataType     string  `json:"dataType" db:"data_type"`
	NotNull      bool    `json:"notNull" db:"not_null"`
	DefaultValue *string `json:"defaultValue" db:"default_value"`
	IsPrimaryKey bool    `json:"isPrimaryKey" db:"is_primary_key"`
	IsForeignKey bool    `json:"isForeignKey" db:"is_foreign_key"`
	Identity     string  `json:"identity" db:"identity"`
	Generated    string  `json:"generated" db:"generated"`
	Collation    *string `json:"collation" db:"collation"`
	Comment      *string `json:"comment" db:"comment"`
}

type IndexDto struct {
	Name             string `json:"name" db:"name"`
	QuotedName       string `json:"quotedName" db:"quoted_name"`
	Definition       string `json:"definition" db:"definition"`
	IsUnique         bool   `json:"isUnique" db:"is_unique"`
	IsPrimary        bool   `json:"isPrimary" db:"is_primary"`
	SizeBytes        int64  `json:"sizeBytes" db:"size_bytes"`
	ConstraintBacked bool   `json:"constraintBacked" db:"constraint_backed"`
}

type ConstraintDto struct {
	Name       string `json:"name" db:"name"`
	QuotedName string `json:"quotedName" db:"quoted_name"`
	Type       string `json:"type" db:"type"`
	Definition string `json:"definition" db:"definition"`
	IsLocal    bool   `json:"isLocal" db:"is_local"`
}

type TriggerDto struct {
	Name       string `json:"name" db:"name"`
	Definition string `json:"definition" db:"definition"`
	Enabled    bool   `json:"enabled" db:"enabled"`
}

type TableDetailsDto struct {
	Schema         string          `json:"schema"`
	Name           string          `json:"name"`
	Kind           string          `json:"kind"`
	Owner          string          `json:"owner"`
	EstimatedRows  int64           `json:"estimatedRows"`
	TotalSizeBytes int64           `json:"totalSizeBytes"`
	TableSizeBytes int64           `json:"tableSizeBytes"`
	IndexSizeBytes int64           `json:"indexSizeBytes"`
	Comment        *string         `json:"comment"`
	Columns        []ColumnDto     `json:"columns"`
	Indexes        []IndexDto      `json:"indexes"`
	Constraints    []ConstraintDto `json:"constraints"`
	Triggers       []TriggerDto    `json:"triggers"`
	Ddl            string          `json:"ddl"`
}

type ObjectReferenceDto struct {
	Kind   string `json:"kind"`
	Schema string `json:"schema"`
	Name   string `json:"name"`
	Oid    uint32 `json:"oid"`
}

type DatabaseOptionsDto struct {
	Roles           []string `json:"roles"`
	Templates       []string `json:"templates"`
	CurrentUser     string   `json:"currentUser"`
	DefaultCtype    string   `json:"defaultCtype"`
	DefaultCollate  string   `json:"defaultCollate"`
	DefaultEncoding string   `json:"defaultEncoding"`
}

type CreateDatabaseInputDto struct {
	Name            string `json:"name"`
	Owner           string `json:"owner"`
	Ctype           string `json:"ctype"`
	Comment         string `json:"comment"`
	Collate         string `json:"collate"`
	Template        string `json:"template"`
	Encoding        string `json:"encoding"`
	ConnectionLimit int    `json:"connectionLimit"`
}

type DiagramColumnDto struct {
	Name         string `json:"name"`
	NotNull      bool   `json:"notNull"`
	IsUnique     bool   `json:"isUnique"`
	DataType     string `json:"dataType"`
	IsPrimaryKey bool   `json:"isPrimaryKey"`
	IsForeignKey bool   `json:"isForeignKey"`
}

type DiagramTableDto struct {
	Name    string             `json:"name"`
	Kind    string             `json:"kind"`
	Schema  string             `json:"schema"`
	Comment *string            `json:"comment"`
	Columns []DiagramColumnDto `json:"columns"`
}

type DiagramRelationDto struct {
	Name          string   `json:"name" db:"name"`
	SourceTable   string   `json:"sourceTable" db:"source_table"`
	TargetTable   string   `json:"targetTable" db:"target_table"`
	SourceSchema  string   `json:"sourceSchema" db:"source_schema"`
	TargetSchema  string   `json:"targetSchema" db:"target_schema"`
	SourceColumns []string `json:"sourceColumns" db:"source_columns"`
	TargetColumns []string `json:"targetColumns" db:"target_columns"`
}

type DatabaseDiagramDto struct {
	Truncated bool                 `json:"truncated"`
	Tables    []DiagramTableDto    `json:"tables"`
	Relations []DiagramRelationDto `json:"relations"`
}

type CompletionTableDto struct {
	Schema  string   `json:"schema" db:"schema"`
	Name    string   `json:"name" db:"name"`
	Columns []string `json:"columns" db:"columns"`
}
