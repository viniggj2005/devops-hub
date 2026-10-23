package octohubHandler

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"

	octohubStructs "docker-manager-go/src/octohub/structs"
)

var commitHashRegex = regexp.MustCompile(`^[0-9a-fA-F]{7,64}$`)

func validCommitHash(hash string) error {
	if !commitHashRegex.MatchString(hash) {
		return fmt.Errorf("commit inválido: %q", hash)
	}
	return nil
}

func (handlerStruct *GitBranchHandler) isMergeCommit(ctx context.Context, hash string) bool {
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-list", "--parents", "-n", "1", hash})
	return err == nil && len(strings.Fields(string(out))) > 2
}

func (handlerStruct *GitBranchHandler) ensureNoOperation(ctx context.Context) error {
	state, err := handlerStruct.GetOperationState(ctx)
	if err != nil {
		return err
	}
	if state.Kind != "" {
		return fmt.Errorf("conclua ou aborte o %s em andamento antes", operationNames[state.Kind])
	}
	return nil
}

func (handlerStruct *GitBranchHandler) stashBefore(ctx context.Context, action string) error {
	dirty, err := handlerStruct.HasUncommittedChanges(ctx)
	if err != nil || !dirty {
		return err
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"stash", "push", "-u", "-m", "OctoHub: alterações guardadas antes de " + action}); err != nil {
		return fmt.Errorf("erro ao guardar as alterações em stash: %w", err)
	}
	return nil
}

func (handlerStruct *GitBranchHandler) runStoppableCommand(ctx context.Context, args []string, failure string, extraEnv ...string) (octohubStructs.OperationState, error) {
	_, _, runErr := handlerStruct.gitHandler.runGit(ctx, args, "", append(append([]string{}, nonInteractiveEnv...), extraEnv...)...)
	state, err := handlerStruct.GetOperationState(ctx)
	if runErr != nil {
		if err == nil && len(state.ConflictingFiles) > 0 {
			return state, nil
		}
		return state, fmt.Errorf("%s: %w", failure, runErr)
	}
	return state, err
}

func (handlerStruct *GitBranchHandler) CheckoutCommit(ctx context.Context, hash string, leaveChanges bool) error {
	if err := validCommitHash(hash); err != nil {
		return err
	}
	return handlerStruct.ChangeBranch(ctx, hash, false, leaveChanges)
}

func (handlerStruct *GitBranchHandler) RevertCommit(ctx context.Context, hash string) (octohubStructs.OperationState, error) {
	if err := validCommitHash(hash); err != nil {
		return octohubStructs.OperationState{}, err
	}
	if err := handlerStruct.ensureNoOperation(ctx); err != nil {
		return octohubStructs.OperationState{}, err
	}
	args := []string{"revert", "--no-edit"}
	if handlerStruct.isMergeCommit(ctx, hash) {
		args = append(args, "-m", "1")
	}
	return handlerStruct.runStoppableCommand(ctx, append(args, hash), "erro ao reverter o commit")
}

func (handlerStruct *GitBranchHandler) CreateBranchFromCommit(ctx context.Context, name, hash string, checkout bool) error {
	if err := validCommitHash(hash); err != nil {
		return err
	}
	name = strings.TrimSpace(name)
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"check-ref-format", "--branch", name}); err != nil || name == "" {
		return fmt.Errorf("nome de branch inválido: %s", name)
	}
	args := []string{"branch", name, hash}
	if checkout {
		args = []string{"checkout", "-b", name, hash}
	}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	return err
}

func (handlerStruct *GitBranchHandler) CreateTag(ctx context.Context, name, hash, message string) error {
	if err := validCommitHash(hash); err != nil {
		return err
	}
	name = strings.TrimSpace(name)
	if name == "" || strings.HasPrefix(name, "-") {
		return fmt.Errorf("informe um nome de tag válido")
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"check-ref-format", "refs/tags/" + name}); err != nil {
		return fmt.Errorf("nome de tag inválido: %s", name)
	}
	args := []string{"tag"}
	if summary := strings.TrimSpace(message); summary != "" {
		args = append(args, "-a", "-m", summary)
	}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, append(args, name, hash))
	return err
}

func (handlerStruct *GitBranchHandler) PushTag(ctx context.Context, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || strings.HasPrefix(name, "-") {
		return fmt.Errorf("informe um nome de tag válido")
	}
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"push", "origin", "refs/tags/" + name})
	return err
}

