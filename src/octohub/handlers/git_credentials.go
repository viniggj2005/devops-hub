package octohubHandler

import (
	"fmt"
	"strings"

	"docker-manager-go/src/models"
	octohubDtos "docker-manager-go/src/octohub/dtos"
	"docker-manager-go/src/types"
)

func (handlerStruct *RepositoryHandler) repositoryAuth(userID uint, account *models.GithubAccountModel, repositoryGithubID int64, remoteURL string) gitAuth {
	auth := gitAuth{knownHosts: appKnownHostsFile()}

	var credentials []models.GitCredentialModel
	handlerStruct.DataBase.Where("user_id = ?", userID).Find(&credentials)

	githubHasLogin := false
	for _, credential := range credentials {
		if credential.Password.Plaintext == "" {
			continue
		}
		auth.http = append(auth.http, httpCredential{host: credential.Host, header: basicAuthHeader(credential.Username, credential.Password.Plaintext)})
		githubHasLogin = githubHasLogin || credential.Host == "github.com"
	}
	if account != nil && account.GithubID == repositoryGithubID && !githubHasLogin && account.Token.Plaintext != "" {
		auth.http = append(auth.http, httpCredential{host: "github.com", header: basicAuthHeader(account.Login, account.Token.Plaintext)})
	}

	if host, isSSH := parseRemote(remoteURL); isSSH {
		for _, credential := range credentials {
			if credential.PrivateKey.Plaintext == "" || sshHostname(credential.Host) != sshHostname(host) {
				continue
			}
			if key, err := decodePrivateKey(credential.PrivateKey.Plaintext, credential.Passphrase.Plaintext); err == nil {
				auth.sshKey = key
			}
			break
		}
	}
	return auth
}

func (handlerStruct *RepositoryHandler) refreshAuth(userID uint) {
	account, _, err := handlerStruct.githubScope(userID)
	if err != nil {
		return
	}
	handlerStruct.gitHandler.refreshAuth(func(path string) (gitAuth, bool) {
		var repository models.OctohubModel
		if err := handlerStruct.DataBase.Where("user_id = ? AND local_path = ?", userID, path).Limit(1).Find(&repository).Error; err != nil || repository.ID == 0 {
			return gitAuth{}, false
		}
		return handlerStruct.repositoryAuth(userID, account, repository.GithubID, originURL(path)), true
	})
}

func (handlerStruct *RepositoryHandler) ListGitCredentials(token string) ([]octohubDtos.GitCredentialDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	var credentials []models.GitCredentialModel
	if err := handlerStruct.DataBase.Where("user_id = ?", userID).Order("host").Find(&credentials).Error; err != nil {
		return nil, err
	}
	return octohubDtos.ToGitCredentialDtoList(credentials), nil
}

func (handlerStruct *RepositoryHandler) SaveGitCredential(token string, input octohubDtos.GitCredentialInput) (*octohubDtos.GitCredentialDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	host := normalizeCredentialHost(input.Host)
	if host == "" {
		return nil, fmt.Errorf("informe o servidor, por exemplo gitlab.com")
	}

	var credential models.GitCredentialModel
	if err := handlerStruct.DataBase.Where("user_id = ? AND host = ?", userID, host).Limit(1).Find(&credential).Error; err != nil {
		return nil, err
	}

	if privateKey := strings.TrimSpace(input.PrivateKey); privateKey != "" {
		if _, err := decodePrivateKey(privateKey, input.Passphrase); err != nil {
			return nil, err
		}
		credential.PrivateKey = types.EncryptedString{Plaintext: privateKey + "\n"}
		credential.Passphrase = types.EncryptedString{Plaintext: input.Passphrase}
	}
	if input.Password != "" {
		credential.Password = types.EncryptedString{Plaintext: input.Password}
	}
	if username := strings.TrimSpace(input.Username); username != "" {
		credential.Username = username
	}
	if credential.Password.Plaintext == "" && credential.PrivateKey.Plaintext == "" {
		return nil, fmt.Errorf("informe a senha (ou token) ou uma chave SSH")
	}
	if credential.Password.Plaintext != "" && credential.Username == "" {
		return nil, fmt.Errorf("informe o usuário que acompanha a senha ou o token")
	}

	credential.Host = host
	credential.UserID = userID
	if err := handlerStruct.DataBase.Save(&credential).Error; err != nil {
		return nil, fmt.Errorf("erro ao salvar o login: %w", err)
	}
	handlerStruct.refreshAuth(userID)
	return octohubDtos.ToGitCredentialDto(&credential), nil
}

func (handlerStruct *RepositoryHandler) RemoveGitCredential(token string, credentialID uint) error {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return err
	}
	var credential models.GitCredentialModel
	if err := handlerStruct.DataBase.Where("id = ? AND user_id = ?", credentialID, userID).First(&credential).Error; err != nil {
		return fmt.Errorf("login não encontrado")
	}
	if err := handlerStruct.DataBase.Unscoped().Delete(&credential).Error; err != nil {
		return err
	}
	handlerStruct.refreshAuth(userID)
	return nil
}
