package octohubHandlers

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"strings"
)

type GitBranchHandler struct {
	gitHandler *GitHandler
}

func NewGitBranchHandler(gitHandler *GitHandler) *GitBranchHandler {
	return &GitBranchHandler{
		gitHandler: gitHandler,
	}
}

func (handlerStruct *GitBranchHandler) PublishBranch(branchName string) error {
	cmd := exec.CommandContext(handlerStruct.gitHandler.ctx, "git", "push", "-u", "origin", branchName)
	cmd.Dir = handlerStruct.gitHandler.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}
	return nil
}
func (handlerStruct *GitBranchHandler) CreateBranch(branchName string) error {
	cmd := exec.CommandContext(handlerStruct.gitHandler.ctx, "git", "branch", branchName)
	cmd.Dir = handlerStruct.gitHandler.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}
	return nil
}

func (handlerStruct *GitBranchHandler) ChangeBranch(targetBranch string) error {
	cmd := exec.CommandContext(handlerStruct.gitHandler.ctx, "git", "stash")
	cmd.Dir = handlerStruct.gitHandler.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}

	cmd = exec.CommandContext(handlerStruct.gitHandler.ctx, "git", "checkout", targetBranch)
	_, err = cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}

	return nil
}
func (handlerStruct *GitBranchHandler) DeleteBranch(branch string) error {
	cmd := exec.CommandContext(handlerStruct.gitHandler.ctx, "git", "branch", "-d", branch)
	cmd.Dir = handlerStruct.gitHandler.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}
	return nil
}

func (handlerStruct *GitBranchHandler) ListBranchs() ([]string, error) {
	cmd := exec.CommandContext(handlerStruct.gitHandler.ctx, "git", "branch")
	cmd.Dir = handlerStruct.gitHandler.repoPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("o comando git expirou")
		}
		return nil, err
	}
	var branches []string
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {

		line := scanner.Text()
		cleanLine := strings.TrimSpace(line)
		if cleanLine != "" {
			branches = append(branches, cleanLine)
		}
	}
	return branches, nil
}
