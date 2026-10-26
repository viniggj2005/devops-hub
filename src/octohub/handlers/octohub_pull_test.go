package octohubHandler

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func gitOutput(test *testing.T, folder string, args ...string) string {
	out, err := exec.Command("git", append([]string{"-C", folder}, args...)...).CombinedOutput()
	if err != nil {
		test.Fatalf("git %s failed: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

func currentBranchInfo(test *testing.T, branchHandler *GitBranchHandler) (int, int) {
	branches, err := branchHandler.ListBranches(context.Background())
	if err != nil {
		test.Fatalf("unexpected error listing branches: %v", err)
	}
	for _, branch := range branches {
		if branch.IsCurrent {
			return branch.Ahead, branch.Behind
		}
	}
	test.Fatalf("no current branch in %+v", branches)
	return 0, 0
}

func TestFetchThenPullBringsRemoteCommits(test *testing.T) {
	_, repositoryHandler, _, branchHandler, _, token := setupOctohubIntegration(test)
	ctx := context.Background()

	parentDir := test.TempDir()
	createdRepo, err := repositoryHandler.CreateRepository(ctx, token, parentDir, "local-repo", true)
	if err != nil {
		test.Fatalf("unexpected error creating repository: %v", err)
	}
	localPath := createdRepo.Path
	configureGitUser(test, localPath)
	if _, err := repositoryHandler.SelectRepository(ctx, token, createdRepo.ID); err != nil {
		test.Fatalf("unexpected error selecting repository: %v", err)
	}
	gitOutput(test, localPath, "commit", "--allow-empty", "-m", "base")
	branch := gitOutput(test, localPath, "symbolic-ref", "--short", "HEAD")

	remotePath := filepath.Join(parentDir, "remote.git")
	gitOutput(test, parentDir, "init", "--bare", "-b", branch, remotePath)
	gitOutput(test, localPath, "remote", "add", "origin", remotePath)
	gitOutput(test, localPath, "push", "-u", "origin", branch)

	otherMachine := filepath.Join(parentDir, "other-machine")
	gitOutput(test, parentDir, "clone", remotePath, otherMachine)
	configureGitUser(test, otherMachine)
	if err := os.WriteFile(filepath.Join(otherMachine, "from-remote.txt"), []byte("remote change\n"), 0o644); err != nil {
		test.Fatalf("unexpected error writing remote file: %v", err)
	}
	gitOutput(test, otherMachine, "add", "from-remote.txt")
	gitOutput(test, otherMachine, "commit", "-m", "remote change")
	gitOutput(test, otherMachine, "push", "origin", branch)

	if _, behind := currentBranchInfo(test, branchHandler); behind != 0 {
		test.Fatalf("expected no known remote commits before fetching, got %d", behind)
	}
	if err := branchHandler.FetchRemotes(ctx); err != nil {
		test.Fatalf("unexpected error fetching: %v", err)
	}
	if _, behind := currentBranchInfo(test, branchHandler); behind != 1 {
		test.Fatalf("expected fetch to reveal 1 remote commit, got %d", behind)
	}

	state, err := branchHandler.PullCurrentBranch(ctx)
	if err != nil || state.Kind != "" {
		test.Fatalf("unexpected pull result: %+v, err=%v", state, err)
	}
	if ahead, behind := currentBranchInfo(test, branchHandler); ahead != 0 || behind != 0 {
		test.Fatalf("expected the branch to be in sync after pulling, got ahead=%d behind=%d", ahead, behind)
	}
	if _, err := os.Stat(filepath.Join(localPath, "from-remote.txt")); err != nil {
		test.Fatalf("expected the remote file to be pulled: %v", err)
	}

	gitOutput(test, localPath, "branch", "--unset-upstream")
	if _, err := branchHandler.PullCurrentBranch(ctx); err == nil {
		test.Fatalf("expected pull without upstream to fail")
	}
}
