package octohubHandler

import (
	"os"
	"context"
	"strings"
	"testing"
	"path/filepath"

	octohubStructs "docker-manager-go/src/octohub/structs"
)

func prepareConflictingBranches(test *testing.T, name string) (*GitBranchHandler, string, string) {
	_, repositoryHandler, _, branchHandler, _, token := setupOctohubIntegration(test)
	ctx := context.Background()

	createdRepo, err := repositoryHandler.CreateRepository(ctx, token, test.TempDir(), name, false)
	if err != nil {
		test.Fatalf("unexpected error creating repository: %v", err)
	}
	repoPath := createdRepo.Path
	configureGitUser(test, repoPath)
	if _, err := repositoryHandler.SelectRepository(ctx, token, createdRepo.ID); err != nil {
		test.Fatalf("unexpected error selecting repository: %v", err)
	}

	sharedFile := filepath.Join(repoPath, "shared.txt")
	writeShared := func(content string) {
		if err := os.WriteFile(sharedFile, []byte(content), 0o644); err != nil {
			test.Fatalf("unexpected error writing shared file: %v", err)
		}
	}

	writeShared("base\n")
	gitOutput(test, repoPath, "add", "shared.txt")
	gitOutput(test, repoPath, "commit", "-m", "base")
	mainBranch := gitOutput(test, repoPath, "symbolic-ref", "--short", "HEAD")

	gitOutput(test, repoPath, "checkout", "-b", "feature")
	writeShared("feature\n")
	gitOutput(test, repoPath, "commit", "-am", "feature change")

	gitOutput(test, repoPath, "checkout", mainBranch)
	writeShared("main\n")
	gitOutput(test, repoPath, "commit", "-am", "main change")

	return branchHandler, repoPath, mainBranch
}

func readSharedFile(test *testing.T, repoPath string) string {
	content, err := os.ReadFile(filepath.Join(repoPath, "shared.txt"))
	if err != nil {
		test.Fatalf("unexpected error reading shared file: %v", err)
	}
	return strings.TrimSpace(string(content))
}

func resolveSharedConflict(test *testing.T, branchHandler *GitBranchHandler, resolution string) {
	ctx := context.Background()

	report, err := branchHandler.CheckConflicts(ctx, nil)
	if err != nil || len(report.Files) != 1 || report.Files[0].Resolved || report.Files[0].Markers != 1 {
		test.Fatalf("expected one unresolved conflict with one marker, got %+v err=%v", report.Files, err)
	}

	if err := branchHandler.ResolveConflict(ctx, "shared.txt", resolution); err != nil {
		test.Fatalf("unexpected error resolving conflict: %v", err)
	}

	report, err = branchHandler.CheckConflicts(ctx, []string{"shared.txt"})
	if err != nil || len(report.Files) != 1 || !report.Files[0].Resolved {
		test.Fatalf("expected the conflict to be reported as resolved, got %+v err=%v", report.Files, err)
	}
}

func TestMergeConflictIsDetectedAndResolved(test *testing.T) {
	branchHandler, repoPath, _ := prepareConflictingBranches(test, "merge-conflict-repo")
	ctx := context.Background()

	state, err := branchHandler.MergeBranch(ctx, "feature", octohubStructs.MergeStrategyMerge, "", false)
	if err != nil || state.Kind != "merge" || len(state.ConflictingFiles) != 1 || state.ConflictingFiles[0] != "shared.txt" {
		test.Fatalf("expected a merge conflict in shared.txt, got %+v err=%v", state, err)
	}
	if state.Branch != "feature" {
		test.Fatalf("expected the merge state to name the feature branch, got %q", state.Branch)
	}

	resolveSharedConflict(test, branchHandler, "ours")

	next, err := branchHandler.ContinueOperation(ctx, "")
	if err != nil || next.Kind != "" {
		test.Fatalf("expected the merge to conclude, got %+v err=%v", next, err)
	}
	if content := readSharedFile(test, repoPath); content != "main" {
		test.Fatalf("expected our version to be kept, got %q", content)
	}
}

func TestRebaseConflictReportsProgressAndResolves(test *testing.T) {
	branchHandler, repoPath, mainBranch := prepareConflictingBranches(test, "rebase-conflict-repo")
	ctx := context.Background()

	state, err := branchHandler.MergeBranch(ctx, "feature", octohubStructs.MergeStrategyRebase, "", false)
	if err != nil || state.Kind != "rebase" || len(state.ConflictingFiles) != 1 {
		test.Fatalf("expected a rebase conflict, got %+v err=%v", state, err)
	}
	if state.Branch != mainBranch || state.Step != 1 || state.Total != 1 {
		test.Fatalf("expected rebase of %s at step 1/1, got branch=%q step=%d total=%d", mainBranch, state.Branch, state.Step, state.Total)
	}

	resolveSharedConflict(test, branchHandler, "theirs")

	next, err := branchHandler.ContinueOperation(ctx, "")
	if err != nil || next.Kind != "" {
		test.Fatalf("expected the rebase to conclude, got %+v err=%v", next, err)
	}
	if after, err := branchHandler.GetOperationState(ctx); err != nil || after.Kind != "" {
		test.Fatalf("expected no operation after the rebase, got %+v err=%v", after, err)
	}
	if content := readSharedFile(test, repoPath); content != "main" {
		test.Fatalf("expected the replayed main change to win, got %q", content)
	}
}
