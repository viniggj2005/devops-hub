package postgresDtos

import "docker-manager-go/src/models"

type CreatePostgresConnectionInputDto struct {
	Alias         *string `json:"alias,omitempty"`
	Host          string  `json:"host"`
	Port          *int64  `json:"port,omitempty"`
	Database      *string `json:"database,omitempty"`
	Username      string  `json:"username"`
	Password      *string `json:"password,omitempty"`
	SslMode       *string `json:"sslMode,omitempty"`
	ClearPassword bool    `json:"clearPassword,omitempty"`
}

type PostgresConnectionDto struct {
	ID          uint   `json:"id"`
	Alias       string `json:"alias"`
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

func ToPostgresConnectionDto(model *models.PostgresConnectionModel) PostgresConnectionDto {
	return PostgresConnectionDto{
		ID:          model.ID,
		Alias:       model.Alias,
		Host:        model.Host.Plaintext,
		Port:        model.Port,
		Database:    model.Database,
		Username:    model.Username,
		SslMode:     model.SslMode,
		HasPassword: model.Password.Plaintext != "",
	}
}

func ToPostgresConnectionDtoList(connections []models.PostgresConnectionModel) []PostgresConnectionDto {
	list := make([]PostgresConnectionDto, 0, len(connections))
	for index := range connections {
		list = append(list, ToPostgresConnectionDto(&connections[index]))
	}
	return list
}
