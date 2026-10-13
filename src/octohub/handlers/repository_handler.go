package octohubHandler

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/gorm"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	"docker-manager-go/src/processes"
	octohubDtos "docker-manager-go/src/octohub/dtos"
)

const CloneProgressEvent = "octohub:clone-progress"

type RepositoryHandler struct {
	envPath    string
	DataBase   *gorm.DB
	gitHandler *GitHandler
	ctx        context.Context
	Session    *auth.ManagerStruct
}

type githubRepository struct {
	Fork        bool   `json:"fork"`
	Name        string `json:"name"`
	Private     bool   `json:"private"`
	Archived    bool   `json:"archived"`
	CloneURL    string `json:"clone_url"`
	FullName    string `json:"full_name"`
	UpdatedAt   string `json:"updated_at"`
	Description string `json:"description"`
	Owner       struct {
		Login string `json:"login"`
	} `json:"owner"`
}

func NewRepositoryHandler(dataBase *gorm.DB, sessionManager *auth.ManagerStruct, gitHandler *GitHandler) *RepositoryHandler {
	return &RepositoryHandler{
		DataBase:   dataBase,
		gitHandler: gitHandler,
		Session:    sessionManager,
		envPath:    gitHandler.RepoPath(),
	}
}

func (handlerStruct *RepositoryHandler) Startup(ctx context.Context) {
	handlerStruct.ctx = ctx
}

func (handlerStruct *RepositoryHandler) userID(token string) (uint, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return 0, err
	}
	return session.UserID, nil
}

func (handlerStruct *RepositoryHandler) githubScope(userID uint) (*models.GithubAccountModel, int64, error) {
	var account models.GithubAccountModel
	if err := handlerStruct.DataBase.Where("user_id = ? AND is_active = ?", userID, true).Limit(1).Find(&account).Error; err != nil {
		return nil, 0, err
	}
	if account.ID == 0 {
		return nil, 0, nil
	}
	err := handlerStruct.DataBase.Model(&models.OctohubModel{}).
		Where("user_id = ? AND github_id = 0", userID).
		Update("github_id", account.GithubID).Error
	if err != nil {
		return nil, 0, err
	}
	return &account, account.GithubID, nil
}

func (handlerStruct *RepositoryHandler) ListRepositories(token string) ([]octohubDtos.RepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	_, githubID, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}

	var repositories []models.OctohubModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.ctx).
		Where("user_id = ? AND github_id = ?", userID, githubID).
		Order("last_opened_at DESC").
		Find(&repositories).Error; err != nil {
		return nil, err
	}
	return octohubDtos.ToRepositoryDtoList(repositories, handlerStruct.gitHandler.RepoPath()), nil
}

func (handlerStruct *RepositoryHandler) GetCurrentRepository(token string) (*octohubDtos.RepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	account, githubID, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}

	currentPath := handlerStruct.gitHandler.RepoPath()
	var repository models.OctohubModel
	if currentPath != "" {
		err := handlerStruct.DataBase.Where("user_id = ? AND github_id = ? AND local_path = ?", userID, githubID, currentPath).Limit(1).Find(&repository).Error
		if err != nil {
			return nil, err
		}
		if repository.ID != 0 {
			return handlerStruct.open(&repository, account)
		}
	}

	if err := handlerStruct.DataBase.Where("user_id = ? AND github_id = ?", userID, githubID).Order("last_opened_at DESC").Limit(1).Find(&repository).Error; err != nil {
		return nil, err
	}
	if repository.ID != 0 {
		return handlerStruct.open(&repository, account)
	}

	var total int64
	if err := handlerStruct.DataBase.Model(&models.OctohubModel{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, err
	}
	if handlerStruct.envPath != "" && total == 0 {
		if topLevel, err := gitTopLevel(handlerStruct.envPath); err == nil {
			return handlerStruct.save(userID, account, topLevel)
		}
	}
	handlerStruct.gitHandler.SetRepoPath("")
	return nil, nil
}

func (handlerStruct *RepositoryHandler) AddRepository(token string) (*octohubDtos.RepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	account, _, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}

	folder, err := runtime.OpenDirectoryDialog(handlerStruct.ctx, runtime.OpenDialogOptions{
		Title: "Selecione a pasta do repositório Git",
	})
	if err != nil {
		return nil, err
	}
	if folder == "" {
		return nil, nil
	}

	topLevel, err := gitTopLevel(folder)
	if err != nil {
		return nil, fmt.Errorf("a pasta %s não é um repositório Git", folder)
	}
	return handlerStruct.save(userID, account, topLevel)
}

