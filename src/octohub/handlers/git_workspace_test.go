package octohubHandler

import (
	"context"
	"testing"

	"docker-manager-go/src/desktop"
)

func TestGitWorkspacesAreIsolatedPerWindow(test *testing.T) {
	gitHandler := NewGitHandler("C:/initial")
	mainWindow := desktop.WithWindowName(context.Background(), "main")
	moduleWindow := desktop.WithWindowName(context.Background(), "module-1")

	if path := gitHandler.repositoryPath(moduleWindow); path != "C:/initial" {
		test.Fatalf("expected a new window to start on the initial repository, got %q", path)
	}

	gitHandler.setRepoPath(mainWindow, "C:/repo-a")
	gitHandler.setRepoPath(moduleWindow, "C:/repo-b")
	if path := gitHandler.repositoryPath(mainWindow); path != "C:/repo-a" {
		test.Fatalf("expected main window on repo-a, got %q", path)
	}
	if path := gitHandler.repositoryPath(moduleWindow); path != "C:/repo-b" {
		test.Fatalf("expected module window on repo-b, got %q", path)
	}

	gitHandler.refreshAuth(func(path string) (gitAuth, bool) {
		return gitAuth{knownHosts: path + "/known_hosts"}, path == "C:/repo-b"
	})
	if knownHosts := gitHandler.workspace(moduleWindow).auth.knownHosts; knownHosts != "C:/repo-b/known_hosts" {
		test.Fatalf("expected module window auth to refresh, got %q", knownHosts)
	}
	if knownHosts := gitHandler.workspace(mainWindow).auth.knownHosts; knownHosts != "" {
		test.Fatalf("expected main window auth to stay untouched, got %q", knownHosts)
	}

	gitHandler.forgetRepository("C:/repo-a")
	if path := gitHandler.repositoryPath(mainWindow); path != "" {
		test.Fatalf("expected removed repository to be cleared from main window, got %q", path)
	}
	if path := gitHandler.repositoryPath(moduleWindow); path != "C:/repo-b" {
		test.Fatalf("expected module window to keep repo-b, got %q", path)
	}
	if _, err := gitHandler.runGitCommand(mainWindow, []string{"status"}); err != errNoRepository {
		test.Fatalf("expected git to refuse running without a repository, got %v", err)
	}

	gitHandler.releaseWindow("module-1")
	if path := gitHandler.repositoryPath(moduleWindow); path != "C:/initial" {
		test.Fatalf("expected a closed window to forget its repository, got %q", path)
	}
}
