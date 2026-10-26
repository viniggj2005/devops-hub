package octohubHandler

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	octohubStructs "docker-manager-go/src/octohub/structs"
)

var mergeMessageBranchRegex = regexp.MustCompile(`'([^']+)'`)

var nonInteractiveEnv = []string{"GIT_EDITOR=true", "GIT_SEQUENCE_EDITOR=true", "GIT_MERGE_AUTOEDIT=no"}

var operationNames = map[string]string{
	"merge":       "merge",
	"squash":      "squash",
	"rebase":      "rebase",
	"revert":      "revert",
	"cherry-pick": "cherry-pick",
}

func (handlerStruct *GitBranchHandler) runNonInteractive(ctx context.Context, args []string, input string) error {
	_, _, err := handlerStruct.gitHandler.runGit(ctx, args, input, nonInteractiveEnv...)
	return err
}

func (handlerStruct *GitBranchHandler) ListMergeableBranches(ctx context.Context) ([]octohubStructs.BranchInfo, error) {
	args := []string{
		"for-each-ref", "--sort=-committerdate",
		"--format=%(refname)%00%(refname:short)%00%(HEAD)",
		"refs/heads", "refs/remotes",
	}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return nil, err
	}

	var local, remote []octohubStructs.BranchInfo
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Split(line, "\x00")
		if len(fields) < 3 || fields[2] == "*" || strings.HasSuffix(fields[0], "/HEAD") {
			continue
		}
		if strings.HasPrefix(fields[0], "refs/remotes/") {
			remote = append(remote, octohubStructs.BranchInfo{Name: fields[1], IsRemote: true})
		} else {
			local = append(local, octohubStructs.BranchInfo{Name: fields[1]})
		}
	}
	return append(append([]octohubStructs.BranchInfo{}, local...), remote...), nil
}

func (handlerStruct *GitBranchHandler) GetDefaultBranch(ctx context.Context) string {
	if out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"}); err == nil {
		if _, name, found := strings.Cut(strings.TrimSpace(string(out)), "/"); found {
			return name
		}
	}
	for _, name := range []string{"main", "master"} {
		if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "-q", "refs/heads/" + name}); err == nil {
			return name
		}
	}
	return ""
}

func (handlerStruct *GitBranchHandler) FetchRemotes(ctx context.Context) error {
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"fetch", "--all", "--prune"})
	return err
}

func (handlerStruct *GitBranchHandler) PullCurrentBranch(ctx context.Context) (octohubStructs.OperationState, error) {
	state, err := handlerStruct.GetOperationState(ctx)
	if err != nil {
		return state, err
	}
	if state.Kind != "" {
		return state, fmt.Errorf("conclua ou aborte o %s em andamento antes", operationNames[state.Kind])
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"}); err != nil {
		return state, fmt.Errorf("a branch atual não acompanha nenhuma branch remota; publique-a antes")
	}

	args := []string{"pull", "--no-edit"}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"config", "--get", "pull.rebase"}); err != nil {
		args = append(args, "--no-rebase")
	}

	runErr := handlerStruct.runNonInteractive(ctx, args, "")
	state, err = handlerStruct.GetOperationState(ctx)
	if runErr != nil {
		if err == nil && len(state.ConflictingFiles) > 0 {
			return state, nil
		}
		return state, fmt.Errorf("erro ao trazer as alterações do remoto: %w", runErr)
	}
	return state, err
}

func (handlerStruct *GitBranchHandler) revCount(ctx context.Context, revisionRange string) (int, error) {
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-list", "--count", revisionRange})
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(strings.TrimSpace(string(out)))
}

func validBranchArgument(branch string) error {
	if branch == "" || strings.HasPrefix(branch, "-") {
		return fmt.Errorf("branch inválida: %q", branch)
	}
	return nil
}

