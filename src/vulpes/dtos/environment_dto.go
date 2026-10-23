package vulpesDtos

type EnvironmentDto struct {
	ID        uint          `json:"id"`
	Name      string        `json:"name"`
	Variables []VariableDto `json:"variables"`
}

type EnvironmentInputDto struct {
	Name      string        `json:"name"`
	Variables []VariableDto `json:"variables"`
}

type ImportResultDto struct {
	Warnings     []string         `json:"warnings"`
	Collections  []CollectionDto  `json:"collections"`
	Environments []EnvironmentDto `json:"environments"`
}
