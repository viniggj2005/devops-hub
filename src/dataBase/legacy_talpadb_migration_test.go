package database

import (
	"docker-manager-go/src/models"
	"path/filepath"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func createLegacyDatabase(test *testing.T) *gorm.DB {
	dataBase, err := gorm.Open(sqlite.Open(filepath.Join(test.TempDir(), "legacy.db")), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	connectionPool, err := dataBase.DB()
	if err != nil {
		test.Fatalf("unexpected error reading connection pool: %v", err)
	}
	test.Cleanup(func() { connectionPool.Close() })

	if err := dataBase.AutoMigrate(&models.UserModel{}, &models.ThemeProfileModel{}, &models.GeneralConfigsModel{}, &models.TalpadbConnectionModel{}, &models.TalpadbDiagramLayoutModel{}); err != nil {
		test.Fatalf("unexpected error migrating models: %v", err)
	}
	var generalConfigsTable string
	dataBase.Raw("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'general_configs_models'").Scan(&generalConfigsTable)
	legacyGeneralConfigsTable := strings.Replace(generalConfigsTable, "'talpadb'", "'postgres-manager'", 1)
	if legacyGeneralConfigsTable == generalConfigsTable {
		test.Fatalf("expected talpadb in the general configs check constraint: %s", generalConfigsTable)
	}

	statements := []string{
		"DROP TABLE general_configs_models",
		"ALTER TABLE talpadb_connection_models RENAME TO postgres_connection_models",
		"ALTER TABLE talpadb_diagram_layout_models RENAME TO postgres_diagram_layout_models",
		"DROP INDEX idx_talpadb_diagram_layout",
		"CREATE UNIQUE INDEX idx_postgres_diagram_layout ON postgres_diagram_layout_models (schema_name, user_id, database_name, connection_id)",
		legacyGeneralConfigsTable,
		"INSERT INTO user_models (id, name, email, password) VALUES (1, 'Ana', 'ana@example.com', 'hash')",
		"INSERT INTO postgres_connection_models (id, alias, host, user_id) VALUES (7, 'Produção', x'00', 1)",
		"INSERT INTO postgres_diagram_layout_models (layout, created_at, updated_at, schema_name, user_id, database_name, connection_id) VALUES ('{}', 0, 0, 'public', 1, 'app', 7)",
		`INSERT INTO general_configs_models (config, user_id, config_type, module_name) VALUES ('{"mode":"dark"}', 1, 'theme', 'postgres-manager')`,
		`INSERT INTO theme_profile_models (name, config, user_id) VALUES ('Noite', '{"modules":{"postgres-manager":{"theme":"dark"}}}', 1)`,
	}
	for _, statement := range statements {
		if err := dataBase.Exec(statement).Error; err != nil {
			test.Fatalf("unexpected error preparing legacy database (%s): %v", statement, err)
		}
	}
	return dataBase
}

func TestMigrateLegacyTalpadbNames(test *testing.T) {
	dataBase := createLegacyDatabase(test)

	if err := migrateDatabase(dataBase); err != nil {
		test.Fatalf("unexpected error migrating legacy database: %v", err)
	}
	if err := migrateDatabase(dataBase); err != nil {
		test.Fatalf("expected migration to be idempotent: %v", err)
	}

	migrator := dataBase.Migrator()
	if migrator.HasTable("postgres_connection_models") || migrator.HasTable("postgres_diagram_layout_models") {
		test.Fatalf("expected legacy tables to be renamed")
	}

	var alias string
	if err := dataBase.Raw("SELECT alias FROM talpadb_connection_models WHERE id = 7").Scan(&alias).Error; err != nil || alias != "Produção" {
		test.Fatalf("expected connection to survive the rename: %q, err=%v", alias, err)
	}

	var layoutTable string
	dataBase.Raw("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'talpadb_diagram_layout_models'").Scan(&layoutTable)
	if !strings.Contains(layoutTable, "talpadb_connection_models") || strings.Contains(layoutTable, "postgres_connection_models") {
		test.Fatalf("expected layout foreign key to follow the rename:\n%s", layoutTable)
	}
	var layoutCount int64
	dataBase.Model(&models.TalpadbDiagramLayoutModel{}).Where("connection_id = ?", 7).Count(&layoutCount)
	if layoutCount != 1 {
		test.Fatalf("expected diagram layout to survive, got %d", layoutCount)
	}
	var legacyIndexCount int64
	dataBase.Raw("SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_postgres_diagram_layout'").Scan(&legacyIndexCount)
	if legacyIndexCount != 0 {
		test.Fatalf("expected legacy diagram index to be dropped")
	}

	var config models.GeneralConfigsModel
	if err := dataBase.Where("user_id = ?", 1).First(&config).Error; err != nil || config.ModuleName != models.TalpaDB {
		test.Fatalf("expected module config to be renamed: %+v, err=%v", config, err)
	}
	if err := dataBase.Exec(`INSERT INTO general_configs_models (config, user_id, config_type, module_name) VALUES ('{}', 1, 'user', 'postgres-manager')`).Error; err == nil {
		test.Fatalf("expected legacy module name to be rejected by the updated check constraint")
	}

	var profile models.ThemeProfileModel
	if err := dataBase.First(&profile).Error; err != nil || profile.Config != `{"modules":{"talpadb":{"theme":"dark"}}}` {
		test.Fatalf("expected theme profile modules to be renamed: %+v, err=%v", profile, err)
	}
}
