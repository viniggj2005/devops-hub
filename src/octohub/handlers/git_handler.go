package octohubHandler

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"

	"docker-manager-go/src/desktop"
	"docker-manager-go/src/processes"

	"github.com/wailsapp/wails/v3/pkg/application"
)

var errNoRepository = errors.New("nenhum repositório selecionado no OctoHub")

type repositoryWorkspace struct {
	auth gitAuth
	path string
}

type GitHandler struct {
	mutex       sync.RWMutex
	appContext  context.Context
	initialPath string
	workspaces  map[string]repositoryWorkspace
}

func NewGitHandler(initialPath string) *GitHandler {
	return &GitHandler{
		initialPath: initialPath,
		workspaces:  make(map[string]repositoryWorkspace),
	}
}

func (handlerStruct *GitHandler) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	handlerStruct.appContext = ctx
	desktop.OnWindowClosed(handlerStruct.releaseWindow)
	return nil
}

func (handlerStruct *GitHandler) releaseWindow(windowName string) {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()
	delete(handlerStruct.workspaces, windowName)
}

func (handlerStruct *GitHandler) setRepoPath(ctx context.Context, newPath string) {
	handlerStruct.setRepository(ctx, newPath, gitAuth{})
}

func (handlerStruct *GitHandler) setRepository(ctx context.Context, path string, auth gitAuth) {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()
	handlerStruct.workspaces[desktop.CallingWindowName(ctx)] = repositoryWorkspace{auth: auth, path: path}
}

func (handlerStruct *GitHandler) forgetRepository(path string) {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()
	for windowName, workspace := range handlerStruct.workspaces {
		if workspace.path == path {
			handlerStruct.workspaces[windowName] = repositoryWorkspace{}
		}
	}
	if handlerStruct.initialPath == path {
		handlerStruct.initialPath = ""
	}
}

func (handlerStruct *GitHandler) refreshAuth(resolve func(path string) (gitAuth, bool)) {
	handlerStruct.mutex.RLock()
	paths := make(map[string]string, len(handlerStruct.workspaces))
	for windowName, workspace := range handlerStruct.workspaces {
		if workspace.path != "" {
			paths[windowName] = workspace.path
		}
	}
	handlerStruct.mutex.RUnlock()

	resolved := make(map[string]gitAuth, len(paths))
	for _, path := range paths {
		if _, done := resolved[path]; done {
			continue
		}
		if auth, ok := resolve(path); ok {
			resolved[path] = auth
		}
	}

	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()
	for windowName, path := range paths {
		auth, ok := resolved[path]
		if workspace, exists := handlerStruct.workspaces[windowName]; ok && exists && workspace.path == path {
			handlerStruct.workspaces[windowName] = repositoryWorkspace{auth: auth, path: path}
		}
	}
}

func (handlerStruct *GitHandler) workspace(ctx context.Context) repositoryWorkspace {
	handlerStruct.mutex.RLock()
	defer handlerStruct.mutex.RUnlock()
	if workspace, exists := handlerStruct.workspaces[desktop.CallingWindowName(ctx)]; exists {
		return workspace
	}
	return repositoryWorkspace{path: handlerStruct.initialPath}
}

func friendlyGitError(message string) string {
	if strings.Contains(message, "user interactivity has been disabled") || strings.Contains(message, "Authentication failed") {
		return "o GitHub recusou o acesso da conta ativa (token inválido ou sem permissão neste repositório). Reconecte a conta e tente de novo.\n" + message
	}
	return message
}

func (handlerStruct *GitHandler) repositoryPath(ctx context.Context) string {
	return handlerStruct.workspace(ctx).path
}

func (handlerStruct *GitHandler) runGitCommand(ctx context.Context, args []string) ([]byte, error) {
	output, _, err := handlerStruct.runGit(ctx, args, "")
	return output, err
}

func (handlerStruct *GitHandler) runGitCommandWithInput(ctx context.Context, args []string, input string) ([]byte, error) {
	output, _, err := handlerStruct.runGit(ctx, args, input)
	return output, err
}

func (handlerStruct *GitHandler) runGit(ctx context.Context, args []string, input string, extraEnv ...string) ([]byte, int, error) {
	workspace := handlerStruct.workspace(ctx)
	if workspace.path == "" {
		return nil, -1, errNoRepository
	}

	env := append(workspace.auth.env(), extraEnv...)
	network := isNetworkCommand(args)
	if network {
		sshEnv, cleanup, err := workspace.auth.sshEnv()
		if err != nil {
			return nil, -1, err
		}
		defer cleanup()
		env = append(env, sshEnv...)
	}

	command := processes.CommandContext(handlerStruct.appContext, "git", args...)
	command.Dir = workspace.path
	command.Env = env
	if input != "" {
		command.Stdin = strings.NewReader(input)
	}
	var stdout, stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr

	if err := command.Run(); err != nil {
		if handlerStruct.appContext.Err() == context.DeadlineExceeded {
			return nil, -1, fmt.Errorf("o comando git expirou")
		}
		exitCode := -1
		var exitError *exec.ExitError
		if errors.As(err, &exitError) {
			exitCode = exitError.ExitCode()
		}
		message := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		if message == "" {
			return stdout.Bytes(), exitCode, err
		}
		if network && isAuthError(message) {
			host, isSSH := parseRemote(originURL(workspace.path))
			return stdout.Bytes(), exitCode, authFailure(host, isSSH, message)
		}
		return stdout.Bytes(), exitCode, errors.New(friendlyGitError(message))
	}
	return stdout.Bytes(), 0, nil
}

func originURL(repoPath string) string {
	output, err := processes.Command("git", "-C", repoPath, "remote", "get-url", "origin").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}