func (handlerStruct *GitBranchHandler) GetMergePreview(ctx context.Context, branch string) (octohubStructs.MergePreview, error) {
	preview := octohubStructs.MergePreview{Commits: []octohubStructs.Commit{}, ConflictingFiles: []string{}}
	if err := validBranchArgument(branch); err != nil {
		return preview, err
	}

	ahead, err := handlerStruct.revCount(ctx, "HEAD.."+branch)
	if err != nil {
		return preview, err
	}
	behind, err := handlerStruct.revCount(ctx, branch+"..HEAD")
	if err != nil {
		return preview, err
	}
	preview.Ahead = ahead
	preview.Behind = behind
	preview.UpToDate = ahead == 0
	preview.CanFastForward = ahead > 0 && behind == 0

	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"log", "-n", "30", "--format=%h%x1f%an%x1f%s", "HEAD.." + branch})
	if err != nil {
		return preview, err
	}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if fields := strings.Split(line, "\x1f"); len(fields) == 3 {
			preview.Commits = append(preview.Commits, octohubStructs.Commit{Hash: fields[0], Author: fields[1], Title: fields[2]})
		}
	}

	if ahead > 0 && behind > 0 {
		args := []string{"-c", "core.quotePath=false", "merge-tree", "--write-tree", "--name-only", "--no-messages", "HEAD", branch}
		out, exitCode, err := handlerStruct.gitHandler.runGit(ctx, args, "")
		if exitCode == 1 {
			lines := strings.Split(strings.TrimSpace(string(out)), "\n")
			for _, file := range lines[1:] {
				if file = strings.TrimSpace(file); file != "" {
					preview.ConflictingFiles = append(preview.ConflictingFiles, file)
				}
			}
		} else if err != nil {
			return preview, err
		}
	}
	return preview, nil
}

func (handlerStruct *GitBranchHandler) MergeBranch(ctx context.Context, branch, strategy, message string, stashChanges bool) (octohubStructs.OperationState, error) {
	if err := validBranchArgument(branch); err != nil {
		return octohubStructs.OperationState{}, err
	}
	state, err := handlerStruct.GetOperationState(ctx)
	if err != nil {
		return state, err
	}
	if state.Kind != "" {
		return state, fmt.Errorf("conclua ou aborte o %s em andamento antes", operationNames[state.Kind])
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "-q", "HEAD"}); err != nil {
		return state, fmt.Errorf("faça o primeiro commit antes de mesclar outra branch")
	}

	if stashChanges {
		dirty, err := handlerStruct.HasUncommittedChanges(ctx)
		if err != nil {
			return state, err
		}
		if dirty {
			stashMessage := "OctoHub: alterações guardadas antes de mesclar " + branch
			if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"stash", "push", "-u", "-m", stashMessage}); err != nil {
				return state, fmt.Errorf("erro ao guardar as alterações em stash: %w", err)
			}
		}
	}

	var args []string
	switch strategy {
	case octohubStructs.MergeStrategyMerge:
		args = []string{"merge", "--no-edit", branch}
	case octohubStructs.MergeStrategyNoFF:
		args = []string{"merge", "--no-ff", "--no-edit"}
		if summary := strings.TrimSpace(message); summary != "" {
			args = append(args, "-m", summary)
		}
		args = append(args, branch)
	case octohubStructs.MergeStrategySquash:
		if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"reset", "-q", "--", "."}); err != nil {
			return state, err
		}
		args = []string{"merge", "--squash", branch}
	case octohubStructs.MergeStrategyRebase:
		args = []string{"rebase", branch}
	default:
		return state, fmt.Errorf("estratégia de merge desconhecida: %s", strategy)
	}

	runErr := handlerStruct.runNonInteractive(ctx, args, "")
	state, err = handlerStruct.GetOperationState(ctx)
	if runErr != nil {
		if err == nil && len(state.ConflictingFiles) > 0 {
			if summary := strings.TrimSpace(message); summary != "" && state.Kind == "squash" {
				if writeErr := os.WriteFile(handlerStruct.gitPath(ctx, "SQUASH_MSG"), []byte(summary+"\n"), 0o644); writeErr == nil {
					state.Message = summary
				}
			}
			return state, nil
		}
		return state, fmt.Errorf("erro ao mesclar %s: %w", branch, runErr)
	}

	if strategy == octohubStructs.MergeStrategySquash {
		if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"diff", "--cached", "--quiet"}); err == nil {
			return handlerStruct.GetOperationState(ctx)
		}
		summary := strings.TrimSpace(message)
		if summary == "" {
			summary = "Squash de " + branch
		}
		if err := handlerStruct.runNonInteractive(ctx, []string{"commit", "-F", "-"}, summary); err != nil {
			return state, fmt.Errorf("erro ao criar o commit do squash: %w", err)
		}
	}
	return handlerStruct.GetOperationState(ctx)
}

