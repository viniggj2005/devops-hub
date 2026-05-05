package octohubHandler

import (
	"context"
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
