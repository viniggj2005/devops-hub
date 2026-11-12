package octohubHandler

import (
	"fmt"
	"bufio"
	"slices"
	"context"
	"strconv"
	"strings"
	"docker-manager-go/src/appErrors"
	octohubStructs "docker-manager-go/src/octohub/structs"
)

var diffFlags = []string{"--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"}

type GitCommitsHandler struct {
	gitHandler *GitHandler
}

func NewGitCommitsHandler(gitHandler *GitHandler) *GitCommitsHandler {
	return &GitCommitsHandler{
		gitHandler: gitHandler,
	}
}
func (handlerStruct *GitCommitsHandler) GetCommitModifications(ctx context.Context, commitHash string) ([]octohubStructs.FileModification, error) {
	args := []string{"show", "--name-status", "--format=", commitHash}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return nil, err
	}
	var filesModified []octohubStructs.FileModification

	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		parts := strings.Split(line, "\t")

		if len(parts) < 2 {
			continue
		}

		status := strings.TrimSpace(parts[0])
		var fileName string
		if strings.HasPrefix(status, "R") && len(parts) >= 3 {
			fileName = fmt.Sprintf("%s -> %s", parts[1], parts[2])
		} else {
			fileName = parts[1]
		}

		filesModified = append(filesModified, octohubStructs.FileModification{File: fileName, Status: status})
	}
	return filesModified, nil
}

func (handlerStruct *GitCommitsHandler) GetCommitedFileChanges(ctx context.Context, commitHash string, filePath string) (string, error) {
	args := append([]string{"diff"}, diffFlags...)
	if strings.Contains(filePath, " -> ") {
		parts := strings.Split(filePath, " -> ")
		oldPath := strings.TrimSpace(parts[0])
		newPath := strings.TrimSpace(parts[1])
		args = append(args, "-M", commitHash+"^:"+oldPath, commitHash+":"+newPath)
	} else {
		args = append(args, commitHash+"^", commitHash, "--", filePath)
	}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		if handlerStruct.gitHandler.appContext.Err() == context.DeadlineExceeded {
			return "", appErrors.New("octohub.gitTimeout", "o comando git expirou")
		}
		return "", err
	}

	return string(out), nil
}

func (handlerStruct *GitCommitsHandler) GetGitStatus(ctx context.Context) ([]octohubStructs.FilesStatus, error) {
	args := []string{"status", "--porcelain=v1", "-z", "--untracked-files=all"}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return nil, err
	}

	filesStatus := []octohubStructs.FilesStatus{}
	entries := strings.Split(string(out), "\x00")
	for index := 0; index < len(entries); index++ {
		entry := entries[index]
		if len(entry) < 4 {
			continue
		}
		code := entry[:2]
		file := octohubStructs.FilesStatus{
			FileName: entry[3:],
			Status:   strings.TrimSpace(code),
			Kind:     fileKind(code),
		}
		if (code[0] == 'R' || code[0] == 'C') && index+1 < len(entries) {
			file.OldFileName = entries[index+1]
			index++
		}
		filesStatus = append(filesStatus, file)
	}
	return filesStatus, nil
}

func fileKind(code string) string {
	switch code {
	case "??":
		return octohubStructs.FileKindUntracked
	case "DD", "AU", "UD", "UA", "DU", "AA", "UU":
		return octohubStructs.FileKindConflicted
	}
	switch {
	case strings.ContainsRune(code, 'R'):
		return octohubStructs.FileKindRenamed
	case strings.ContainsRune(code, 'D'):
		return octohubStructs.FileKindDeleted
	case strings.ContainsAny(code, "AC"):
		return octohubStructs.FileKindAdded
	default:
		return octohubStructs.FileKindModified
	}
}

func (handlerStruct *GitCommitsHandler) hasHead(ctx context.Context) bool {
	_, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "-q", "HEAD"})
	return err == nil
}

