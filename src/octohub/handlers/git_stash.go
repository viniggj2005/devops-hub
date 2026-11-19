package octohubHandler

import (
	"fmt"
	"time"
	"context"
	"strings"
	"docker-manager-go/src/appErrors"
	octohubStructs "docker-manager-go/src/octohub/structs"
)

func (handlerStruct *GitCommitsHandler) StashChanges(ctx context.Context, files []octohubStructs.FilesStatus) error {
	if len(files) == 0 {
		return appErrors.New("octohub.stashChangesRequired", "selecione ao menos uma alteração para guardar no stash")
	}
	if !handlerStruct.hasHead(ctx) {
		return appErrors.New("octohub.stashNeedsCommit", "faça o primeiro commit antes de guardar alterações no stash")
	}

	var paths []string
	for _, file := range files {
		if file.Kind == octohubStructs.FileKindConflicted {
			return appErrors.New("octohub.resolveConflictBeforeStash", "resolva o conflito em {file} antes de guardar no stash").With("file", file.FileName)
		}
		paths = append(paths, file.FileName)
		if file.OldFileName != "" {
			paths = append(paths, file.OldFileName)
		}
	}

	message := fmt.Sprintf("OctoHub: alterações guardadas em %s", time.Now().Format("02/01/2006 15:04"))
	args := []string{"--literal-pathspecs", "stash", "push", "--include-untracked", "-m", message, "--pathspec-from-file=-", "--pathspec-file-nul"}
	if _, err := handlerStruct.gitHandler.runGitCommandWithInput(ctx, args, strings.Join(paths, "\x00")); err != nil {
		return appErrors.Wrap("octohub.stashChangesFailed", "erro ao guardar alterações no stash", err)
	}
	return nil
}
