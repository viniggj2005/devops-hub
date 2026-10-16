package postgresHandlers

import (
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm/clause"

	"docker-manager-go/src/models"
)

const maxDiagramLayoutBytes = 2 << 20

func (handlerStruct *PostgresHandlerStruct) GetDiagramLayout(token string, connectionId uint, database string, schema string) (string, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return "", err
	}

	var layout models.PostgresDiagramLayoutModel
	err = handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("user_id = ? AND connection_id = ? AND database_name = ? AND schema_name = ?", userID, connectionId, database, schema).
		Limit(1).
		Find(&layout).Error
	if err != nil {
		return "", err
	}
	return layout.Layout, nil
}

func (handlerStruct *PostgresHandlerStruct) SaveDiagramLayout(token string, connectionId uint, database string, schema string, layout string) error {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return err
	}
	if _, err := handlerStruct.findConnection(userID, connectionId); err != nil {
		return err
	}
	if len(layout) > maxDiagramLayoutBytes {
		return errors.New("o layout do diagrama é grande demais para ser salvo")
	}
	if !json.Valid([]byte(layout)) {
		return errors.New("layout do diagrama inválido")
	}

	return handlerStruct.upsertDiagramLayout(models.PostgresDiagramLayoutModel{
		Layout:       layout,
		UserID:       userID,
		SchemaName:   schema,
		DatabaseName: database,
		ConnectionID: connectionId,
	})
}

func (handlerStruct *PostgresHandlerStruct) upsertDiagramLayout(record models.PostgresDiagramLayoutModel) error {
	record.UpdatedAt = time.Now()
	return handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "connection_id"}, {Name: "database_name"}, {Name: "schema_name"}},
			DoUpdates: clause.AssignmentColumns([]string{"layout", "updated_at"}),
		}).
		Create(&record).Error
}

func (handlerStruct *PostgresHandlerStruct) deleteDiagramLayoutsIn(userID uint, connectionID uint, database string, schema string) error {
	query := handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("user_id = ? AND connection_id = ? AND database_name = ?", userID, connectionID, database)
	if schema != "" {
		query = query.Where("schema_name = ?", schema)
	}
	return query.Delete(&models.PostgresDiagramLayoutModel{}).Error
}

func (handlerStruct *PostgresHandlerStruct) deleteDiagramLayouts(userID uint, connectionID uint) error {
	return handlerStruct.DataBase.WithContext(handlerStruct.databaseContext()).
		Where("user_id = ? AND connection_id = ?", userID, connectionID).
		Delete(&models.PostgresDiagramLayoutModel{}).Error
}
