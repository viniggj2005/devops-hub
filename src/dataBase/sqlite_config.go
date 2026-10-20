package database

import (
	"docker-manager-go/src/models"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var (
	DataBase *gorm.DB
	err      error
)

func InitDb() {
	configDir, err := os.UserConfigDir()
	if err != nil {
		log.Fatalf("erro ao obter diretório de configuração do usuário: %v", err)
	}

	appDir := filepath.Join(configDir, "DockerManager")

	if err := os.MkdirAll(appDir, 0o700); err != nil {
		log.Fatalf("erro ao criar diretório do app: %v", err)
	}

	dataBasePath := filepath.Join(appDir, "secure.db")

	dsn := fmt.Sprintf("file:%s?_journal_mode=WAL&_foreign_keys=on", dataBasePath)

	DataBase, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("erro ao abrir banco SQLite: %v", err)
	}

	if err := migrateDatabase(DataBase); err != nil {
		log.Fatalf("erro ao migrar banco: %v", err)
	}
}

func migrateDatabase(dataBase *gorm.DB) error {
	if err := migrateLegacyTalpadbNames(dataBase); err != nil {
		return fmt.Errorf("erro ao renomear dados do TalpaDB: %w", err)
	}
	if err := dataBase.AutoMigrate(
		&models.UserModel{},
		&models.OctohubModel{},
		&models.SshConnectionModel{},
		&models.GithubAccountModel{},
		&models.GitCredentialModel{},
		&models.ThemeProfileModel{},
		&models.GeneralConfigsModel{},
		&models.DockerCredentialsModel{},
		&models.TalpadbConnectionModel{},
		&models.TalpadbDiagramLayoutModel{},
	); err != nil {
		return fmt.Errorf("erro ao migrar modelos: %w", err)
	}
	if err := syncCheckConstraints(dataBase, &models.GeneralConfigsModel{}); err != nil {
		return fmt.Errorf("erro ao atualizar constraints: %w", err)
	}
	return nil
}
