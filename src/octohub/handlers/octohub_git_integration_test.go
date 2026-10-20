package octohubHandler

import (
	"bytes"
	"context"
	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	octohubDtos "docker-manager-go/src/octohub/dtos"
	octohubStructs "docker-manager-go/src/octohub/structs"
	"docker-manager-go/src/types"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupOctohubIntegration(test *testing.T) (*OctohubHandler, *RepositoryHandler, *GitHandler, *GitBranchHandler, *GitCommitsHandler, string) {
	sessionKey := hex.EncodeToString(bytes.Repeat([]byte{0x77}, 32))
	if err := types.SetSessionKey(sessionKey); err != nil {
		test.Fatalf("unexpected error setting session key: %v", err)
	}

	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(
		&models.UserModel{},
		&models.OctohubModel{},
		&models.GithubAccountModel{},
		&models.GitCredentialModel{},
	); err != nil {
		test.Fatalf("unexpected error migrating models: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	token, _, err := sessionManager.Create(1)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	ctx := context.Background()
	gitHandler := NewGitHandler("")
	gitHandler.Startup(ctx)

	octohubHandler := NewOctohubHandler(dataBase, sessionManager)
	octohubHandler.Startup(ctx)

	repositoryHandler := NewRepositoryHandler(dataBase, sessionManager, gitHandler)
	repositoryHandler.Startup(ctx)

	branchHandler := NewGitBranchHandler(gitHandler)
	commitsHandler := NewGitCommitsHandler(gitHandler)

	return octohubHandler, repositoryHandler, gitHandler, branchHandler, commitsHandler, token
}

func configureGitUser(test *testing.T, repoPath string) {
	if err := runGitIn(repoPath, "config", "user.name", "Test User"); err != nil {
		test.Fatalf("unexpected error configuring git user.name: %v", err)
	}
	if err := runGitIn(repoPath, "config", "user.email", "test@example.com"); err != nil {
		test.Fatalf("unexpected error configuring git user.email: %v", err)
	}
}

func TestOctohubAccountsAndCredentials(test *testing.T) {
	octohubHandler, repositoryHandler, _, _, _, token := setupOctohubIntegration(test)

	active, err := octohubHandler.GetActiveAccount(token)
	if err != nil || active != nil {
		test.Fatalf("expected no active account initially, got %+v, err=%v", active, err)
	}

	firstAccount, err := octohubHandler.upsertAccount(1, &githubUser{
		ID:        101,
		Login:     "alpha",
		Name:      "Alpha User",
		AvatarURL: "https://example.com/1.png",
	}, "tok-1", "repo")
	if err != nil || firstAccount.Login != "alpha" || !firstAccount.IsActive {
		test.Fatalf("unexpected first account: %+v, err=%v", firstAccount, err)
	}

	secondAccount, err := octohubHandler.upsertAccount(1, &githubUser{
		ID:        202,
		Login:     "beta",
		Name:      "Beta User",
		AvatarURL: "https://example.com/2.png",
	}, "tok-2", "repo")
	if err != nil || secondAccount.Login != "beta" || !secondAccount.IsActive {
		test.Fatalf("unexpected second account: %+v, err=%v", secondAccount, err)
	}

	accounts, err := octohubHandler.ListAccounts(token)
	if err != nil || len(accounts) != 2 {
		test.Fatalf("expected 2 accounts, got %+v, err=%v", accounts, err)
	}

	if err := octohubHandler.SwitchAccount(token, firstAccount.ID); err != nil {
		test.Fatalf("unexpected error switching account: %v", err)
	}

	active, err = octohubHandler.GetActiveAccount(token)
	if err != nil || active == nil || active.Login != "alpha" {
		test.Fatalf("expected alpha to be active, got %+v, err=%v", active, err)
	}

	if err := octohubHandler.RemoveAccount(token, firstAccount.ID); err != nil {
		test.Fatalf("unexpected error removing active account: %v", err)
	}

	active, err = octohubHandler.GetActiveAccount(token)
	if err != nil || active == nil || active.Login != "beta" {
		test.Fatalf("expected beta to become active after removing alpha, got %+v, err=%v", active, err)
	}

	if _, err := repositoryHandler.SaveGitCredential(token, octohubDtos.GitCredentialInput{
		Host: "",
	}); err == nil {
		test.Fatalf("expected error saving credential with empty host")
	}

	if _, err := repositoryHandler.SaveGitCredential(token, octohubDtos.GitCredentialInput{
		Host:     "gitlab.com",
		Password: "secret",
	}); err == nil {
		test.Fatalf("expected error saving password without username")
	}

	savedCred, err := repositoryHandler.SaveGitCredential(token, octohubDtos.GitCredentialInput{
		Host:     "https://gitlab.com/org/repo",
		Username: "vini",
		Password: "pat-token",
	})
	if err != nil || savedCred.Host != "gitlab.com" || !savedCred.HasPassword {
		test.Fatalf("unexpected saved credential: %+v, err=%v", savedCred, err)
	}

	credentials, err := repositoryHandler.ListGitCredentials(token)
	if err != nil || len(credentials) != 1 {
		test.Fatalf("expected 1 credential, got %+v, err=%v", credentials, err)
	}

	if err := repositoryHandler.RemoveGitCredential(token, savedCred.ID); err != nil {
		test.Fatalf("unexpected error removing credential: %v", err)
	}
}

func TestRepositoryCommitsBranchesMergeAndStashWorkflow(test *testing.T) {
	_, repositoryHandler, gitHandler, branchHandler, commitsHandler, token := setupOctohubIntegration(test)

	parentDir := test.TempDir()
	createdRepo, err := repositoryHandler.CreateRepository(token, parentDir, "sample-repo", false)
	if err != nil {
		test.Fatalf("unexpected error creating repository: %v", err)
	}
	repoPath := createdRepo.Path
	configureGitUser(test, repoPath)

	repositories, err := repositoryHandler.ListRepositories(token)
	if err != nil || len(repositories) != 1 {
		test.Fatalf("expected 1 repository, got %+v, err=%v", repositories, err)
	}

	currentRepo, err := repositoryHandler.GetCurrentRepository(token)
	if err != nil || currentRepo == nil || currentRepo.Path != repoPath {
		test.Fatalf("unexpected current repository: %+v, err=%v", currentRepo, err)
	}

	selectedRepo, err := repositoryHandler.SelectRepository(token, createdRepo.ID)
	if err != nil || selectedRepo.Path != repoPath {
		test.Fatalf("unexpected selected repository: %+v, err=%v", selectedRepo, err)
	}

	fileOne := filepath.Join(repoPath, "hello.txt")
	if err := os.WriteFile(fileOne, []byte("line 1\nline 2\n"), 0o644); err != nil {
		test.Fatalf("unexpected error writing hello.txt: %v", err)
	}

	statusList, err := commitsHandler.GetGitStatus()
	if err != nil || len(statusList) != 1 || statusList[0].FileName != "hello.txt" {
		test.Fatalf("unexpected status list: %+v, err=%v", statusList, err)
	}

	workingDiff, err := commitsHandler.GetUncommitedFileChanges(statusList[0])
	if err != nil || !strings.Contains(workingDiff.Diff, "+line 1") {
		test.Fatalf("unexpected working diff: %+v, err=%v", workingDiff, err)
	}

	firstCommitHash, err := commitsHandler.Commit(octohubStructs.CommitRequest{
		Summary:     "Initial commit",
		Description: "Add hello.txt",
		Files: []octohubStructs.CommitFileSelection{
			{FileName: "hello.txt", Kind: statusList[0].Kind, All: true},
		},
	})
	if err != nil || firstCommitHash == "" {
		test.Fatalf("unexpected error creating commit: %v", err)
	}

	if err := os.WriteFile(fileOne, []byte("line 1\nline 2 modified\nline 3\n"), 0o644); err != nil {
		test.Fatalf("unexpected error modifying hello.txt: %v", err)
	}

	secondCommitHash, err := commitsHandler.Commit(octohubStructs.CommitRequest{
		Summary: "Second commit",
		Files: []octohubStructs.CommitFileSelection{
			{FileName: "hello.txt", Kind: octohubStructs.FileKindModified, All: true},
		},
	})
	if err != nil || secondCommitHash == "" {
		test.Fatalf("unexpected error creating second commit: %v", err)
	}

	commitsList, err := commitsHandler.ListCommits(0)
	if err != nil || len(commitsList) != 2 {
		test.Fatalf("expected 2 commits, got %+v, err=%v", commitsList, err)
	}

	modifications, err := commitsHandler.GetCommitModifications(commitsList[0].Hash)
	if err != nil || len(modifications) != 1 || modifications[0].File != "hello.txt" {
		test.Fatalf("unexpected commit modifications: %+v, err=%v", modifications, err)
	}

	committedDiff, err := commitsHandler.GetCommitedFileChanges(commitsList[0].Hash, "hello.txt")
	if err != nil || !strings.Contains(committedDiff, "+line 2 modified") {
		test.Fatalf("unexpected committed file changes: %s, err=%v", committedDiff, err)
	}

	if err := branchHandler.CreateTag("v1.0.0", commitsList[0].Hash, "Release 1.0.0"); err != nil {
		test.Fatalf("unexpected error creating tag: %v", err)
	}

	if err := branchHandler.CreateAndCheckoutBranch("feature-branch"); err != nil {
		test.Fatalf("unexpected error creating and checking out branch: %v", err)
	}

	currentBranch, err := branchHandler.GetCurrentBranch()
	if err != nil || currentBranch != "feature-branch" {
		test.Fatalf("expected feature-branch, got %s, err=%v", currentBranch, err)
	}

	featureFile := filepath.Join(repoPath, "feature.txt")
	if err := os.WriteFile(featureFile, []byte("feature content\n"), 0o644); err != nil {
		test.Fatalf("unexpected error writing feature.txt: %v", err)
	}
	if _, err := commitsHandler.Commit(octohubStructs.CommitRequest{
		Summary: "Add feature",
		Files: []octohubStructs.CommitFileSelection{
			{FileName: "feature.txt", Kind: octohubStructs.FileKindUntracked, All: true},
		},
	}); err != nil {
		test.Fatalf("unexpected error committing feature: %v", err)
	}

	comparison, err := commitsHandler.CompareBranch("main")
	if err != nil || comparison.Ahead != 1 || comparison.Behind != 0 {
		test.Fatalf("unexpected branch comparison: %+v, err=%v", comparison, err)
	}

	aheadCommits, err := commitsHandler.ListCompareCommits("main", "ahead", 0)
	if err != nil || len(aheadCommits) != 1 {
		test.Fatalf("unexpected ahead commits: %+v, err=%v", aheadCommits, err)
	}

	if err := branchHandler.ChangeBranch("main", false, false); err != nil {
		test.Fatalf("unexpected error switching to main: %v", err)
	}

	branches, err := branchHandler.ListBranches()
	if err != nil || len(branches) < 2 {
		test.Fatalf("expected at least 2 branches, got %+v, err=%v", branches, err)
	}

	mergeable, err := branchHandler.ListMergeableBranches()
	if err != nil || len(mergeable) != 1 || mergeable[0].Name != "feature-branch" {
		test.Fatalf("unexpected mergeable branches: %+v, err=%v", mergeable, err)
	}

	preview, err := branchHandler.GetMergePreview("feature-branch")
	if err != nil || !preview.CanFastForward || preview.Ahead != 1 {
		test.Fatalf("unexpected merge preview: %+v, err=%v", preview, err)
	}

	mergeState, err := branchHandler.MergeBranch("feature-branch", octohubStructs.MergeStrategyMerge, "", false)
	if err != nil || mergeState.Kind != "" {
		test.Fatalf("unexpected merge state: %+v, err=%v", mergeState, err)
	}

	if err := branchHandler.DeleteBranch("feature-branch"); err != nil {
		test.Fatalf("unexpected error deleting merged branch: %v", err)
	}

	if err := branchHandler.CreateBranchFrom("hotfix", "main", false); err != nil {
		test.Fatalf("unexpected error creating branch without checkout: %v", err)
	}
	if currentBranch, _ := branchHandler.GetCurrentBranch(); currentBranch != "main" {
		test.Fatalf("expected to stay on main, got %s", currentBranch)
	}
	if err := branchHandler.CreateBranchFrom("hotfix", "main", false); err == nil {
		test.Fatalf("expected error creating duplicated branch")
	}
	if err := branchHandler.CreateBranchFrom("from-missing", "does-not-exist", true); err == nil {
		test.Fatalf("expected error creating branch from missing start point")
	}
	if err := branchHandler.CreateBranchFrom("from-first", firstCommitHash, true); err != nil {
		test.Fatalf("unexpected error creating branch from first commit: %v", err)
	}
	if currentBranch, _ := branchHandler.GetCurrentBranch(); currentBranch != "from-first" {
		test.Fatalf("expected from-first to be checked out, got %s", currentBranch)
	}
	if content, _ := os.ReadFile(fileOne); strings.ReplaceAll(string(content), "\r\n", "\n") != "line 1\nline 2\n" {
		test.Fatalf("expected first commit content on from-first, got %q", content)
	}
	if err := branchHandler.ChangeBranch("main", false, false); err != nil {
		test.Fatalf("unexpected error switching back to main: %v", err)
	}

	if err := branchHandler.IgnoreFile("secret.env"); err != nil {
		test.Fatalf("unexpected error ignoring file: %v", err)
	}
	if err := branchHandler.IgnoreExtension(".log"); err != nil {
		test.Fatalf("unexpected error ignoring extension: %v", err)
	}

	if err := os.WriteFile(fileOne, []byte("uncommitted stash change\n"), 0o644); err != nil {
		test.Fatalf("unexpected error modifying file for stash: %v", err)
	}
	if _, err := gitHandler.RunGitCommand([]string{"stash", "push", "-m", "my-stash"}); err != nil {
		test.Fatalf("unexpected error pushing stash: %v", err)
	}

	stashes, err := branchHandler.ListStashes()
	if err != nil || len(stashes) != 1 {
		test.Fatalf("expected 1 stash, got %+v, err=%v", stashes, err)
	}

	stashMods, err := branchHandler.GetStashModifications(stashes[0].ID)
	if err != nil || len(stashMods) != 1 {
		test.Fatalf("unexpected stash modifications: %+v, err=%v", stashMods, err)
	}

	stashDiff, err := branchHandler.GetStashedFileDiff(stashes[0].ID, "hello.txt -> hello.txt")
	if err != nil || !strings.Contains(stashDiff, "+uncommitted stash change") {
		test.Fatalf("unexpected stash diff: %s, err=%v", stashDiff, err)
	}

	if err := branchHandler.PopStash(stashes[0].ID); err != nil {
		test.Fatalf("unexpected error popping stash: %v", err)
	}

	if err := commitsHandler.DiscardChanges([]octohubStructs.CommitFileSelection{
		{FileName: "hello.txt", Kind: octohubStructs.FileKindModified, All: true},
		{FileName: ".gitignore", Kind: octohubStructs.FileKindUntracked, All: true},
	}); err != nil {
		test.Fatalf("unexpected error discarding changes: %v", err)
	}

	hasChanges, err := branchHandler.HasUncommittedChanges()
	if err != nil || hasChanges {
		test.Fatalf("expected clean working tree after discard, got hasChanges=%v, err=%v", hasChanges, err)
	}

	if err := repositoryHandler.RemoveRepository(token, createdRepo.ID); err != nil {
		test.Fatalf("unexpected error removing repository: %v", err)
	}
}
