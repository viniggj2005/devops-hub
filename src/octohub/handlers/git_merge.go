package octohubHandler

import (
	"bytes"
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

func (handlerStruct *GitBranchHandler) runNonInteractive(args []string, input string) error {
	_, _, err := handlerStruct.gitHandler.runGit(args, input, nonInteractiveEnv...)
	return err
}

func (handlerStruct *GitBranchHandler) ListMergeableBranches() ([]octohubStructs.BranchInfo, error) {
	args := []string{
		"for-each-ref", "--sort=-committerdate",
		"--format=%(refname)%00%(refname:short)%00%(HEAD)",
		"refs/heads", "refs/remotes",
	}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
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

func (handlerStruct *GitBranchHandler) GetDefaultBranch() string {
	if out, err := handlerStruct.gitHandler.RunGitCommand([]string{"symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"}); err == nil {
		if _, name, found := strings.Cut(strings.TrimSpace(string(out)), "/"); found {
			return name
		}
	}
	for _, name := range []string{"main", "master"} {
		if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-parse", "--verify", "-q", "refs/heads/" + name}); err == nil {
			return name
		}
	}
	return ""
}

func (handlerStruct *GitBranchHandler) FetchRemotes() error {
	_, err := handlerStruct.gitHandler.RunGitCommand([]string{"fetch", "--all", "--prune"})
	return err
}

func (handlerStruct *GitBranchHandler) revCount(revisionRange string) (int, error) {
	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-list", "--count", revisionRange})
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

func (handlerStruct *GitBranchHandler) GetMergePreview(branch string) (octohubStructs.MergePreview, error) {
	preview := octohubStructs.MergePreview{Commits: []octohubStructs.Commit{}, ConflictingFiles: []string{}}
	if err := validBranchArgument(branch); err != nil {
		return preview, err
	}

	ahead, err := handlerStruct.revCount("HEAD.." + branch)
	if err != nil {
		return preview, err
	}
	behind, err := handlerStruct.revCount(branch + "..HEAD")
	if err != nil {
		return preview, err
	}
	preview.Ahead = ahead
	preview.Behind = behind
	preview.UpToDate = ahead == 0
	preview.CanFastForward = ahead > 0 && behind == 0

	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"log", "-n", "30", "--format=%h%x1f%an%x1f%s", "HEAD.." + branch})
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
		out, exitCode, err := handlerStruct.gitHandler.runGit(args, "")
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

func (handlerStruct *GitBranchHandler) MergeBranch(branch, strategy, message string, stashChanges bool) (octohubStructs.OperationState, error) {
	if err := validBranchArgument(branch); err != nil {
		return octohubStructs.OperationState{}, err
	}
	state, err := handlerStruct.GetOperationState()
	if err != nil {
		return state, err
	}
	if state.Kind != "" {
		return state, fmt.Errorf("conclua ou aborte o %s em andamento antes", operationNames[state.Kind])
	}
	if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-parse", "--verify", "-q", "HEAD"}); err != nil {
		return state, fmt.Errorf("faça o primeiro commit antes de mesclar outra branch")
	}

	if stashChanges {
		dirty, err := handlerStruct.HasUncommittedChanges()
		if err != nil {
			return state, err
		}
		if dirty {
			stashMessage := "OctoHub: alterações guardadas antes de mesclar " + branch
			if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"stash", "push", "-u", "-m", stashMessage}); err != nil {
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
		if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"reset", "-q", "--", "."}); err != nil {
			return state, err
		}
		args = []string{"merge", "--squash", branch}
	case octohubStructs.MergeStrategyRebase:
		args = []string{"rebase", branch}
	default:
		return state, fmt.Errorf("estratégia de merge desconhecida: %s", strategy)
	}

	runErr := handlerStruct.runNonInteractive(args, "")
	state, err = handlerStruct.GetOperationState()
	if runErr != nil {
		if err == nil && len(state.ConflictingFiles) > 0 {
			if summary := strings.TrimSpace(message); summary != "" && state.Kind == "squash" {
				if writeErr := os.WriteFile(handlerStruct.gitPath("SQUASH_MSG"), []byte(summary+"\n"), 0o644); writeErr == nil {
					state.Message = summary
				}
			}
			return state, nil
		}
		return state, fmt.Errorf("erro ao mesclar %s: %w", branch, runErr)
	}

	if strategy == octohubStructs.MergeStrategySquash {
		if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"diff", "--cached", "--quiet"}); err == nil {
			return handlerStruct.GetOperationState()
		}
		summary := strings.TrimSpace(message)
		if summary == "" {
			summary = "Squash de " + branch
		}
		if err := handlerStruct.runNonInteractive([]string{"commit", "-F", "-"}, summary); err != nil {
			return state, fmt.Errorf("erro ao criar o commit do squash: %w", err)
		}
	}
	return handlerStruct.GetOperationState()
}

