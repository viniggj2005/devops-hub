package database

import (
	"docker-manager-go/src/models"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestSyncCheckConstraints(test *testing.T) {
	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}

	err = syncCheckConstraints(dataBase, &models.GeneralConfigsModel{})
	if err != nil {
		test.Fatalf("unexpected error syncing constraints before table exists: %v", err)
	}

	err = dataBase.AutoMigrate(&models.UserModel{}, &models.GeneralConfigsModel{})
	if err != nil {
		test.Fatalf("unexpected error migrating models: %v", err)
	}

	err = syncCheckConstraints(dataBase, &models.GeneralConfigsModel{})
	if err != nil {
		test.Fatalf("unexpected error syncing constraints on existing table: %v", err)
	}

	err = dataBase.Exec("DROP TABLE general_configs_models").Error
	if err != nil {
		test.Fatalf("unexpected error dropping table: %v", err)
	}
	err = dataBase.Exec("CREATE TABLE general_configs_models (id integer primary key, config text, is_active numeric, user_id integer, config_type text, module_name text)").Error
	if err != nil {
		test.Fatalf("unexpected error creating legacy table: %v", err)
	}

	err = syncCheckConstraints(dataBase, &models.GeneralConfigsModel{})
	if err != nil {
		test.Fatalf("unexpected error upgrading check constraints: %v", err)
	}
}

