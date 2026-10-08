package octohubHandler

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"

	"docker-manager-go/src/processes"
)

var errNoRepository = errors.New("nenhum repositório selecionado no OctoHub")

type GitHandler struct {
	auth     gitAuth
	repoPath string
	mutex    sync.RWMutex
	ctx      context.Context
}

func NewGitHandler(initialPath string) *GitHandler {
	return &GitHandler{
		repoPath: initialPath,
	}
}

func (handlerStruct *GitHandler) SetRepoPath(newPath string) {
	handlerStruct.setRepository(newPath, gitAuth{})
}

func (handlerStruct *GitHandler) setRepository(path string, auth gitAuth) {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()
	handlerStruct.repoPath = path
	handlerStruct.auth = auth
}

func friendlyGitError(message string) string {
	if strings.Contains(message, "user interactivity has been disabled") || strings.Contains(message, "Authentication failed") {
		return "o GitHub recusou o acesso da conta ativa (token inválido ou sem permissão neste repositório). Reconecte a conta e tente de novo.\n" + message
	}
	return message
}

func (handlerStruct *GitHandler) RepoPath() string {
	handlerStruct.mutex.RLock()
	defer handlerStruct.mutex.RUnlock()
	return handlerStruct.repoPath
}

func (handlerStruct *GitHandler) Startup(ctx context.Context) {
	handlerStruct.ctx = ctx
}

func (handlerStruct *GitHandler) RunGitCommand(args []string) ([]byte, error) {
	out, _, err := handlerStruct.runGit(args, "")
	return out, err
}

func (handlerStruct *GitHandler) RunGitCommandWithInput(args []string, input string) ([]byte, error) {
	out, _, err := handlerStruct.runGit(args, input)
	return out, err
}

func (handlerStruct *GitHandler) runGit(args []string, input string, extraEnv ...string) ([]byte, int, error) {
	handlerStruct.mutex.RLock()
	repoPath, auth := handlerStruct.repoPath, handlerStruct.auth
	handlerStruct.mutex.RUnlock()
	if repoPath == "" {
		return nil, -1, errNoRepository
	}

	env := append(auth.env(), extraEnv...)
	network := isNetworkCommand(args)
	if network {
		sshEnv, cleanup, err := auth.sshEnv()
		if err != nil {
			return nil, -1, err
		}
		defer cleanup()
		env = append(env, sshEnv...)
	}

	cmd := processes.CommandContext(handlerStruct.ctx, "git", args...)
	cmd.Dir = repoPath
	cmd.Env = env
	if input != "" {
		cmd.Stdin = strings.NewReader(input)
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return nil, -1, fmt.Errorf("o comando git expirou")
		}
		exitCode := -1
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitCode()
		}
		message := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		if message == "" {
			return stdout.Bytes(), exitCode, err
		}
		if network && isAuthError(message) {
			host, isSSH := parseRemote(originURL(repoPath))
			return stdout.Bytes(), exitCode, authFailure(host, isSSH, message)
		}
		return stdout.Bytes(), exitCode, errors.New(friendlyGitError(message))
	}
	return stdout.Bytes(), 0, nil
}

func originURL(repoPath string) string {
	out, err := processes.Command("git", "-C", repoPath, "remote", "get-url", "origin").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
