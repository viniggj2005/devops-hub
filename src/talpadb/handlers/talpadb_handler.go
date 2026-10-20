package talpadbHandlers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

type TalpadbHandlerStruct struct {
	DataBase *gorm.DB
	Session  *auth.ManagerStruct
	context  context.Context
	client   *TalpadbClientHandlerStruct
}

func NewTalpadbHandler(dataBase *gorm.DB, sessionManager *auth.ManagerStruct) *TalpadbHandlerStruct {
	return &TalpadbHandlerStruct{DataBase: dataBase, Session: sessionManager}
}

func (handlerStruct *TalpadbHandlerStruct) ServiceStartup(context context.Context, _ application.ServiceOptions) error {
	handlerStruct.context = context
	return nil
}

func (handlerStruct *TalpadbHandlerStruct) authenticate(token string) (uint, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return 0, err
	}
	return session.UserID, nil
}

func (handlerStruct *TalpadbHandlerStruct) databaseContext() context.Context {
	if handlerStruct.context != nil {
		return handlerStruct.context
	}
	return context.Background()
}

func (handlerStruct *TalpadbHandlerStruct) findConnection(userID uint, id uint) (*models.TalpadbConnectionModel, error) {
	var connection models.TalpadbConnectionModel
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

func trimmedOrDefault(value *string, fallback string) string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return fallback
	}
	return strings.TrimSpace(*value)
}

func resolvePort(port *int64, fallback int64) (int64, error) {
	resolved := fallback
	if port != nil && *port != 0 {
		resolved = *port
	}
	if resolved < 1 || resolved > 65535 {
		return 0, fmt.Errorf("porta inválida: %d", resolved)
	}
	return resolved, nil
}

func applyConnectionInput(connection *models.TalpadbConnectionModel, body talpadbDtos.CreateConnectionInputDto) error {
	engine, err := talpadbFunctions.NormalizeEngine(trimmedOrDefault(body.Engine, ""))
	if err != nil {
		return err
	}

	host := strings.TrimSpace(body.Host)
	if host == "" {
		if engine == talpadbFunctions.EngineSqlite {
			return errors.New("informe o caminho do arquivo SQLite")
		}
		return errors.New("o campo 'host' é obrigatório")
	}
	username := strings.TrimSpace(body.Username)
	if username == "" && engine != talpadbFunctions.EngineSqlite {
		return errors.New("o campo 'usuário' é obrigatório")
	}

	var port int64
	database, sslMode := "", ""
	switch engine {
	case talpadbFunctions.EnginePostgres:
		if port, err = resolvePort(body.Port, 5432); err != nil {
			return err
		}
		database = trimmedOrDefault(body.Database, "postgres")
		if sslMode, err = talpadbFunctions.NormalizeSslMode(trimmedOrDefault(body.SslMode, "")); err != nil {
			return err
		}
	case talpadbFunctions.EngineOracle:
		if port, err = resolvePort(body.Port, 1521); err != nil {
			return err
		}
		database = trimmedOrDefault(body.Database, "")
		if database == "" {
			return errors.New("informe o service name do Oracle")
		}
		if sslMode, err = talpadbFunctions.NormalizeOracleSslMode(trimmedOrDefault(body.SslMode, "")); err != nil {
			return err
		}
	case talpadbFunctions.EngineSqlite:
		username, database, sslMode = "", "main", "disable"
	}

	connection.Port = port
	connection.Engine = engine
	connection.SslMode = sslMode
	connection.Host.Plaintext = host
	connection.Database = database
	connection.Username = username
	connection.Alias = trimmedOrDefault(body.Alias, "")

	if body.ClearPassword || engine == talpadbFunctions.EngineSqlite {
		connection.Password.Plaintext = ""
	}
	if body.Password != nil && *body.Password != "" && engine != talpadbFunctions.EngineSqlite {
		connection.Password.Plaintext = *body.Password
	}
	return nil
}

func (handlerStruct *TalpadbHandlerStruct) FindAllConnections(token string) ([]talpadbDtos.ConnectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	var connections []models.TalpadbConnectionModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("user_id = ?", userID).
		Order("alias, id").
		Find(&connections).Error; err != nil {
		return nil, err
	}

	return talpadbDtos.ToConnectionDtoList(connections), nil
}

func (handlerStruct *TalpadbHandlerStruct) GetConnectionById(token string, id uint) (*talpadbDtos.ConnectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection, err := handlerStruct.findConnection(userID, id)
	if err != nil {
		return nil, err
	}

	dto := talpadbDtos.ToConnectionDto(connection)
	return &dto, nil
}

func (handlerStruct *TalpadbHandlerStruct) CreateConnection(token string, body talpadbDtos.CreateConnectionInputDto) (*talpadbDtos.ConnectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	connection := models.TalpadbConnectionModel{UserID: userID}
	if err := applyConnectionInput(&connection, body); err != nil {
		return nil, err
	}

	if err := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).Create(&connection).Error; err != nil {
		return nil, fmt.Errorf("erro ao criar conexão: %w", err)
	}

	dto := talpadbDtos.ToConnectionDto(&connection)
	return &dto, nil
}

func (handlerStruct *TalpadbHandlerStruct) UpdateConnection(token string, id uint, body talpadbDtos.CreateConnectionInputDto) (*talpadbDtos.ConnectionDto, error) {
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

	dto := talpadbDtos.ToConnectionDto(connection)
	return &dto, nil
}

func (handlerStruct *TalpadbHandlerStruct) DeleteConnection(token string, id uint) error {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return err
	}

	result := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.TalpadbConnectionModel{})
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
