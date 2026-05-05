package octohubHandler

import (
	"bufio"
	"fmt"
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
	args := []string{"push", "-u", "origin", branchName}
	_, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return err
	}
	return nil
}
func (handlerStruct *GitBranchHandler) CreateBranch(branchName string) error {
	args := []string{"branch", branchName}
	_, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return err
	}

	return nil
}

func (handlerStruct *GitBranchHandler) HasUncommittedChanges() (bool, error) {
	args := []string{"status", "--porcelain"}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return false, err
	}
	return len(strings.TrimSpace(string(out))) > 0, nil
}

func (handlerStruct *GitBranchHandler) ChangeBranch(targetBranch string, leaveChanges bool) error {
	var args []string
	hasChanges, err := handlerStruct.HasUncommittedChanges()
	if err != nil {
		return fmt.Errorf("erro ao verificar alterações: %v", err)
	}

	if hasChanges {
		args = []string{"stash", "push", "-u", "-m", "OctoHub: Auto-stash antes de mudar para " + targetBranch}
		_, err := handlerStruct.gitHandler.RunGitCommand(args)
		if err != nil {
			return fmt.Errorf("erro ao guardar alterações temporárias: %v", err)
		}
	}

	args = []string{"checkout", targetBranch}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		if hasChanges {
			args = []string{"stash", "pop"}
			_, _ = handlerStruct.gitHandler.RunGitCommand(args)
		}
		return fmt.Errorf("erro ao trocar branch: %s", string(out))
	}

	if hasChanges && !leaveChanges {
		args := []string{"stash", "pop"}
		_, err := handlerStruct.gitHandler.RunGitCommand(args)
		if err != nil {
			return fmt.Errorf("trocou de branch, mas houve conflito ao trazer as mudanças: %v", err)
		}
	}

	return nil
}
func (handlerStruct *GitBranchHandler) DeleteBranch(branch string) error {
	args := []string{"branch", "-d", branch}
	_, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return err
	}
	return nil
}

func (handlerStruct *GitBranchHandler) ListBranchs() ([]string, error) {
	args := []string{"branch"}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
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

func (handlerStruct *GitBranchHandler) GetCurrentBranch() (string, error) {
	args := []string{"rev-parse", "--abbrev-ref", "HEAD"}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
