package octohubHandler

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

type GitHandler struct {
	ctx          context.Context
	serverActive bool
	repoPath     string
}

func NewGitHandler(initialPath string) *GitHandler {
	return &GitHandler{
		repoPath: initialPath,
	}
}

func (handlerStruct *GitHandler) SetRepoPath(newPath string) {
	handlerStruct.repoPath = newPath
}

func (handlerStruct *GitHandler) Startup(ctx context.Context) {
	handlerStruct.ctx = ctx
}

func (handlerStruct *GitHandler) RunGitCommand(args []string) ([]byte, error) {
	cmd := exec.CommandContext(handlerStruct.ctx, "git", args...)
	cmd.Dir = handlerStruct.repoPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("o comando git expirou")
		}
		if len(out) > 0 {

			return nil, fmt.Errorf("%s", strings.TrimSpace(string(out)))
		}
		return nil, err
	}
	return out, nil
}
