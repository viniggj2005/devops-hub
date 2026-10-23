package ferretshellDtos

type LocalShellDto struct {
	Id        string `json:"id"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	IsDefault bool   `json:"isDefault"`
}

type LocalTerminalStartDto struct {
	Cols      int    `json:"cols"`
	Rows      int    `json:"rows"`
	ShellId   string `json:"shellId"`
	SessionId string `json:"sessionId"`
}