func (handlerStruct *GitBranchHandler) gitPath(name string) string {
	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-parse", "--git-path", name})
	if err != nil {
		return ""
	}
	path := strings.TrimSpace(string(out))
	if !filepath.IsAbs(path) {
		path = filepath.Join(handlerStruct.gitHandler.RepoPath(), path)
	}
	return path
}

func (handlerStruct *GitBranchHandler) gitPathExists(name string) bool {
	path := handlerStruct.gitPath(name)
	if path == "" {
		return false
	}
	_, err := os.Stat(path)
	return err == nil
}

func (handlerStruct *GitBranchHandler) readGitFile(name string) string {
	data, err := os.ReadFile(handlerStruct.gitPath(name))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func (handlerStruct *GitBranchHandler) GetOperationState() (octohubStructs.OperationState, error) {
	state := octohubStructs.OperationState{ConflictingFiles: []string{}}

	switch {
	case handlerStruct.gitPathExists("rebase-merge"), handlerStruct.gitPathExists("rebase-apply"):
		folder, stepFile, totalFile := "rebase-merge", "msgnum", "end"
		if !handlerStruct.gitPathExists(folder) {
			folder, stepFile, totalFile = "rebase-apply", "next", "last"
		}
		state.Kind = "rebase"
		state.Branch = strings.TrimPrefix(handlerStruct.readGitFile(folder+"/head-name"), "refs/heads/")
		state.Step, _ = strconv.Atoi(handlerStruct.readGitFile(folder + "/" + stepFile))
		state.Total, _ = strconv.Atoi(handlerStruct.readGitFile(folder + "/" + totalFile))
	case handlerStruct.gitPathExists("MERGE_HEAD"):
		state.Kind = "merge"
		state.Message = handlerStruct.readGitFile("MERGE_MSG")
		if match := mergeMessageBranchRegex.FindStringSubmatch(state.Message); match != nil {
			state.Branch = match[1]
		}
	case handlerStruct.gitPathExists("CHERRY_PICK_HEAD"):
		state.Kind = "cherry-pick"
	case handlerStruct.gitPathExists("REVERT_HEAD"):
		state.Kind = "revert"
	case handlerStruct.gitPathExists("SQUASH_MSG"):
		if dirty, err := handlerStruct.HasUncommittedChanges(); err != nil || !dirty {
			return state, err
		}
		state.Kind = "squash"
		state.Message = handlerStruct.readGitFile("SQUASH_MSG")
	}

	if state.Kind != "" {
		files, err := handlerStruct.unmergedFiles()
		if err != nil {
			return state, err
		}
		state.ConflictingFiles = files
	}
	return state, nil
}

func (handlerStruct *GitBranchHandler) unmergedFiles() ([]string, error) {
	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"diff", "--name-only", "--diff-filter=U", "-z"})
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

func (handlerStruct *GitBranchHandler) stageResolvedFiles(files []string) ([]string, error) {
	var resolved, pending []string
	for _, file := range files {
		content, err := os.ReadFile(filepath.Join(handlerStruct.gitHandler.RepoPath(), filepath.FromSlash(file)))
		if err != nil || hasConflictMarkers(content) {
			pending = append(pending, file)
			continue
		}
		resolved = append(resolved, file)
	}
	if len(resolved) > 0 {
		args := []string{"--literal-pathspecs", "add", "--pathspec-from-file=-", "--pathspec-file-nul"}
		if _, err := handlerStruct.gitHandler.RunGitCommandWithInput(args, strings.Join(resolved, "\x00")); err != nil {
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

func (handlerStruct *GitBranchHandler) ContinueOperation(message string) (octohubStructs.OperationState, error) {
	state, err := handlerStruct.GetOperationState()
	if err != nil || state.Kind == "" {
		return state, err
	}

	pending, err := handlerStruct.stageResolvedFiles(state.ConflictingFiles)
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

	runErr := handlerStruct.runNonInteractive(args, input)
	next, err := handlerStruct.GetOperationState()
	if runErr != nil {
		if err == nil && next.Kind != "" && len(next.ConflictingFiles) > 0 {
			return next, nil
		}
		return next, fmt.Errorf("erro ao continuar o %s: %w", operationNames[state.Kind], runErr)
	}
	return next, err
}

func (handlerStruct *GitBranchHandler) AbortOperation() error {
	state, err := handlerStruct.GetOperationState()
	if err != nil || state.Kind == "" {
		return err
	}
	args := []string{state.Kind, "--abort"}
	if state.Kind == "squash" {
		args = []string{"reset", "--merge"}
	}
	return handlerStruct.runNonInteractive(args, "")
}

func (handlerStruct *GitBranchHandler) SkipRebaseCommit() (octohubStructs.OperationState, error) {
	runErr := handlerStruct.runNonInteractive([]string{"rebase", "--skip"}, "")
	state, err := handlerStruct.GetOperationState()
	if runErr != nil {
		if err == nil && len(state.ConflictingFiles) > 0 {
			return state, nil
		}
		return state, fmt.Errorf("erro ao pular o commit: %w", runErr)
	}
	return state, err
}