func (handlerStruct *RepositoryHandler) SelectRepository(token string, repositoryID uint) (*octohubDtos.RepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	account, githubID, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}

	var repository models.OctohubModel
	if err := handlerStruct.DataBase.Where("id = ? AND user_id = ? AND github_id = ?", repositoryID, userID, githubID).First(&repository).Error; err != nil {
		return nil, fmt.Errorf("repositório não encontrado")
	}
	if _, err := os.Stat(repository.LocalPath); err != nil {
		return nil, fmt.Errorf("a pasta %s não existe mais", repository.LocalPath)
	}
	return handlerStruct.open(&repository, account)
}

func (handlerStruct *RepositoryHandler) RemoveRepository(token string, repositoryID uint) error {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return err
	}

	var repository models.OctohubModel
	if err := handlerStruct.DataBase.Where("id = ? AND user_id = ?", repositoryID, userID).First(&repository).Error; err != nil {
		return fmt.Errorf("repositório não encontrado")
	}
	if err := handlerStruct.DataBase.Unscoped().Delete(&repository).Error; err != nil {
		return err
	}
	if repository.LocalPath == handlerStruct.gitHandler.RepoPath() {
		handlerStruct.gitHandler.SetRepoPath("")
	}
	return nil
}

func (handlerStruct *RepositoryHandler) ListRemoteRepositories(token string) ([]octohubDtos.RemoteRepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	account, githubID, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}
	if account == nil {
		return nil, fmt.Errorf("conecte uma conta do GitHub para listar os repositórios remotos")
	}

	var remotes []githubRepository
	for page := 1; page <= 10; page++ {
		var batch []githubRepository
		endpoint := fmt.Sprintf("https://api.github.com/user/repos?per_page=100&page=%d&sort=updated&affiliation=owner,collaborator,organization_member", page)
		if err := getGithubAPI(endpoint, account.Token.Plaintext, &batch); err != nil {
			return nil, err
		}
		remotes = append(remotes, batch...)
		if len(batch) < 100 {
			break
		}
	}

	local := handlerStruct.localGithubRepositories(userID, githubID)
	list := make([]octohubDtos.RemoteRepositoryDto, 0, len(remotes))
	for _, remote := range remotes {
		item := octohubDtos.RemoteRepositoryDto{
			Fork:        remote.Fork,
			Name:        remote.Name,
			Private:     remote.Private,
			Archived:    remote.Archived,
			CloneURL:    remote.CloneURL,
			FullName:    remote.FullName,
			UpdatedAt:   remote.UpdatedAt,
			Owner:       remote.Owner.Login,
			Description: remote.Description,
		}
		if repository, found := local[strings.ToLower(remote.FullName)]; found {
			item.LocalPath = repository.LocalPath
			item.LocalRepositoryID = repository.ID
		}
		list = append(list, item)
	}
	return list, nil
}

func (handlerStruct *RepositoryHandler) localGithubRepositories(userID uint, githubID int64) map[string]models.OctohubModel {
	var repositories []models.OctohubModel
	handlerStruct.DataBase.Where("user_id = ? AND github_id = ?", userID, githubID).Find(&repositories)

	result := map[string]models.OctohubModel{}
	for _, repository := range repositories {
		out, err := processes.Command("git", "-C", repository.LocalPath, "remote", "get-url", "origin").Output()
		if err != nil {
			continue
		}
		if fullName := githubFullName(string(out)); fullName != "" {
			result[fullName] = repository
		}
	}
	return result
}

func (handlerStruct *RepositoryHandler) GetCloneFolder(token string) (string, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return "", err
	}

	var repository models.OctohubModel
	if err := handlerStruct.DataBase.Where("user_id = ?", userID).Order("last_opened_at DESC").Limit(1).Find(&repository).Error; err != nil {
		return "", err
	}
	candidates := []string{}
	if repository.ID != 0 {
		candidates = append(candidates, filepath.Dir(repository.LocalPath))
	}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates, filepath.Join(home, "Documents", "GitHub"), filepath.Join(home, "Documents"), home)
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate, nil
		}
	}
	return "", nil
}

func (handlerStruct *RepositoryHandler) ChooseCloneFolder(currentFolder string) (string, error) {
	return runtime.OpenDirectoryDialog(handlerStruct.ctx, runtime.OpenDialogOptions{
		Title:            "Escolha a pasta de destino do repositório",
		DefaultDirectory: currentFolder,
	})
}

func (handlerStruct *RepositoryHandler) CloneRepository(token, remoteURL, parentFolder string) (*octohubDtos.RepositoryDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}
	return handlerStruct.clone(userID, remoteURL, parentFolder, func(line string) {
		runtime.EventsEmit(handlerStruct.ctx, CloneProgressEvent, line)
	})
}