func (handlerStruct *GitCommitsHandler) diffBase(ctx context.Context) (string, error) {
	if handlerStruct.hasHead(ctx) {
		return "HEAD", nil
	}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"hash-object", "-t", "tree", "--stdin"})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func (handlerStruct *GitCommitsHandler) workingFileDiff(ctx context.Context, file octohubStructs.FilesStatus) (string, error) {
	if file.Kind == octohubStructs.FileKindUntracked {
		args := append([]string{"diff", "--no-index"}, diffFlags...)
		args = append(args, "--", "/dev/null", file.FileName)
		out, exitCode, err := handlerStruct.gitHandler.runGit(ctx, args, "")
		if err != nil && exitCode != 1 {
			return "", err
		}
		return string(out), nil
	}

	base, err := handlerStruct.diffBase(ctx)
	if err != nil {
		return "", err
	}
	args := append([]string{"--literal-pathspecs", "diff", base}, diffFlags...)
	if file.OldFileName != "" {
		args = append(args, "-M", "--", file.OldFileName, file.FileName)
	} else {
		args = append(args, "--", file.FileName)
	}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (handlerStruct *GitCommitsHandler) GetUncommitedFileChanges(ctx context.Context, file octohubStructs.FilesStatus) (octohubStructs.WorkingFileDiff, error) {
	diff, err := handlerStruct.workingFileDiff(ctx, file)
	if err != nil {
		return octohubStructs.WorkingFileDiff{}, err
	}
	return octohubStructs.WorkingFileDiff{Diff: diff, Hash: hashDiff(diff)}, nil
}

func (handlerStruct *GitCommitsHandler) Commit(ctx context.Context, request octohubStructs.CommitRequest) (string, error) {
	summary := strings.TrimSpace(request.Summary)
	if summary == "" {
		return "", appErrors.New("octohub.commitSummaryRequired", "informe um resumo para o commit")
	}
	if len(request.Files) == 0 {
		return "", appErrors.New("octohub.commitChangesRequired", "selecione ao menos uma alteração para o commit")
	}

	var fullPaths []string
	var patches []string
	for _, file := range request.Files {
		if file.Kind == octohubStructs.FileKindConflicted {
			return "", appErrors.New("octohub.resolveConflictBeforeCommit", "resolva o conflito em {file} antes de fazer o commit").With("file", file.FileName)
		}
		if file.All {
			fullPaths = append(fullPaths, file.FileName)
			if file.OldFileName != "" {
				fullPaths = append(fullPaths, file.OldFileName)
			}
			continue
		}

		diff, err := handlerStruct.workingFileDiff(ctx, octohubStructs.FilesStatus{
			FileName:    file.FileName,
			OldFileName: file.OldFileName,
			Kind:        file.Kind,
		})
		if err != nil {
			return "", err
		}
		if hashDiff(diff) != file.DiffHash {
			return "", appErrors.New("octohub.selectionOutdated", "o arquivo {file} mudou depois que as linhas foram selecionadas, revise a seleção").With("file", file.FileName)
		}
		patch, err := buildPartialPatch(diff, file.Lines)
		if err != nil {
			return "", appErrors.Wrap("octohub.buildLinesFailed", "erro ao montar as linhas de {file}", err).With("file", file.FileName)
		}
		if patch != "" {
			patches = append(patches, patch)
		}
	}

	resetIndex := func() {
		handlerStruct.gitHandler.runGitCommand(ctx, []string{"reset", "-q", "--", "."})
	}
	if _, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"reset", "-q", "--", "."}); err != nil {
		return "", appErrors.Wrap("octohub.prepareCommitFailed", "erro ao preparar o commit", err)
	}

	for _, patch := range patches {
		args := []string{"apply", "--cached", "--unidiff-zero", "--whitespace=nowarn", "-"}
		if _, err := handlerStruct.gitHandler.runGitCommandWithInput(ctx, args, patch); err != nil {
			resetIndex()
			return "", appErrors.Wrap("octohub.applyLinesFailed", "erro ao aplicar as linhas selecionadas", err)
		}
	}

	if len(fullPaths) > 0 {
		args := []string{"--literal-pathspecs", "add", "-A", "--force", "--pathspec-from-file=-", "--pathspec-file-nul"}
		if _, err := handlerStruct.gitHandler.runGitCommandWithInput(ctx, args, strings.Join(fullPaths, "\x00")); err != nil {
			resetIndex()
			return "", appErrors.Wrap("octohub.stageFilesFailed", "erro ao adicionar arquivos ao commit", err)
		}
	}

	message := summary
	if description := strings.TrimSpace(request.Description); description != "" {
		message += "\n\n" + description
	}
	if _, err := handlerStruct.gitHandler.runGitCommandWithInput(ctx, []string{"commit", "-F", "-"}, message); err != nil {
		resetIndex()
		return "", appErrors.Wrap("octohub.createCommitFailed", "erro ao criar o commit", err)
	}

	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "HEAD"})
	if err != nil {
		return "", nil
	}
	fullHash := strings.TrimSpace(string(out))
	handlerStruct.gitHandler.markCommitCreated(ctx, fullHash)
	if len(fullHash) > 7 {
		return fullHash[:7], nil
	}
	return fullHash, nil
}

