package octohubHandler

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
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

func (handlerStruct *GitBranchHandler) PublishBranch(ctx context.Context, branchName string) error {
	args := []string{"push", "-u", "origin", branchName}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--abbrev-ref", branchName + "@{upstream}"}); err == nil {
		args = []string{"push"}
	}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return err
	}
	return nil
}

func (handlerStruct *GitBranchHandler) GetOriginURL(ctx context.Context) string {
	return originURL(handlerStruct.gitHandler.repositoryPath(ctx))
}

func (handlerStruct *GitBranchHandler) validateBranchName(ctx context.Context, branchName string) error {
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"check-ref-format", "--branch", branchName}); err != nil {
		return fmt.Errorf("nome de branch inválido: %s", branchName)
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "--quiet", "refs/heads/" + branchName}); err == nil {
		return fmt.Errorf("já existe uma branch chamada %s", branchName)
	}
	return nil
}

func (handlerStruct *GitBranchHandler) CreateAndCheckoutBranch(ctx context.Context, branchName string) error {
	if err := handlerStruct.validateBranchName(ctx, branchName); err != nil {
		return err
	}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"checkout", "-b", branchName})
	return err
}

func (handlerStruct *GitBranchHandler) CreateBranchFrom(ctx context.Context, branchName string, startPoint string, checkout bool) error {
	branchName = strings.TrimSpace(branchName)
	startPoint = strings.TrimSpace(startPoint)
	if err := handlerStruct.validateBranchName(ctx, branchName); err != nil {
		return err
	}
	if startPoint == "" {
		startPoint = "HEAD"
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "--quiet", startPoint + "^{commit}"}); err != nil {
		return fmt.Errorf("branch de origem não encontrada: %s", startPoint)
	}

	args := []string{"branch", "--no-track", branchName, startPoint}
	if checkout {
		args = []string{"checkout", "--no-track", "-b", branchName, startPoint}
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, args); err != nil {
		return fmt.Errorf("erro ao criar branch: %v", err)
	}
	return nil
}
func (handlerStruct *GitBranchHandler) CreateBranch(ctx context.Context, branchName string) error {
	args := []string{"branch", branchName}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return err
	}

	return nil
}

func (handlerStruct *GitBranchHandler) HasUncommittedChanges(ctx context.Context) (bool, error) {
	args := []string{"status", "--porcelain"}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return false, err
	}
	return len(strings.TrimSpace(string(out))) > 0, nil
}

func (handlerStruct *GitBranchHandler) ChangeBranch(ctx context.Context, targetBranch string, isRemote bool, leaveChanges bool) error {
	var args []string
	hasChanges, err := handlerStruct.HasUncommittedChanges(ctx)
	if err != nil {
		return fmt.Errorf("erro ao verificar alterações: %v", err)
	}

	if hasChanges {
		args = []string{"stash", "push", "-u", "-m", "OctoHub: Auto-stash antes de mudar para " + targetBranch}
		_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
		if err != nil {
			return fmt.Errorf("erro ao guardar alterações temporárias: %v", err)
		}
	}

	args = []string{"checkout", targetBranch}
	if isRemote {
		args = []string{"checkout", "--track", targetBranch}
	}
	_, err = handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		if hasChanges {
			args = []string{"stash", "pop"}
			_, _ = handlerStruct.gitHandler.runGitCommand(ctx, args)
		}
		return fmt.Errorf("erro ao trocar branch: %v", err)
	}

	if hasChanges && !leaveChanges {
		args := []string{"stash", "pop"}
		_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
		if err != nil {
			return fmt.Errorf("trocou de branch, mas houve conflito ao trazer as mudanças: %v", err)
		}
	}

	return nil
}
func (handlerStruct *GitBranchHandler) DeleteBranch(ctx context.Context, branch string) error {
	args := []string{"branch", "-d", branch}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return err
	}
	return nil
}

var trackRegex = regexp.MustCompile(`(ahead|behind) (\d+)`)

func (handlerStruct *GitBranchHandler) ListBranches(ctx context.Context) ([]octohubStructs.BranchInfo, error) {
	args := []string{
		"for-each-ref", "--sort=-committerdate",
		"--format=%(refname)%00%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(upstream:track,nobracket)",
		"refs/heads", "refs/remotes",
	}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return nil, err
	}

	var local, remote []octohubStructs.BranchInfo
	localNames := map[string]bool{}
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Split(line, "\x00")
		if len(fields) < 5 {
			continue
		}
		refName, shortName := fields[0], fields[1]

		if strings.HasPrefix(refName, "refs/remotes/") {
			if strings.HasSuffix(refName, "/HEAD") {
				continue
			}
			remote = append(remote, octohubStructs.BranchInfo{Name: shortName, IsRemote: true})
			continue
		}

		branch := octohubStructs.BranchInfo{
			Name:      shortName,
			IsCurrent: fields[2] == "*",
			Upstream:  fields[3],
		}
		for _, match := range trackRegex.FindAllStringSubmatch(fields[4], -1) {
			count, _ := strconv.Atoi(match[2])
			if match[1] == "ahead" {
				branch.Ahead = count
			} else {
				branch.Behind = count
			}
		}
		localNames[shortName] = true
		local = append(local, branch)
	}

	branches := local
	for _, branch := range remote {
		if _, name, found := strings.Cut(branch.Name, "/"); found && !localNames[name] {
			branches = append(branches, branch)
		}
	}
	if branches == nil {
		branches = []octohubStructs.BranchInfo{}
	}
	return branches, nil
}

func (handlerStruct *GitBranchHandler) GetCurrentBranch(ctx context.Context) (string, error) {
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"symbolic-ref", "--short", "-q", "HEAD"})
	if err != nil {
		if errors.Is(err, errNoRepository) {
			return "", err
		}
		return "HEAD", nil
	}
	return strings.TrimSpace(string(out)), nil
}

func (handlerStruct *GitBranchHandler) ListStashes(ctx context.Context) ([]octohubStructs.Stash, error) {
	currentBranch, err := handlerStruct.GetCurrentBranch(ctx)
	if err != nil {
		return nil, err
	}

	args := []string{"stash", "list"}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
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

func (handlerStruct *GitBranchHandler) PopStash(ctx context.Context, stashID string) error {
	args := []string{"stash", "pop", stashID}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	return err
}

func (handlerStruct *GitBranchHandler) DropStash(ctx context.Context, stashID string) error {
	args := []string{"stash", "drop", stashID}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	return err
}

func (handlerStruct *GitBranchHandler) GetStashModifications(ctx context.Context, stashID string) ([]octohubStructs.FileModification, error) {
	args := []string{"stash", "show", "--name-status", stashID}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
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

func (handlerStruct *GitBranchHandler) GetStashedFileDiff(ctx context.Context, stashID string, filePath string) (string, error) {
	var args []string
	if strings.Contains(filePath, " -> ") {
		parts := strings.Split(filePath, " -> ")
		oldPath := strings.TrimSpace(parts[0])
		newPath := strings.TrimSpace(parts[1])

		args = append([]string{"diff"}, diffFlags...)
		args = append(args, "-M", stashID+"^:"+oldPath, stashID+":"+newPath)
	} else {
		args = append([]string{"stash", "show", "-p"}, diffFlags...)
		args = append(args, stashID, "--", filePath)
	}

	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return "", err
	}

	return string(out), nil
}

func (handlerStruct *GitBranchHandler) StageFile(ctx context.Context, filePath string) error {
	args := []string{"add", "--force", "--", filePath}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	return err
}
