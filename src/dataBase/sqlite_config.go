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

	if err := DataBase.AutoMigrate(
		&models.UserModel{},
		&models.OctohubModel{},
		&models.SshConnectionModel{},
		&models.GithubAccountModel{},
		&models.GitCredentialModel{},
		&models.ThemeProfileModel{},
		&models.GeneralConfigsModel{},
		&models.DockerCredentialsModel{},
		&models.PostgresConnectionModel{},
		&models.PostgresDiagramLayoutModel{},
	); err != nil {
		log.Fatalf("erro ao migrar modelos: %v", err)
	}

	if err := syncCheckConstraints(DataBase, &models.GeneralConfigsModel{}); err != nil {
		log.Fatalf("erro ao atualizar constraints: %v", err)
	}
}
