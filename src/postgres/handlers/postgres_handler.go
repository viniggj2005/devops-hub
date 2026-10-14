package postgresHandlers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	postgresDtos "docker-manager-go/src/postgres/dtos"
	postgresFunctions "docker-manager-go/src/postgres/functions"
)

type PostgresHandlerStruct struct {
	DataBase *gorm.DB
	Session  *auth.ManagerStruct
	context  context.Context
	client   *PostgresClientHandlerStruct
}

func NewPostgresHandler(dataBase *gorm.DB, sessionManager *auth.ManagerStruct) *PostgresHandlerStruct {
	return &PostgresHandlerStruct{DataBase: dataBase, Session: sessionManager}
}

func (handlerStruct *PostgresHandlerStruct) Startup(context context.Context) {
	handlerStruct.context = context
}

func (handlerStruct *PostgresHandlerStruct) authenticate(token string) (uint, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return 0, err
	}
	return session.UserID, nil
}

func (handlerStruct *PostgresHandlerStruct) databaseContext() context.Context {
	if handlerStruct.context != nil {
		return handlerStruct.context
	}
	return context.Background()
}

func (handlerStruct *PostgresHandlerStruct) findConnection(userID uint, id uint) (*models.PostgresConnectionModel, error) {
	var connection models.PostgresConnectionModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("id = ? AND user_id = ?", id, userID).
		First(&connection).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("conexão não encontrada")
		}
		return nil, err
	}
	return &connection, nil
}

func applyConnectionInput(connection *models.PostgresConnectionModel, body postgresDtos.CreatePostgresConnectionInputDto) error {
	host := strings.TrimSpace(body.Host)
	if host == "" {
		return errors.New("o campo 'host' é obrigatório")
	}
	username := strings.TrimSpace(body.Username)
	if username == "" {
		return errors.New("o campo 'usuário' é obrigatório")
	}

	var port int64 = 5432
	if body.Port != nil && *body.Port != 0 {
		port = *body.Port
	}
	if port < 1 || port > 65535 {
		return fmt.Errorf("porta inválida: %d", port)
	}

	database := "postgres"
	if body.Database != nil && strings.TrimSpace(*body.Database) != "" {
		database = strings.TrimSpace(*body.Database)
	}

	sslMode := ""
	if body.SslMode != nil {
		sslMode = *body.SslMode
	}
	normalizedSslMode, err := postgresFunctions.NormalizeSslMode(sslMode)
	if err != nil {
		return err
	}

	alias := ""
	if body.Alias != nil {
		alias = strings.TrimSpace(*body.Alias)
	}

	connection.Alias = alias
	connection.Host.Plaintext = host
	connection.Port = port
	connection.Database = database
	connection.Username = username
	connection.SslMode = normalizedSslMode

	if body.ClearPassword {
		connection.Password.Plaintext = ""
	}
	if body.Password != nil && *body.Password != "" {
		connection.Password.Plaintext = *body.Password
	}
	return nil
}

func (handlerStruct *PostgresHandlerStruct) FindAllConnections(token string) ([]postgresDtos.PostgresConnectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	var connections []models.PostgresConnectionModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("user_id = ?", userID).
		Order("alias, id").
		Find(&connections).Error; err != nil {
		return nil, err
	}

	return postgresDtos.ToPostgresConnectionDtoList(connections), nil
}

func (handlerStruct *PostgresHandlerStruct) GetConnectionById(token string, id uint) (*postgresDtos.PostgresConnectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection, err := handlerStruct.findConnection(userID, id)
	if err != nil {
		return nil, err
	}

	dto := postgresDtos.ToPostgresConnectionDto(connection)
	return &dto, nil
}

func (handlerStruct *PostgresHandlerStruct) CreateConnection(token string, body postgresDtos.CreatePostgresConnectionInputDto) (*postgresDtos.PostgresConnectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection := models.PostgresConnectionModel{UserID: userID}
	if err := applyConnectionInput(&connection, body); err != nil {
		return nil, err
	}

	if err := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).Create(&connection).Error; err != nil {
		return nil, fmt.Errorf("erro ao criar conexão: %w", err)
	}

	dto := postgresDtos.ToPostgresConnectionDto(&connection)
	return &dto, nil
}

func (handlerStruct *PostgresHandlerStruct) UpdateConnection(token string, id uint, body postgresDtos.CreatePostgresConnectionInputDto) (*postgresDtos.PostgresConnectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection, err := handlerStruct.findConnection(userID, id)
	if err != nil {
		return nil, err
	}

	if err := applyConnectionInput(connection, body); err != nil {
		return nil, err
	}

	if err := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).Save(connection).Error; err != nil {
		return nil, fmt.Errorf("erro ao atualizar conexão: %w", err)
	}

	if handlerStruct.client != nil {
		handlerStruct.client.closeConnectionResources(userID, id)
	}

	dto := postgresDtos.ToPostgresConnectionDto(connection)
	return &dto, nil
}

func (handlerStruct *PostgresHandlerStruct) DeleteConnection(token string, id uint) error {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return err
	}

	result := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.PostgresConnectionModel{})
	if result.Error != nil {
		return fmt.Errorf("erro ao deletar conexão: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("conexão não encontrada")
	}
	if err := handlerStruct.deleteDiagramLayouts(userID, id); err != nil {
		return fmt.Errorf("conexão excluída, mas os layouts de diagrama não foram removidos: %w", err)
	}

	if handlerStruct.client != nil {
		handlerStruct.client.closeConnectionResources(userID, id)
	}
	return nil
}