func (handlerStruct *GitCommitsHandler) GetUndoableCommit(ctx context.Context) (*octohubStructs.UndoableCommit, error) {
	branchHandler := NewGitBranchHandler(handlerStruct.gitHandler)
	if state, stateErr := branchHandler.GetOperationState(ctx); stateErr != nil || state.Kind != "" {
		return nil, nil
	}

	logOut, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{
		"log",
		"-n", "1",
		"--no-show-signature",
		"--format=%H%x1f%h%x1f%P%x1f%s%x1f%b",
		"HEAD",
	})
	if err != nil {
		return nil, nil
	}

	fields := strings.SplitN(strings.TrimLeft(string(logOut), "\r\n"), "\x1f", 5)
	if len(fields) < 5 {
		return nil, nil
	}

	fullHash := strings.TrimSpace(fields[0])
	shortHash := strings.TrimSpace(fields[1])
	parents := strings.TrimSpace(fields[2])
	summary := strings.TrimSpace(fields[3])
	description := strings.TrimSpace(fields[4])

	if fullHash == "" || len(strings.Fields(parents)) > 1 {
		return nil, nil
	}
	if handlerStruct.gitHandler.isUndoneHead(ctx, fullHash) {
		return nil, nil
	}

	if _, upstreamErr := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "-q", "@{upstream}"}); upstreamErr == nil {
		countOut, countErr := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-list", "--count", "@{upstream}..HEAD"})
		if countErr != nil {
			return nil, nil
		}
		aheadCount, convErr := strconv.Atoi(strings.TrimSpace(string(countOut)))
		if convErr != nil || aheadCount <= 0 {
			return nil, nil
		}
	} else {
		remoteContainsOut, remoteErr := handlerStruct.gitHandler.runGitCommand(ctx, []string{"branch", "-r", "--contains", "HEAD"})
		if remoteErr == nil && strings.TrimSpace(string(remoteContainsOut)) != "" {
			return nil, nil
		}
	}

	return &octohubStructs.UndoableCommit{
		Hash:        fullHash,
		ShortHash:   shortHash,
		Summary:     summary,
		Description: description,
	}, nil
}

func (handlerStruct *GitCommitsHandler) UndoLastCommit(ctx context.Context) (*octohubStructs.UndoableCommit, error) {
	branchHandler := NewGitBranchHandler(handlerStruct.gitHandler)
	if err := branchHandler.ensureNoOperation(ctx); err != nil {
		return nil, err
	}

	undoableCommit, err := handlerStruct.GetUndoableCommit(ctx)
	if err != nil {
		return nil, err
	}
	if undoableCommit == nil {
		return nil, appErrors.New("octohub.noLocalCommitToUndo", "não há commit local pendente de envio para cancelar")
	}

	if parentOut, parentErr := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-parse", "--verify", "-q", "HEAD^"}); parentErr == nil {
		parentHash := strings.TrimSpace(string(parentOut))
		if _, resetErr := handlerStruct.gitHandler.runGitCommand(ctx, []string{"reset", "--mixed", "HEAD^"}); resetErr != nil {
			return nil, appErrors.Wrap("octohub.undoCommitFailed", "erro ao cancelar o último commit", resetErr)
		}
		handlerStruct.gitHandler.markCommitUndone(ctx, undoableCommit.Hash, parentHash)
		return undoableCommit, nil
	}

	if _, refErr := handlerStruct.gitHandler.runGitCommand(ctx, []string{"update-ref", "-d", "HEAD"}); refErr != nil {
		return nil, appErrors.Wrap("octohub.undoInitialCommitFailed", "erro ao cancelar o commit inicial", refErr)
	}
	_, _ = handlerStruct.gitHandler.runGitCommand(ctx, []string{"rm", "-rf", "--cached", "--ignore-unmatch", "--", "."})
	handlerStruct.gitHandler.markCommitUndone(ctx, undoableCommit.Hash, "")
	return undoableCommit, nil
}


