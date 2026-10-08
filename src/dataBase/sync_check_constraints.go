package database

import (
	"strings"

	"gorm.io/gorm"
)

func syncCheckConstraints(dataBase *gorm.DB, models ...any) error {
	migrator := dataBase.Migrator()
	for _, model := range models {
		statement := &gorm.Statement{DB: dataBase}
		if err := statement.Parse(model); err != nil {
			return err
		}
		if !migrator.HasTable(model) {
			continue
		}

		var tableDefinition string
		if err := dataBase.Raw(
			"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
			statement.Schema.Table,
		).Scan(&tableDefinition).Error; err != nil {
			return err
		}

		for name, checkConstraint := range statement.Schema.ParseCheckConstraints() {
			if strings.Contains(tableDefinition, checkConstraint.Constraint) {
				continue
			}
			if migrator.HasConstraint(model, name) {
				if err := migrator.DropConstraint(model, name); err != nil {
					return err
				}
			}
			if err := migrator.CreateConstraint(model, name); err != nil {
				return err
			}
		}
	}
	return nil
}
