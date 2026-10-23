package octohubHandler

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	octohubStructs "docker-manager-go/src/octohub/structs"
)

func (handlerStruct *GitCommitsHandler) DiscardChanges(ctx context.Context, files []octohubStructs.CommitFileSelection) error {
	if len(files) == 0 {
		return fmt.Errorf("selecione ao menos uma alteração para descartar")
	}

	var patches, backupPaths, restorePaths, removePaths []string
	for _, file := range files {
		backupPaths = append(backupPaths, file.FileName)
		if file.OldFileName != "" {
			backupPaths = append(backupPaths, file.OldFileName)
		}

		if !file.All {
			diff, err := handlerStruct.workingFileDiff(ctx, octohubStructs.FilesStatus{
				Kind:        file.Kind,
				FileName:    file.FileName,
				OldFileName: file.OldFileName,
			})
			if err != nil {
				return err
			}
			if hashDiff(diff) != file.DiffHash {
				return fmt.Errorf("o arquivo %s mudou depois que as linhas foram selecionadas, revise a seleção", file.FileName)
			}
			patch, err := buildDiscardPatch(diff, file.Lines)
			if err != nil {
				return fmt.Errorf("erro ao montar as linhas de %s: %w", file.FileName, err)
			}
			if patch != "" {
				patches = append(patches, patch)
			}
			continue
		}

		if file.Kind == octohubStructs.FileKindUntracked {
			removePaths = append(removePaths, file.FileName)
			continue
		}
		restorePaths = append(restorePaths, file.FileName)
		if file.OldFileName != "" {
			restorePaths = append(restorePaths, file.OldFileName)
		}
	}

	hasHead := handlerStruct.hasHead(ctx)
	backupNote := ""
	if hasHead {
		if err := handlerStruct.backupChanges(ctx, backupPaths); err != nil {
			return fmt.Errorf("não foi possível guardar uma cópia das alterações, nada foi descartado: %w", err)
		}
		backupNote = " Uma cópia das alterações ficou guardada nos stashes."
	}

	for _, patch := range patches {
		args := []string{"apply", "--unidiff-zero", "--whitespace=nowarn", "-"}
		if _, err := handlerStruct.gitHandler.runGitCommandWithInput(ctx, args, patch); err != nil {
			return fmt.Errorf("erro ao descartar as linhas selecionadas: %w.%s", err, backupNote)
		}
	}

	if len(restorePaths) > 0 {
		args := []string{"--literal-pathspecs", "restore", "--source=HEAD", "--staged", "--worktree", "--pathspec-from-file=-", "--pathspec-file-nul"}
		if !hasHead {
			args = []string{"--literal-pathspecs", "rm", "-q", "-f", "--cached", "--ignore-unmatch", "--pathspec-from-file=-", "--pathspec-file-nul"}
			removePaths = append(removePaths, restorePaths...)
		}
		if _, err := handlerStruct.gitHandler.runGitCommandWithInput(ctx, args, strings.Join(restorePaths, "\x00")); err != nil {
			return fmt.Errorf("erro ao descartar alterações: %w.%s", err, backupNote)
		}
	}

	if err := handlerStruct.removeFiles(ctx, removePaths); err != nil {
		return fmt.Errorf("%w.%s", err, backupNote)
	}
	return nil
}

func (handlerStruct *GitCommitsHandler) backupChanges(ctx context.Context, paths []string) error {
	indexFile, err := os.CreateTemp("", "octohub-index-*")
	if err != nil {
		return err
	}
	indexPath := indexFile.Name()
	indexFile.Close()
	os.Remove(indexPath)
	defer os.Remove(indexPath)

	env := []string{
		"GIT_AUTHOR_NAME=OctoHub",
		"GIT_COMMITTER_NAME=OctoHub",
		"GIT_INDEX_FILE=" + indexPath,
		"GIT_AUTHOR_EMAIL=octohub@localhost",
		"GIT_COMMITTER_EMAIL=octohub@localhost",
	}
	run := func(input string, args ...string) (string, error) {
		out, _, err := handlerStruct.gitHandler.runGit(ctx, args, input, env...)
		return strings.TrimSpace(string(out)), err
	}

	branch := "HEAD"
	if name, err := run("", "symbolic-ref", "--short", "-q", "HEAD"); err == nil && name != "" {
		branch = name
	}
	message := fmt.Sprintf("On %s: OctoHub: alterações descartadas em %s", branch, time.Now().Format("02/01/2006 15:04"))

	if _, err := run("", "read-tree", "HEAD"); err != nil {
		return err
	}
	if _, err := run(strings.Join(paths, "\x00"), "--literal-pathspecs", "add", "-A", "--force", "--pathspec-from-file=-", "--pathspec-file-nul"); err != nil {
		return err
	}
	tree, err := run("", "write-tree")
	if err != nil {
		return err
	}
	indexCommit, err := run("", "commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "index on "+branch)
	if err != nil {
		return err
	}
	stashCommit, err := run("", "commit-tree", tree, "-p", "HEAD", "-p", indexCommit, "-m", message)
	if err != nil {
		return err
	}
	_, err = run("", "stash", "store", "-m", message, stashCommit)
	return err
}

func (handlerStruct *GitCommitsHandler) removeFiles(ctx context.Context, paths []string) error {
	root := filepath.Clean(handlerStruct.gitHandler.repositoryPath(ctx))
	for _, path := range paths {
		fullPath := filepath.Join(root, filepath.FromSlash(path))
		if !strings.HasPrefix(fullPath, root+string(filepath.Separator)) {
			return fmt.Errorf("caminho fora do repositório: %s", path)
		}
		if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("erro ao apagar %s: %w", path, err)
		}
		for folder := filepath.Dir(fullPath); folder != root && strings.HasPrefix(folder, root); folder = filepath.Dir(folder) {
			if os.Remove(folder) != nil {
				break
			}
		}
	}
	return nil
}
