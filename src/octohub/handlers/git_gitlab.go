package octohubHandler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"docker-manager-go/src/models"
	octohubDtos "docker-manager-go/src/octohub/dtos"
)

type gitlabProject struct {
	Path              string `json:"path"`
	Archived          bool   `json:"archived"`
	Visibility        string `json:"visibility"`
	Description       string `json:"description"`
	SSHURLToRepo      string `json:"ssh_url_to_repo"`
	HTTPURLToRepo     string `json:"http_url_to_repo"`
	LastActivityAt    string `json:"last_activity_at"`
	PathWithNamespace string `json:"path_with_namespace"`
	Namespace         struct {
		FullPath string `json:"full_path"`
	} `json:"namespace"`
	ForkedFromProject *struct {
		ID int `json:"id"`
	} `json:"forked_from_project"`
}

var gitlabAPIBase = func(host string) string { return "https://" + host }

var gitlabClient = &http.Client{Timeout: 30 * time.Second}

func (handlerStruct *RepositoryHandler) ListGitlabProjects(token, host string) ([]octohubDtos.RemoteRepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	_, githubID, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}

	host = normalizeCredentialHost(host)
	var credential models.GitCredentialModel
	if err := handlerStruct.DataBase.Where("user_id = ? AND host = ?", userID, host).Limit(1).Find(&credential).Error; err != nil {
		return nil, err
	}
	if credential.ID == 0 || credential.Password.Plaintext == "" {
		return nil, fmt.Errorf("salve um token de acesso do GitLab (com a permissão read_api) nas Credenciais Git de %s para listar os projetos", host)
	}

	var projects []gitlabProject
	for page := 1; page <= 10; page++ {
		var batch []gitlabProject
		endpoint := fmt.Sprintf("%s/api/v4/projects?membership=true&order_by=last_activity_at&per_page=100&page=%d", gitlabAPIBase(host), page)
		if err := getGitlabAPI(endpoint, credential.Password.Plaintext, &batch); err != nil {
			return nil, err
		}
		projects = append(projects, batch...)
		if len(batch) < 100 {
			break
		}
	}

	useSSH := credential.PrivateKey.Plaintext != ""
	local := handlerStruct.localRemoteRepositories(userID, githubID, sshHostname(host))
	list := make([]octohubDtos.RemoteRepositoryDto, 0, len(projects))
	for _, project := range projects {
		cloneURL := project.HTTPURLToRepo
		if useSSH && project.SSHURLToRepo != "" {
			cloneURL = project.SSHURLToRepo
		}
		item := octohubDtos.RemoteRepositoryDto{
			CloneURL:    cloneURL,
			Name:        project.Path,
			Archived:    project.Archived,
			Description: project.Description,
			UpdatedAt:   project.LastActivityAt,
			Owner:       project.Namespace.FullPath,
			FullName:    project.PathWithNamespace,
			Fork:        project.ForkedFromProject != nil,
			Private:     project.Visibility != "public",
		}
		if repository, found := local[strings.ToLower(project.PathWithNamespace)]; found {
			item.LocalPath = repository.LocalPath
			item.LocalRepositoryID = repository.ID
		}
		list = append(list, item)
	}
	return list, nil
}

func getGitlabAPI(endpoint, accessToken string, out any) error {
	request, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	request.Header.Set("PRIVATE-TOKEN", accessToken)
	request.Header.Set("Accept", "application/json")

	response, err := gitlabClient.Do(request)
	if err != nil {
		return fmt.Errorf("não foi possível falar com o GitLab: %w", err)
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK:
		return json.NewDecoder(response.Body).Decode(out)
	case http.StatusUnauthorized:
		return fmt.Errorf("o GitLab recusou o token salvo. A API não aceita a senha da conta: use um Personal Access Token com a permissão read_api")
	case http.StatusForbidden:
		return fmt.Errorf("o token salvo não tem permissão para listar projetos: gere um com a permissão read_api")
	case http.StatusNotFound:
		return fmt.Errorf("o servidor não respondeu como um GitLab (API v4 não encontrada)")
	default:
		return fmt.Errorf("erro ao consultar o GitLab: status %d", response.StatusCode)
	}
}

func remoteRepositoryPath(remoteURL string) (string, string) {
	value := strings.TrimSuffix(strings.TrimRight(strings.TrimSpace(remoteURL), "/"), ".git")
	if !strings.Contains(value, "://") {
		if match := scpRemoteRegex.FindStringSubmatch(value); match != nil && len(match[1]) > 1 {
			return strings.ToLower(match[1]), strings.ToLower(strings.Trim(value[len(match[0]):], "/"))
		}
		return "", ""
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return "", ""
	}
	return strings.ToLower(parsed.Hostname()), strings.ToLower(strings.Trim(parsed.Path, "/"))
}

func (handlerStruct *RepositoryHandler) localRemoteRepositories(userID uint, githubID int64, hostname string) map[string]models.OctohubModel {
	var repositories []models.OctohubModel
	handlerStruct.DataBase.Where("user_id = ? AND github_id = ?", userID, githubID).Find(&repositories)

	result := map[string]models.OctohubModel{}
	for _, repository := range repositories {
		if host, path := remoteRepositoryPath(originURL(repository.LocalPath)); host == hostname && path != "" {
			result[path] = repository
		}
	}
	return result
}
