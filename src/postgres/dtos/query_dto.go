package postgresDtos

type QuerySessionDto struct {
	SessionId     string `json:"sessionId"`
	Database      string `json:"database"`
	ServerVersion string `json:"serverVersion"`
	BackendPid    uint32 `json:"backendPid"`
}

type QueryColumnDto struct {
	Name           string `json:"name"`
	DataType       string `json:"dataType"`
	TypeOid        uint32 `json:"typeOid"`
	SourceTableOid uint32 `json:"-"`
	SourceColumn   uint16 `json:"-"`
}

type EditableTableDto struct {
	Name          string   `json:"name"`
	Schema        string   `json:"schema"`
	TableOid      uint32   `json:"tableOid"`
	KeyColumns    []int    `json:"keyColumns"`
	ColumnNumbers []uint16 `json:"columnNumbers"`
}

type QueryResultSetDto struct {
	Columns      []QueryColumnDto  `json:"columns"`
	Rows         [][]*string       `json:"rows"`
	RowCount     int64             `json:"rowCount"`
	Truncated    bool              `json:"truncated"`
	CommandTag   string            `json:"commandTag"`
	RowsAffected int64             `json:"rowsAffected"`
	Editable     *EditableTableDto `json:"editable"`
}

type CellValueDto struct {
	Column uint16  `json:"column"`
	Value  *string `json:"value"`
}

type RowChangeDto struct {
	Key    []CellValueDto `json:"key"`
	Values []CellValueDto `json:"values"`
}

type TableChangesDto struct {
	TableOid uint32         `json:"tableOid"`
	Updates  []RowChangeDto `json:"updates"`
	Deletes  []RowChangeDto `json:"deletes"`
	Inserts  []RowChangeDto `json:"inserts"`
}

type TableSaveResultDto struct {
	Updated   int    `json:"updated"`
	Deleted   int    `json:"deleted"`
	Inserted  int    `json:"inserted"`
	Committed bool   `json:"committed"`
	TxStatus  string `json:"txStatus"`
}

type QueryMessageDto struct {
	Severity string `json:"severity"`
	Code     string `json:"code"`
	Message  string `json:"message"`
	Detail   string `json:"detail"`
	Hint     string `json:"hint"`
	Where    string `json:"where"`
	Position int32  `json:"position"`
}

type QueryExecutionDto struct {
	ResultSets  []QueryResultSetDto `json:"resultSets"`
	Notices     []QueryMessageDto   `json:"notices"`
	Error       *QueryMessageDto    `json:"error"`
	DurationMs  float64             `json:"durationMs"`
	TxStatus    string              `json:"txStatus"`
	Reconnected bool                `json:"reconnected"`
}

type SqlFileDto struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Content string `json:"content"`
}