func (handlerStruct *RepositoryHandler) clone(userID uint, remoteURL, parentFolder string, onProgress func(string)) (*octohubDtos.RepositoryDto, error) {
	account, _, err := handlerStruct.githubScope(userID)
	if err != nil {
		return nil, err
	}

	remoteURL = strings.TrimSpace(remoteURL)
	name := repositoryNameFromURL(remoteURL)
	if name == "" {
		return nil, fmt.Errorf("informe a URL do repositório")
	}
	if strings.TrimSpace(parentFolder) == "" {
		return nil, fmt.Errorf("escolha a pasta de destino")
	}
	destination := filepath.Join(parentFolder, name)
	if entries, err := os.ReadDir(destination); err == nil && len(entries) > 0 {
		return nil, fmt.Errorf("a pasta %s já existe e não está vazia", destination)
	}

	githubID := int64(0)
	if account != nil {
		githubID = account.GithubID
	}
	auth := handlerStruct.repositoryAuth(userID, account, githubID, remoteURL)
	sshEnv, cleanup, err := auth.sshEnv()
	if err != nil {
		return nil, err
	}
	defer cleanup()

	cmd := processes.CommandContext(handlerStruct.ctx, "git", "clone", "--progress", "--", remoteURL, destination)
	cmd.Env = append(auth.env(), sshEnv...)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	var lastLines []string
	lastEmit := time.Time{}
	scanner := bufio.NewScanner(stderr)
	if err := scanner.Err(); err != nil {
	}
	scanner.Split(splitProgressLines)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		lastLines = append(lastLines, line)
		if len(lastLines) > 5 {
			lastLines = lastLines[1:]
		}
		if time.Since(lastEmit) > 100*time.Millisecond || strings.Contains(line, "done") {
			onProgress(line)
			lastEmit = time.Now()
		}
	}
	if err := cmd.Wait(); err != nil {
		message := strings.Join(lastLines, "\n")
		if isAuthError(message) {
			host, isSSH := parseRemote(remoteURL)
			return nil, fmt.Errorf("erro ao clonar %s: %w", remoteURL, authFailure(host, isSSH, message))
		}
		return nil, fmt.Errorf("erro ao clonar %s: %s", remoteURL, friendlyGitError(message))
	}

	topLevel, err := gitTopLevel(destination)
	if err != nil {
		return nil, err
	}
	return handlerStruct.save(userID, account, topLevel)
}

func (handlerStruct *RepositoryHandler) save(userID uint, account *models.GithubAccountModel, path string) (*octohubDtos.RepositoryDto, error) {
	githubID := int64(0)
	if account != nil {
		githubID = account.GithubID
	}

	var repository models.OctohubModel
	err := handlerStruct.DataBase.Where("user_id = ? AND local_path = ?", userID, path).Limit(1).Find(&repository).Error
	if err != nil {
		return nil, err
	}
	if repository.ID == 0 {
		repository = models.OctohubModel{LocalPath: path, UserID: userID, GithubID: githubID, LastOpenedAt: time.Now()}
		if err := handlerStruct.DataBase.Create(&repository).Error; err != nil {
			return nil, fmt.Errorf("erro ao salvar repositório: %w", err)
		}
	} else if repository.GithubID != githubID {
		if err := handlerStruct.DataBase.Model(&repository).Update("github_id", githubID).Error; err != nil {
			return nil, err
		}
	}
	return handlerStruct.open(&repository, account)
}

func (handlerStruct *RepositoryHandler) open(repository *models.OctohubModel, account *models.GithubAccountModel) (*octohubDtos.RepositoryDto, error) {
	if err := handlerStruct.DataBase.Model(repository).Update("last_opened_at", time.Now()).Error; err != nil {
		return nil, err
	}
	auth := handlerStruct.repositoryAuth(repository.UserID, account, repository.GithubID, originURL(repository.LocalPath))
	handlerStruct.gitHandler.setRepository(repository.LocalPath, auth)
	return octohubDtos.ToRepositoryDto(repository, repository.LocalPath), nil
}

func gitTopLevel(folder string) (string, error) {
	out, err := processes.Command("git", "-C", folder, "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", errors.New("não é um repositório git")
	}
	return filepath.Clean(strings.TrimSpace(string(out))), nil
}

func repositoryNameFromURL(remoteURL string) string {
	value := strings.TrimSuffix(strings.TrimRight(strings.TrimSpace(remoteURL), `/\`), ".git")
	return value[strings.LastIndexAny(value, `/\:`)+1:]
}

func githubFullName(remoteURL string) string {
	value := strings.TrimSuffix(strings.TrimRight(strings.TrimSpace(remoteURL), "/"), ".git")
	if rest, found := strings.CutPrefix(value, "git@github.com:"); found {
		return strings.ToLower(rest)
	}
	parsed, err := url.Parse(value)
	if err != nil || !strings.EqualFold(parsed.Hostname(), "github.com") {
		return ""
	}
	return strings.ToLower(strings.Trim(parsed.Path, "/"))
}

func splitProgressLines(data []byte, atEOF bool) (int, []byte, error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	if index := bytes.IndexAny(data, "\r\n"); index >= 0 {
		return index + 1, data[:index], nil
	}
	if atEOF {
		return len(data), data, nil
	}
	return 0, nil, nil
}
