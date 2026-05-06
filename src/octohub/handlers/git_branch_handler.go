package octohubHandler

import (
	"bufio"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	octohubStructs "docker-manager-go/src/octohub/structs"
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

func (handlerStruct *GitBranchHandler) ListStashes() ([]octohubStructs.Stash, error) {
	currentBranch, err := handlerStruct.GetCurrentBranch()
	if err != nil {
		return nil, err
	}

	args := []string{"stash", "list"}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return nil, err
	}

	var stashes []octohubStructs.Stash
	stashRegex := regexp.MustCompile(`^(stash@\{\d+\}): (?:WIP )?[oO]n ([^:]+): (.*)`)

	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		matches := stashRegex.FindStringSubmatch(line)
		if len(matches) == 4 {
			id := matches[1]
			branch := strings.TrimSpace(matches[2])
			message := strings.TrimSpace(matches[3])

			if branch == currentBranch {
				stashes = append(stashes, octohubStructs.Stash{
					ID:      id,
					Branch:  branch,
					Message: message,
				})
			}
		}
	}

	if stashes == nil {
		stashes = []octohubStructs.Stash{}
	}

	return stashes, nil
}

func (handlerStruct *GitBranchHandler) PopStash(stashID string) error {
	args := []string{"stash", "pop", stashID}
	_, err := handlerStruct.gitHandler.RunGitCommand(args)
	return err
}

func (handlerStruct *GitBranchHandler) DropStash(stashID string) error {
	args := []string{"stash", "drop", stashID}
	_, err := handlerStruct.gitHandler.RunGitCommand(args)
	return err
}

func (handlerStruct *GitBranchHandler) GetStashModifications(stashID string) ([]octohubStructs.FileModification, error) {
	args := []string{"stash", "show", "--name-status", stashID}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return nil, err
	}
	var filesModified []octohubStructs.FileModification

	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		parts := strings.Split(line, "\t")
		if len(parts) < 2 {
			continue
		}

		status := strings.TrimSpace(parts[0])
		var fileName string
		if strings.HasPrefix(status, "R") && len(parts) >= 3 {
			fileName = fmt.Sprintf("%s -> %s", parts[1], parts[2])
		} else {
			fileName = parts[1]
		}

		filesModified = append(filesModified, octohubStructs.FileModification{File: fileName, Status: status})
	}

	if filesModified == nil {
		filesModified = []octohubStructs.FileModification{}
	}
	return filesModified, nil
}

func (handlerStruct *GitBranchHandler) GetStashedFileDiff(stashID string, filePath string) (string, error) {
	var args []string
	if strings.Contains(filePath, " -> ") {
		parts := strings.Split(filePath, " -> ")
		oldPath := strings.TrimSpace(parts[0])
		newPath := strings.TrimSpace(parts[1])

		args = []string{"diff", "-M", stashID + "^:" + oldPath, stashID + ":" + newPath}
	} else {
		args = []string{"stash", "show", "-p", stashID, "--", filePath}
	}

	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return "", err
	}

	lines := strings.Split(string(out), "\n")
	var cleanLines []string
	for _, line := range lines {
		if strings.HasPrefix(line, "diff --git") ||
			strings.HasPrefix(line, "index ") ||
			strings.HasPrefix(line, "--- ") ||
			strings.HasPrefix(line, "+++ ") {
			continue
		}
		cleanLines = append(cleanLines, line)
	}

	return strings.Join(cleanLines, "\n"), nil
}

func (handlerStruct *GitBranchHandler) OpenFileInEditor(filePath string) error {
	fullPath := filepath.Join(handlerStruct.gitHandler.repoPath, filePath)

	cmd := exec.Command("cmd", "/c", "code", fullPath)
	err := cmd.Start()
	if err != nil {
		cmd = exec.Command("cmd", "/c", "start", "\"\"", fullPath)
		return cmd.Start()
	}
	return nil
}

func (handlerStruct *GitBranchHandler) StageFile(filePath string) error {
	args := []string{"add", filePath}
	_, err := handlerStruct.gitHandler.RunGitCommand(args)
	return err
}