func (handlerStruct *GitBranchHandler) gitPath(ctx context.Context, name string) string {
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--git-path", name})
	if err != nil {
		return ""
	}
	path := strings.TrimSpace(string(out))
	if !filepath.IsAbs(path) {
		path = filepath.Join(handlerStruct.gitHandler.repositoryPath(ctx), path)
	}
	return path
}

func (handlerStruct *GitBranchHandler) gitPathExists(ctx context.Context, name string) bool {
	path := handlerStruct.gitPath(ctx, name)
	if path == "" {
		return false
	}
	_, err := os.Stat(path)
	return err == nil
}

func (handlerStruct *GitBranchHandler) readGitFile(ctx context.Context, name string) string {
	data, err := os.ReadFile(handlerStruct.gitPath(ctx, name))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func (handlerStruct *GitBranchHandler) GetOperationState(ctx context.Context) (octohubStructs.OperationState, error) {
	state := octohubStructs.OperationState{ConflictingFiles: []string{}}

	switch {
	case handlerStruct.gitPathExists(ctx, "rebase-merge"), handlerStruct.gitPathExists(ctx, "rebase-apply"):
		folder, stepFile, totalFile := "rebase-merge", "msgnum", "end"
		if !handlerStruct.gitPathExists(ctx, folder) {
			folder, stepFile, totalFile = "rebase-apply", "next", "last"
		}
		state.Kind = "rebase"
		state.Branch = strings.TrimPrefix(handlerStruct.readGitFile(ctx, folder+"/head-name"), "refs/heads/")
		state.Step, _ = strconv.Atoi(handlerStruct.readGitFile(ctx, folder+"/"+stepFile))
		state.Total, _ = strconv.Atoi(handlerStruct.readGitFile(ctx, folder+"/"+totalFile))
	case handlerStruct.gitPathExists(ctx, "MERGE_HEAD"):
		state.Kind = "merge"
		state.Message = handlerStruct.readGitFile(ctx, "MERGE_MSG")
		if match := mergeMessageBranchRegex.FindStringSubmatch(state.Message); match != nil {
			state.Branch = match[1]
		}
	case handlerStruct.gitPathExists(ctx, "CHERRY_PICK_HEAD"):
		state.Kind = "cherry-pick"
	case handlerStruct.gitPathExists(ctx, "REVERT_HEAD"):
		state.Kind = "revert"
	case handlerStruct.gitPathExists(ctx, "SQUASH_MSG"):
		if dirty, err := handlerStruct.HasUncommittedChanges(ctx); err != nil || !dirty {
			return state, err
		}
		state.Kind = "squash"
		state.Message = handlerStruct.readGitFile(ctx, "SQUASH_MSG")
	}

	if state.Kind != "" {
		files, err := handlerStruct.unmergedFiles(ctx)
		if err != nil {
			return state, err
		}
		state.ConflictingFiles = files
	}
	return state, nil
}

func (handlerStruct *GitBranchHandler) unmergedFiles(ctx context.Context) ([]string, error) {
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"diff", "--name-only", "--diff-filter=U", "-z"})
	if err != nil {
		return nil, err
	}
	files := []string{}
	for _, file := range strings.Split(string(out), "\x00") {
		if file != "" && (len(files) == 0 || files[len(files)-1] != file) {
			files = append(files, file)
		}
	}
	return files, nil
}

