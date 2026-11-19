package octohubHandler

import (
	"os"
	"context"
	"strings"
	"testing"
	"path/filepath"
	octohubStructs "docker-manager-go/src/octohub/structs"
)

func TestStashOnlySelectedChanges(test *testing.T) {
	_, repositoryHandler, _, branchHandler, commitsHandler, token := setupOctohubIntegration(test)
	ctx := context.Background()

	parentDir := test.TempDir()
	createdRepo, err := repositoryHandler.CreateRepository(ctx, token, parentDir, "stash-repo", false)
	if err != nil {
		test.Fatalf("unexpected error creating repository: %v", err)
	}
	repoPath := createdRepo.Path
	configureGitUser(test, repoPath)

	writeFile := func(name string, content string) {
		if err := os.WriteFile(filepath.Join(repoPath, name), []byte(content), 0o644); err != nil {
			test.Fatalf("unexpected error writing %s: %v", name, err)
		}
	}

	writeFile("tracked.txt", "first\n")
	if err := commitsHandler.StashChanges(ctx, []octohubStructs.FilesStatus{{FileName: "tracked.txt", Kind: octohubStructs.FileKindUntracked}}); err == nil {
		test.Fatalf("expected stash to fail before the first commit")
	}
	if _, err := commitsHandler.Commit(ctx, octohubStructs.CommitRequest{
		Summary: "Initial commit",
		Files:   []octohubStructs.CommitFileSelection{{FileName: "tracked.txt", Kind: octohubStructs.FileKindUntracked, All: true}},
	}); err != nil {
		test.Fatalf("unexpected error creating initial commit: %v", err)
	}

	writeFile("tracked.txt", "second\n")
	writeFile("new file.txt", "brand new\n")
	writeFile("kept.txt", "stays here\n")

	if err := commitsHandler.StashChanges(ctx, []octohubStructs.FilesStatus{
		{FileName: "tracked.txt", Kind: octohubStructs.FileKindModified},
		{FileName: "new file.txt", Kind: octohubStructs.FileKindUntracked},
	}); err != nil {
		test.Fatalf("unexpected error stashing changes: %v", err)
	}

	status, err := commitsHandler.GetGitStatus(ctx)
	if err != nil || len(status) != 1 || status[0].FileName != "kept.txt" {
		test.Fatalf("expected only kept.txt left in the working tree, got %+v, err=%v", status, err)
	}

	stashes, err := branchHandler.ListStashes(ctx)
	if err != nil || len(stashes) != 1 {
		test.Fatalf("expected one stash on the current branch, got %+v, err=%v", stashes, err)
	}

	stashedFiles, err := branchHandler.GetStashModifications(ctx, stashes[0].ID)
	if err != nil || len(stashedFiles) != 1 || stashedFiles[0].File != "tracked.txt" {
		test.Fatalf("expected tracked.txt in the stash summary, got %+v, err=%v", stashedFiles, err)
	}

	if err := branchHandler.PopStash(ctx, stashes[0].ID); err != nil {
		test.Fatalf("unexpected error restoring stash: %v", err)
	}
	restored, err := os.ReadFile(filepath.Join(repoPath, "new file.txt"))
	if err != nil || strings.TrimSpace(string(restored)) != "brand new" {
		test.Fatalf("expected untracked file restored from stash, got %q, err=%v", restored, err)
	}
}
