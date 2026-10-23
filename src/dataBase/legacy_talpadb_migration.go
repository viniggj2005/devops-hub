package database

import (
	"gorm.io/gorm"
)

const legacyModuleName = "postgres-manager"

const talpadbModuleName = "talpadb"

var legacyTalpadbTables = []struct {
	legacy  string
	current string
}{
	{legacy: "postgres_connection_models", current: "talpadb_connection_models"},
	{legacy: "postgres_diagram_layout_models", current: "talpadb_diagram_layout_models"},
}

func migrateLegacyTalpadbNames(dataBase *gorm.DB) error {
	migrator := dataBase.Migrator()
	for _, table := range legacyTalpadbTables {
		if migrator.HasTable(table.legacy) && !migrator.HasTable(table.current) {
			if err := migrator.RenameTable(table.legacy, table.current); err != nil {
				return err
			}
		}
	}
	if err := dataBase.Exec("DROP INDEX IF EXISTS idx_postgres_diagram_layout").Error; err != nil {
		return err
	}

	if migrator.HasTable("theme_profile_models") {
		if err := dataBase.Exec(
			"UPDATE theme_profile_models SET config = REPLACE(config, ?, ?) WHERE config LIKE ?",
			`"`+legacyModuleName+`"`, `"`+talpadbModuleName+`"`, `%"`+legacyModuleName+`"%`,
		).Error; err != nil {
			return err
		}
	}

	if !migrator.HasTable("general_configs_models") {
		return nil
	}
	return dataBase.Transaction(func(transaction *gorm.DB) error {
		if err := transaction.Exec("PRAGMA ignore_check_constraints = ON").Error; err != nil {
			return err
		}
		defer transaction.Exec("PRAGMA ignore_check_constraints = OFF")
		return transaction.Exec(
			"UPDATE general_configs_models SET module_name = ? WHERE module_name = ?",
			talpadbModuleName, legacyModuleName,
		).Error
	})
}