func (handlerStruct *GitCommitsHandler) ListCommits(ctx context.Context, page int) ([]octohubStructs.Commit, error) {
	return handlerStruct.listCommits(ctx, page, "HEAD")
}

func validateCompareBranch(branch string) error {
	if strings.TrimSpace(branch) == "" || strings.HasPrefix(branch, "-") || strings.Contains(branch, "..") {
		return appErrors.New("octohub.invalidCompareBranch", "branch inválida para comparação: \"{branch}\"").With("branch", branch)
	}
	return nil
}

func (handlerStruct *GitCommitsHandler) ListCompareCommits(ctx context.Context, branch string, direction string, page int) ([]octohubStructs.Commit, error) {
	if err := validateCompareBranch(branch); err != nil {
		return nil, err
	}
	if direction == "ahead" {
		return handlerStruct.listCommits(ctx, page, branch+"..HEAD")
	}
	return handlerStruct.listCommits(ctx, page, "HEAD.."+branch)
}

func (handlerStruct *GitCommitsHandler) CompareBranch(ctx context.Context, branch string) (octohubStructs.BranchComparison, error) {
	var comparison octohubStructs.BranchComparison
	if err := validateCompareBranch(branch); err != nil {
		return comparison, err
	}
	if !handlerStruct.hasHead(ctx) {
		return comparison, nil
	}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, []string{"rev-list", "--left-right", "--count", "HEAD..." + branch, "--"})
	if err != nil {
		return comparison, err
	}
	counts := strings.Fields(string(out))
	if len(counts) != 2 {
		return comparison, appErrors.New("octohub.unexpectedCompareOutput", "resposta inesperada do git ao comparar com {branch}").With("branch", branch)
	}
	comparison.Ahead, _ = strconv.Atoi(counts[0])
	comparison.Behind, _ = strconv.Atoi(counts[1])
	return comparison, nil
}

func (handlerStruct *GitCommitsHandler) listCommits(ctx context.Context, page int, revisionRange string) ([]octohubStructs.Commit, error) {
	if !handlerStruct.hasHead(ctx) {
		return []octohubStructs.Commit{}, nil
	}

	args := []string{
		"log",
		"-n", "15",
		"--date=iso-strict",
		"--no-show-signature",
		"--decorate-refs=refs/tags/",
		fmt.Sprintf("--skip=%d", page*15),
		"--format=%H%x1f%an%x1f%ae%x1f%ad%x1f%s%x1f%D%x1e",
		revisionRange,
		"--",
	}
	out, err := handlerStruct.gitHandler.runGitCommand(ctx, args)
	if err != nil {
		return nil, err
	}

	commits := []octohubStructs.Commit{}
	for _, record := range strings.Split(string(out), "\x1e") {
		fields := strings.Split(strings.TrimLeft(record, "\r\n"), "\x1f")
		if len(fields) < 6 {
			continue
		}
		commits = append(commits, octohubStructs.Commit{
			Hash:        fields[0],
			Author:      fields[1],
			PseudoEmail: fields[2],
			Date:        fields[3],
			Title:       fields[4],
			Tags:        parseTagDecorations(fields[5]),
		})
	}
	return commits, nil
}

func parseTagDecorations(decorations string) []string {
	tags := []string{}
	for _, decoration := range strings.Split(strings.TrimSpace(decorations), ", ") {
		if tag, isTag := strings.CutPrefix(decoration, "tag: "); isTag {
			tags = append(tags, tag)
		}
	}
	slices.Sort(tags)
	return tags
}