func (handlerStruct *GitBranchHandler) CherryPickCommit(ctx context.Context, hash, targetBranch string, stashChanges bool) (octohubStructs.OperationState, error) {
	if err := validCommitHash(hash); err != nil {
		return octohubStructs.OperationState{}, err
	}
	if err := validBranchArgument(targetBranch); err != nil {
		return octohubStructs.OperationState{}, err
	}
	if err := handlerStruct.ensureNoOperation(ctx); err != nil {
		return octohubStructs.OperationState{}, err
	}
	if stashChanges {
		if err := handlerStruct.stashBefore(ctx, "o cherry-pick de "+hash[:min(len(hash), 7)]); err != nil {
			return octohubStructs.OperationState{}, err
		}
	}

	if current, _ := handlerStruct.GetCurrentBranch(ctx); current != targetBranch {
		if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"checkout", targetBranch}); err != nil {
			return octohubStructs.OperationState{}, fmt.Errorf("erro ao trocar para %s: %w", targetBranch, err)
		}
	}

	args := []string{"cherry-pick"}
	if handlerStruct.isMergeCommit(ctx, hash) {
		args = append(args, "-m", "1")
	}
	state, err := handlerStruct.runStoppableCommand(ctx, append(args, hash), "erro ao aplicar o commit")
	if err != nil && state.Kind == "cherry-pick" && len(state.ConflictingFiles) == 0 {
		handlerStruct.runNonInteractive(ctx, []string{"cherry-pick", "--abort"}, "")
		return octohubStructs.OperationState{}, fmt.Errorf("%s já tem essas alterações, não há nada para aplicar", targetBranch)
	}
	return state, err
}

func (handlerStruct *GitBranchHandler) ListReorderableCommits(ctx context.Context) ([]octohubStructs.ReorderableCommit, error) {
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"log", "--first-parent", "-n", "30", "--format=%H%x1f%h%x1f%P%x1f%an%x1f%s", "HEAD"})
	if err != nil {
		return nil, err
	}

	unpushed := map[string]bool{}
	upstreamOut, upstreamErr := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-list", "@{upstream}..HEAD"})
	for _, hash := range strings.Fields(string(upstreamOut)) {
		unpushed[hash] = true
	}

	commits := []octohubStructs.ReorderableCommit{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		fields := strings.Split(line, "\x1f")
		if len(fields) != 5 || len(strings.Fields(fields[2])) > 1 {
			break
		}
		commits = append(commits, octohubStructs.ReorderableCommit{
			Hash:      fields[0],
			ShortHash: fields[1],
			Author:    fields[3],
			Title:     fields[4],
			Pushed:    upstreamErr == nil && !unpushed[fields[0]],
		})
		if fields[2] == "" {
			break
		}
	}
	return commits, nil
}

func (handlerStruct *GitBranchHandler) ReorderCommits(ctx context.Context, order []string, stashChanges bool) (octohubStructs.OperationState, error) {
	if len(order) < 2 {
		return octohubStructs.OperationState{}, fmt.Errorf("escolha ao menos dois commits")
	}
	for _, hash := range order {
		if err := validCommitHash(hash); err != nil {
			return octohubStructs.OperationState{}, err
		}
	}
	if err := handlerStruct.ensureNoOperation(ctx); err != nil {
		return octohubStructs.OperationState{}, err
	}

	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-list", "--first-parent", "-n", fmt.Sprint(len(order)), "HEAD"})
	if err != nil {
		return octohubStructs.OperationState{}, err
	}
	current := strings.Fields(string(out))
	if len(current) != len(order) || !sameCommits(current, order) {
		return octohubStructs.OperationState{}, fmt.Errorf("o histórico mudou, abra a reordenação de novo")
	}

	changed := -1
	for index := range order {
		if order[index] != current[index] {
			changed = index
		}
	}
	if changed < 0 {
		return handlerStruct.GetOperationState(ctx)
	}

	base := current[changed] + "^"
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "-q", base}); err != nil {
		base = ""
	}
	if base != "" {
		if merges, _ := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-list", "--merges", base + "..HEAD"}); strings.TrimSpace(string(merges)) != "" {
			return octohubStructs.OperationState{}, fmt.Errorf("não dá para reordenar commits que têm um merge no meio")
		}
	}

	var todo strings.Builder
	for index := changed; index >= 0; index-- {
		todo.WriteString("pick " + order[index] + "\n")
	}
	file, err := os.CreateTemp("", "octohub-rebase-todo-*")
	if err != nil {
		return octohubStructs.OperationState{}, err
	}
	todoPath := file.Name()
	defer os.Remove(todoPath)
	_, err = file.WriteString(todo.String())
	file.Close()
	if err != nil {
		return octohubStructs.OperationState{}, err
	}

	if stashChanges {
		if err := handlerStruct.stashBefore(ctx, "reordenar commits"); err != nil {
			return octohubStructs.OperationState{}, err
		}
	}

	args := []string{"rebase", "-i", "--no-autosquash"}
	if base == "" {
		args = append(args, "--root")
	} else {
		args = append(args, base)
	}
	return handlerStruct.runStoppableCommand(ctx, args, "erro ao reordenar os commits", "GIT_SEQUENCE_EDITOR=cp "+shellQuote(todoPath))
}

func sameCommits(first, second []string) bool {
	seen := map[string]int{}
	for _, hash := range first {
		seen[hash]++
	}
	for _, hash := range second {
		seen[hash]--
	}
	for _, count := range seen {
		if count != 0 {
			return false
		}
	}
	return true
}
