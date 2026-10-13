package octohubHandler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"docker-manager-go/src/models"
	"docker-manager-go/src/processes"
	octohubDtos "docker-manager-go/src/octohub/dtos"
)

var repositoryNameRegex = regexp.MustCompile(`^[\w.-]+$`)

type githubOrganization struct {
	Login string `json:"login"`
}

type githubCreateRepositoryRequest struct {
	Name        string `json:"name"`
	Private     bool   `json:"private"`
	Description string `json:"description,omitempty"`
}

type githubAPIError struct {
	Message string `json:"message"`
	Errors  []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func validRepositoryName(name string) bool {
	return repositoryNameRegex.MatchString(name) && name != "." && name != ".."
}

func runGitIn(folder string, args ...string) error {
	out, err := processes.Command("git", append([]string{"-C", folder}, args...)...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("git %s: %s", args[0], strings.TrimSpace(string(out)))
	}
	return nil
}

func (handlerStruct *RepositoryHandler) CreateRepository(token, parentFolder, name string, withReadme bool) (*octohubDtos.RepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	account, _, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}

	name = strings.TrimSpace(name)
	if !validRepositoryName(name) {
		return nil, fmt.Errorf("nome inválido: use apenas letras, números, '-', '_' e '.'")
	}
	if strings.TrimSpace(parentFolder) == "" {
		return nil, fmt.Errorf("escolha a pasta de destino")
	}
	destination := filepath.Join(parentFolder, name)
	if entries, err := os.ReadDir(destination); err == nil && len(entries) > 0 {
		return nil, fmt.Errorf("a pasta %s já existe e não está vazia", destination)
	}
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return nil, fmt.Errorf("erro ao criar a pasta %s: %w", destination, err)
	}
	if err := runGitIn(destination, "init", "-b", "main"); err != nil {
		return nil, err
	}

	var commitErr error
	if withReadme {
		readme := filepath.Join(destination, "README.md")
		if err := os.WriteFile(readme, []byte("# "+name+"\n"), 0o644); err != nil {
			return nil, err
		}
		if commitErr = runGitIn(destination, "add", "README.md"); commitErr == nil {
			commitErr = runGitIn(destination, "commit", "-m", "Commit inicial")
		}
	}

	topLevel, err := gitTopLevel(destination)
	if err != nil {
		return nil, err
	}
	repository, err := handlerStruct.save(userID, account, topLevel)
	if err != nil {
		return nil, err
	}
	if commitErr != nil {
		return nil, fmt.Errorf("repositório criado, mas o commit inicial falhou (configure user.name e user.email do git): %w", commitErr)
	}
	return repository, nil
}

func (handlerStruct *RepositoryHandler) ListGithubOwners(token string) ([]string, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	account, _, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}
	if account == nil {
		return nil, fmt.Errorf("conecte uma conta do GitHub para publicar o repositório")
	}

	var organizations []githubOrganization
	if err := getGithubAPI("https://api.github.com/user/orgs?per_page=100", account.Token.Plaintext, &organizations); err != nil {
		return nil, err
	}
	owners := []string{account.Login}
	for _, organization := range organizations {
		owners = append(owners, organization.Login)
	}
	return owners, nil
}

func (handlerStruct *RepositoryHandler) PublishRepository(token, owner, name, description string, private bool) (*octohubDtos.RepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	account, githubID, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}
	if account == nil {
		return nil, fmt.Errorf("conecte uma conta do GitHub para publicar o repositório")
	}

	name = strings.TrimSpace(name)
	if !validRepositoryName(name) {
		return nil, fmt.Errorf("nome inválido: use apenas letras, números, '-', '_' e '.'")
	}
	repoPath := handlerStruct.gitHandler.RepoPath()
	if repoPath == "" {
		return nil, errNoRepository
	}
	if originURL(repoPath) != "" {
		return nil, fmt.Errorf("este repositório já tem um remoto origin")
	}
	if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-parse", "--verify", "HEAD"}); err != nil {
		return nil, fmt.Errorf("faça o primeiro commit antes de publicar o repositório")
	}

	var repository models.OctohubModel
	if err := handlerStruct.DataBase.Where("user_id = ? AND github_id = ? AND local_path = ?", userID, githubID, repoPath).First(&repository).Error; err != nil {
		return nil, fmt.Errorf("repositório não encontrado")
	}

	endpoint := "https://api.github.com/user/repos"
	if owner != "" && !strings.EqualFold(owner, account.Login) {
		endpoint = "https://api.github.com/orgs/" + url.PathEscape(owner) + "/repos"
	}
	var created githubRepository
	request := githubCreateRepositoryRequest{Name: name, Private: private, Description: strings.TrimSpace(description)}
	if err := postGithubAPI(endpoint, account.Token.Plaintext, request, &created); err != nil {
		return nil, err
	}

	if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"remote", "add", "origin", created.CloneURL}); err != nil {
		return nil, err
	}
	published, err := handlerStruct.open(&repository, account)
	if err != nil {
		return nil, err
	}
	if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"push", "-u", "origin", "HEAD"}); err != nil {
		return nil, fmt.Errorf("repositório %s criado no GitHub, mas o envio falhou: %w", created.FullName, err)
	}
	return published, nil
}

func postGithubAPI(endpoint, accessToken string, body, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("Content-Type", "application/json")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK, http.StatusCreated:
		return json.NewDecoder(response.Body).Decode(out)
	case http.StatusUnauthorized:
		return fmt.Errorf("token do GitHub inválido ou revogado, reconecte a conta")
	}

	var apiError githubAPIError
	json.NewDecoder(response.Body).Decode(&apiError)
	details := []string{}
	for _, detail := range apiError.Errors {
		if detail.Message != "" {
			details = append(details, detail.Message)
		}
	}
	if len(details) > 0 {
		return fmt.Errorf("github: %s", strings.Join(details, "; "))
	}
	if apiError.Message != "" {
		return fmt.Errorf("github: %s", apiError.Message)
	}
	return fmt.Errorf("erro ao consultar o GitHub: status %d", response.StatusCode)
}
