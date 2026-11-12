package talpadbHandlers

import (
	"time"
	"errors"
	"strings"
	"encoding/json"

	"gorm.io/gorm"

	"docker-manager-go/src/appErrors"
	"docker-manager-go/src/models"
	talpadbDtos "docker-manager-go/src/talpadb/dtos"
)

const maxSavedQueryBytes = 1 << 20

func parseQueryVariablesJson(rawVariables string) []talpadbDtos.QueryVariableDto {
	if strings.TrimSpace(rawVariables) == "" {
		return []talpadbDtos.QueryVariableDto{}
	}
	var parsedVariables []talpadbDtos.QueryVariableDto
	if err := json.Unmarshal([]byte(rawVariables), &parsedVariables); err != nil {
		return []talpadbDtos.QueryVariableDto{}
	}
	if parsedVariables == nil {
		return []talpadbDtos.QueryVariableDto{}
	}
	return parsedVariables
}

func toSavedQueryDto(record models.TalpadbSavedQueryModel) talpadbDtos.SavedQueryDto {
	return talpadbDtos.SavedQueryDto{
		ID:           record.ID,
		Sql:          record.Sql,
		Name:         record.Name,
		DatabaseName: record.DatabaseName,
		ConnectionID: record.ConnectionID,
		Variables:    parseQueryVariablesJson(record.Variables),
		UpdatedAt:    record.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func (handlerStruct *TalpadbHandlerStruct) ListSavedQueries(token string, connectionId uint, database string) ([]talpadbDtos.SavedQueryDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	if _, err := handlerStruct.findConnection(userID, connectionId); err != nil {
		return nil, err
	}

	var records []models.TalpadbSavedQueryModel
	query := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("user_id = ? AND connection_id = ?", userID, connectionId)

	trimmedDatabase := strings.TrimSpace(database)
	if trimmedDatabase != "" {
		query = query.Where("database_name = ? OR database_name = ''", trimmedDatabase)
	}

	if err := query.Order("updated_at DESC, name ASC, id DESC").Find(&records).Error; err != nil {
		return nil, appErrors.Wrap("talpadb.listSavedQueriesFailed", "erro ao listar queries salvas", err)
	}

	results := make([]talpadbDtos.SavedQueryDto, len(records))
	for recordIndex, record := range records {
		results[recordIndex] = toSavedQueryDto(record)
	}
	return results, nil
}

func (handlerStruct *TalpadbHandlerStruct) SaveQuery(token string, input talpadbDtos.SaveQueryInputDto) (*talpadbDtos.SavedQueryDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	if _, err := handlerStruct.findConnection(userID, input.ConnectionID); err != nil {
		return nil, err
	}

	trimmedName := strings.TrimSpace(input.Name)
	if trimmedName == "" {
		return nil, appErrors.New("talpadb.savedQueryNameRequired", "informe um nome para salvar a query")
	}
	if len(input.Sql) > maxSavedQueryBytes {
		return nil, appErrors.New("talpadb.savedQueryTooLarge", "a query SQL é grande demais para ser salva")
	}

	variablesSlice := input.Variables
	if variablesSlice == nil {
		variablesSlice = []talpadbDtos.QueryVariableDto{}
	}
	encodedVariables, err := json.Marshal(variablesSlice)
	if err != nil {
		return nil, appErrors.Wrap("talpadb.serializeVariablesFailed", "erro ao serializar variáveis da query", err)
	}
	if len(encodedVariables) > maxSavedQueryBytes {
		return nil, appErrors.New("talpadb.savedQueryVariablesTooLarge", "as variáveis da query são grandes demais para serem salvas")
	}

	trimmedDatabase := strings.TrimSpace(input.DatabaseName)
	databaseSession := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext())

	var existingRecord models.TalpadbSavedQueryModel
	foundExisting := false

	if input.ID != nil && *input.ID > 0 {
		lookupError := databaseSession.
			Where("id = ? AND user_id = ? AND connection_id = ?", *input.ID, userID, input.ConnectionID).
			First(&existingRecord).Error
		if lookupError == nil {
			foundExisting = true
		} else if !errors.Is(lookupError, gorm.ErrRecordNotFound) {
			return nil, appErrors.Wrap("talpadb.findSavedQueryFailed", "erro ao buscar query salva", lookupError)
		}
	}

	if !foundExisting {
		lookupByNameError := databaseSession.
			Where("user_id = ? AND connection_id = ? AND database_name = ? AND LOWER(name) = LOWER(?)", userID, input.ConnectionID, trimmedDatabase, trimmedName).
			First(&existingRecord).Error
		if lookupByNameError == nil {
			foundExisting = true
		} else if !errors.Is(lookupByNameError, gorm.ErrRecordNotFound) {
			return nil, appErrors.Wrap("talpadb.checkSavedQueryNameFailed", "erro ao verificar nome da query salva", lookupByNameError)
		}
	}

	if foundExisting {
		existingRecord.Sql = input.Sql
		existingRecord.Name = trimmedName
		existingRecord.UpdatedAt = time.Now()
		existingRecord.DatabaseName = trimmedDatabase
		existingRecord.Variables = string(encodedVariables)

		if err := databaseSession.Save(&existingRecord).Error; err != nil {
			return nil, appErrors.Wrap("talpadb.updateSavedQueryFailed", "erro ao atualizar query salva", err)
		}
		dto := toSavedQueryDto(existingRecord)
		return &dto, nil
	}

	newRecord := models.TalpadbSavedQueryModel{
		Sql:          input.Sql,
		UserID:       userID,
		Name:         trimmedName,
		DatabaseName: trimmedDatabase,
		ConnectionID: input.ConnectionID,
		Variables:    string(encodedVariables),
	}
	if err := databaseSession.Create(&newRecord).Error; err != nil {
		return nil, appErrors.Wrap("talpadb.saveQueryFailed", "erro ao salvar query", err)
	}

	dto := toSavedQueryDto(newRecord)
	return &dto, nil
}

func (handlerStruct *TalpadbHandlerStruct) DeleteSavedQuery(token string, id uint) error {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return err
	}

	result := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.TalpadbSavedQueryModel{})
	if result.Error != nil {
		return appErrors.Wrap("talpadb.deleteSavedQueryFailed", "erro ao excluir query salva", result.Error)
	}
	if result.RowsAffected == 0 {
		return appErrors.New("talpadb.savedQueryNotFound", "query salva não encontrada")
	}
	return nil
}

func (handlerStruct *TalpadbHandlerStruct) deleteSavedQueries(userID uint, connectionID uint) error {
	return handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("user_id = ? AND connection_id = ?", userID, connectionID).
		Delete(&models.TalpadbSavedQueryModel{}).Error
}