func hasConflictMarkers(content []byte) bool {
	for _, line := range bytes.Split(content, []byte("\n")) {
		if bytes.HasPrefix(line, []byte("<<<<<<< ")) || bytes.HasPrefix(line, []byte(">>>>>>> ")) {
			return true
		}
	}
	return false
}

func (handlerStruct *GitBranchHandler) stageResolvedFiles(ctx context.Context, files []string) ([]string, error) {
	var resolved, pending []string
	for _, file := range files {
		content, err := os.ReadFile(filepath.Join(handlerStruct.gitHandler.repositoryPath(ctx), filepath.FromSlash(file)))
		if err != nil || hasConflictMarkers(content) {
			pending = append(pending, file)
			continue
		}
		resolved = append(resolved, file)
	}
	if len(resolved) > 0 {
		args := []string{"--literal-pathspecs", "add", "--force", "--pathspec-from-file=-", "--pathspec-file-nul"}
		if _, err := handlerStruct.gitHandler.runGitCommandWithInput(ctx, args, strings.Join(resolved, "\x00")); err != nil {
			return pending, err
		}
	}
	return pending, nil
}

func cleanCommitMessage(message string) string {
	var lines []string
	for _, line := range strings.Split(message, "\n") {
		if !strings.HasPrefix(line, "#") {
			lines = append(lines, line)
		}
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func (handlerStruct *GitBranchHandler) ContinueOperation(ctx context.Context, message string) (octohubStructs.OperationState, error) {
	state, err := handlerStruct.GetOperationState(ctx)
	if err != nil || state.Kind == "" {
		return state, err
	}

	pending, err := handlerStruct.stageResolvedFiles(ctx, state.ConflictingFiles)
	if err != nil {
		return state, err
	}
	if len(pending) > 0 {
		return state, fmt.Errorf("ainda há conflitos para resolver em: %s", strings.Join(pending, ", "))
	}

	args, input := []string{}, ""
	switch state.Kind {
	case "merge", "squash":
		summary := strings.TrimSpace(message)
		if summary == "" {
			summary = cleanCommitMessage(state.Message)
		}
		if summary == "" {
			args = []string{"commit", "--no-edit"}
		} else {
			args, input = []string{"commit", "--cleanup=strip", "-F", "-"}, summary
		}
	default:
		args = []string{state.Kind, "--continue"}
	}

	runErr := handlerStruct.runNonInteractive(ctx, args, input)
	next, err := handlerStruct.GetOperationState(ctx)
	if runErr != nil {
		if err == nil && next.Kind != "" && len(next.ConflictingFiles) > 0 {
			return next, nil
		}
		return next, fmt.Errorf("erro ao continuar o %s: %w", operationNames[state.Kind], runErr)
	}
	return next, err
}

func (handlerStruct *GitBranchHandler) AbortOperation(ctx context.Context) error {
	state, err := handlerStruct.GetOperationState(ctx)
	if err != nil || state.Kind == "" {
		return err
	}
	args := []string{state.Kind, "--abort"}
	if state.Kind == "squash" {
		args = []string{"reset", "--merge"}
	}
	return handlerStruct.runNonInteractive(ctx, args, "")
}

func (handlerStruct *GitBranchHandler) SkipRebaseCommit(ctx context.Context) (octohubStructs.OperationState, error) {
	runErr := handlerStruct.runNonInteractive(ctx, []string{"rebase", "--skip"}, "")
	state, err := handlerStruct.GetOperationState(ctx)
	if runErr != nil {
		if err == nil && len(state.ConflictingFiles) > 0 {
			return state, nil
		}
		return state, fmt.Errorf("erro ao pular o commit: %w", runErr)
	}
	return state, err
}
