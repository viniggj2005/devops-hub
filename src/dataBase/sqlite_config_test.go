package database

import (
	"testing"
	"path/filepath"
	"docker-manager-go/src/models"

	"gorm.io/gorm"
	"github.com/glebarez/sqlite"
)

func TestConnectionPragmasAreApplied(test *testing.T) {
	path := filepath.Join(test.TempDir(), "pragmas.db")
	dataBase, err := gorm.Open(sqlite.Open("file:"+path+"?"+connectionPragmas), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	connection, err := dataBase.DB()
	if err != nil {
		test.Fatalf("unexpected error reading sql connection: %v", err)
	}
	defer connection.Close()

	var journalMode string
	if err := dataBase.Raw("PRAGMA journal_mode").Scan(&journalMode).Error; err != nil || journalMode != "wal" {
		test.Fatalf("expected journal_mode wal, got %q err=%v", journalMode, err)
	}

	var busyTimeout int
	if err := dataBase.Raw("PRAGMA busy_timeout").Scan(&busyTimeout).Error; err != nil || busyTimeout != 5000 {
		test.Fatalf("expected busy_timeout 5000, got %d err=%v", busyTimeout, err)
	}

	var synchronous int
	if err := dataBase.Raw("PRAGMA synchronous").Scan(&synchronous).Error; err != nil || synchronous != 1 {
		test.Fatalf("expected synchronous NORMAL (1), got %d err=%v", synchronous, err)
	}
}

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

