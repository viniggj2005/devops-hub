package postgresDtos

type QuerySessionDto struct {
	SessionId     string `json:"sessionId"`
	Database      string `json:"database"`
	ServerVersion string `json:"serverVersion"`
	BackendPid    uint32 `json:"backendPid"`
}

type QueryColumnDto struct {
	Name     string `json:"name"`
	DataType string `json:"dataType"`
	TypeOid  uint32 `json:"typeOid"`
}

type QueryResultSetDto struct {
	Columns      []QueryColumnDto `json:"columns"`
	Rows         [][]*string      `json:"rows"`
	RowCount     int64            `json:"rowCount"`
	Truncated    bool             `json:"truncated"`
	CommandTag   string           `json:"commandTag"`
	RowsAffected int64            `json:"rowsAffected"`
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
