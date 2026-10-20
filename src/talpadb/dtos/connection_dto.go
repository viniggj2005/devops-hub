package talpadbDtos

import "docker-manager-go/src/models"

type CreateConnectionInputDto struct {
	Alias         *string `json:"alias,omitempty"`
	Engine        *string `json:"engine,omitempty"`
	Host          string  `json:"host"`
	Port          *int64  `json:"port,omitempty"`
	Database      *string `json:"database,omitempty"`
	Username      string  `json:"username"`
	Password      *string `json:"password,omitempty"`
	SslMode       *string `json:"sslMode,omitempty"`
	ClearPassword bool    `json:"clearPassword,omitempty"`
}

type ConnectionDto struct {
	ID          uint   `json:"id"`
	Alias       string `json:"alias"`
	Engine      string `json:"engine"`
	Host        string `json:"host"`
	Port        int64  `json:"port"`
	Database    string `json:"database"`
	Username    string `json:"username"`
	SslMode     string `json:"sslMode"`
	HasPassword bool   `json:"hasPassword"`
}

type ConnectionTestResultDto struct {
	ServerVersion string  `json:"serverVersion"`
	LatencyMs     float64 `json:"latencyMs"`
}

func connectionEngine(engine string) string {
	if engine == "" {
		return "postgres"
	}
	return engine
}

func ToConnectionDto(model *models.TalpadbConnectionModel) ConnectionDto {
	engine := connectionEngine(model.Engine)
	port := model.Port
	if engine == "sqlite" {
		port = 0
	}
	return ConnectionDto{
		ID:          model.ID,
		Port:        port,
		Host:        model.Host.Plaintext,
		Alias:       model.Alias,
		Engine:      engine,
		SslMode:     model.SslMode,
		Database:    model.Database,
		Username:    model.Username,
		HasPassword: model.Password.Plaintext != "",
	}
}

func ToConnectionDtoList(connections []models.TalpadbConnectionModel) []ConnectionDto {
	list := make([]ConnectionDto, 0, len(connections))
	for index := range connections {
		list = append(list, ToConnectionDto(&connections[index]))
	}
	return list
}
