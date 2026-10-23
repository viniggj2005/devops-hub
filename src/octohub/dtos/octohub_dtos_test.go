package octohubDtos

import (
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	"path/filepath"
	"testing"

	"gorm.io/gorm"
)

func TestOctohubDTOConversions(test *testing.T) {
	accounts := []models.GithubAccountModel{
		{
			Model:     gorm.Model{ID: 1},
			Name:      "Vini",
			Login:     "viniggj2005",
			GithubID:  1001,
			IsActive:  true,
			AvatarURL: "https://example.com/a.png",
		},
	}

	accountDtos := ToGithubAccountDtoList(accounts)
	if len(accountDtos) != 1 || accountDtos[0].Login != "viniggj2005" || !accountDtos[0].IsActive {
		test.Fatalf("unexpected account DTO list: %+v", accountDtos)
	}

	credentials := []models.GitCredentialModel{
		{
			Model:      gorm.Model{ID: 3},
			Host:       "gitlab.com",
			Username:   "vini",
			Password:   types.EncryptedString{Plaintext: "token123"},
			PrivateKey: types.EncryptedString{Plaintext: ""},
		},
	}

	credentialDtos := ToGitCredentialDtoList(credentials)
	if len(credentialDtos) != 1 || !credentialDtos[0].HasPassword || credentialDtos[0].HasKey {
		test.Fatalf("unexpected credential DTO list: %+v", credentialDtos)
	}

	temporaryDir := test.TempDir()
	missingPath := filepath.Join(temporaryDir, "does-not-exist")

	repositories := []models.OctohubModel{
		{Model: gorm.Model{ID: 10}, LocalPath: temporaryDir},
		{Model: gorm.Model{ID: 11}, LocalPath: missingPath},
	}

	repositoryDtos := ToRepositoryDtoList(repositories, temporaryDir)
	if len(repositoryDtos) != 2 {
		test.Fatalf("expected 2 repository DTOs, got %d", len(repositoryDtos))
	}
	if !repositoryDtos[0].Exists || !repositoryDtos[0].IsCurrent {
		test.Fatalf("expected first repo to exist and be current: %+v", repositoryDtos[0])
	}
	if repositoryDtos[1].Exists || repositoryDtos[1].IsCurrent {
		test.Fatalf("expected second repo to not exist and not be current: %+v", repositoryDtos[1])
	}
}

