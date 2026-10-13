package octohubHandler

import (
	"bufio"
	"context"
	octohubStructs "docker-manager-go/src/octohub/structs"
	"fmt"
	"slices"
	"strconv"
	"strings"
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
func (handlerStruct *GitCommitsHandler) GetCommitModifications(commitHash string) ([]octohubStructs.FileModification, error) {
	args := []string{"show", "--name-status", "--format=", commitHash}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
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

func (handlerStruct *GitCommitsHandler) GetCommitedFileChanges(commitHash string, filePath string) (string, error) {
	args := append([]string{"diff"}, diffFlags...)
	if strings.Contains(filePath, " -> ") {
		parts := strings.Split(filePath, " -> ")
		oldPath := strings.TrimSpace(parts[0])
		newPath := strings.TrimSpace(parts[1])
		args = append(args, "-M", commitHash+"^:"+oldPath, commitHash+":"+newPath)
	} else {
		args = append(args, commitHash+"^", commitHash, "--", filePath)
	}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("o comando git expirou")
		}
		return "", err
	}

	return string(out), nil
}

func (handlerStruct *GitCommitsHandler) GetGitStatus() ([]octohubStructs.FilesStatus, error) {
	args := []string{"status", "--porcelain=v1", "-z", "--untracked-files=all"}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
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

func (handlerStruct *GitCommitsHandler) hasHead() bool {
	_, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-parse", "--verify", "-q", "HEAD"})
	return err == nil
}

func (handlerStruct *GitCommitsHandler) diffBase() (string, error) {
	if handlerStruct.hasHead() {
		return "HEAD", nil
	}
	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"hash-object", "-t", "tree", "--stdin"})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func (handlerStruct *GitCommitsHandler) workingFileDiff(file octohubStructs.FilesStatus) (string, error) {
	if file.Kind == octohubStructs.FileKindUntracked {
		args := append([]string{"diff", "--no-index"}, diffFlags...)
		args = append(args, "--", "/dev/null", file.FileName)
		out, exitCode, err := handlerStruct.gitHandler.runGit(args, "")
		if err != nil && exitCode != 1 {
			return "", err
		}
		return string(out), nil
	}

	base, err := handlerStruct.diffBase()
	if err != nil {
		return "", err
	}
	args := append([]string{"--literal-pathspecs", "diff", base}, diffFlags...)
	if file.OldFileName != "" {
		args = append(args, "-M", "--", file.OldFileName, file.FileName)
	} else {
		args = append(args, "--", file.FileName)
	}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (handlerStruct *GitCommitsHandler) GetUncommitedFileChanges(file octohubStructs.FilesStatus) (octohubStructs.WorkingFileDiff, error) {
	diff, err := handlerStruct.workingFileDiff(file)
	if err != nil {
		return octohubStructs.WorkingFileDiff{}, err
	}
	return octohubStructs.WorkingFileDiff{Diff: diff, Hash: hashDiff(diff)}, nil
}

func (handlerStruct *GitCommitsHandler) Commit(request octohubStructs.CommitRequest) (string, error) {
	summary := strings.TrimSpace(request.Summary)
	if summary == "" {
		return "", fmt.Errorf("informe um resumo para o commit")
	}
	if len(request.Files) == 0 {
		return "", fmt.Errorf("selecione ao menos uma alteração para o commit")
	}

	var fullPaths []string
	var patches []string
	for _, file := range request.Files {
		if file.Kind == octohubStructs.FileKindConflicted {
			return "", fmt.Errorf("resolva o conflito em %s antes de fazer o commit", file.FileName)
		}
		if file.All {
			fullPaths = append(fullPaths, file.FileName)
			if file.OldFileName != "" {
				fullPaths = append(fullPaths, file.OldFileName)
			}
			continue
		}

		diff, err := handlerStruct.workingFileDiff(octohubStructs.FilesStatus{
			FileName:    file.FileName,
			OldFileName: file.OldFileName,
			Kind:        file.Kind,
		})
		if err != nil {
			return "", err
		}
		if hashDiff(diff) != file.DiffHash {
			return "", fmt.Errorf("o arquivo %s mudou depois que as linhas foram selecionadas, revise a seleção", file.FileName)
		}
		patch, err := buildPartialPatch(diff, file.Lines)
		if err != nil {
			return "", fmt.Errorf("erro ao montar as linhas de %s: %w", file.FileName, err)
		}
		if patch != "" {
			patches = append(patches, patch)
		}
	}

	resetIndex := func() {
		handlerStruct.gitHandler.RunGitCommand([]string{"reset", "-q", "--", "."})
	}
	if _, err := handlerStruct.gitHandler.RunGitCommand([]string{"reset", "-q", "--", "."}); err != nil {
		return "", fmt.Errorf("erro ao preparar o commit: %w", err)
	}

	for _, patch := range patches {
		args := []string{"apply", "--cached", "--unidiff-zero", "--whitespace=nowarn", "-"}
		if _, err := handlerStruct.gitHandler.RunGitCommandWithInput(args, patch); err != nil {
			resetIndex()
			return "", fmt.Errorf("erro ao aplicar as linhas selecionadas: %w", err)
		}
	}

	if len(fullPaths) > 0 {
		args := []string{"--literal-pathspecs", "add", "-A", "--force", "--pathspec-from-file=-", "--pathspec-file-nul"}
		if _, err := handlerStruct.gitHandler.RunGitCommandWithInput(args, strings.Join(fullPaths, "\x00")); err != nil {
			resetIndex()
			return "", fmt.Errorf("erro ao adicionar arquivos ao commit: %w", err)
		}
	}

	message := summary
	if description := strings.TrimSpace(request.Description); description != "" {
		message += "\n\n" + description
	}
	if _, err := handlerStruct.gitHandler.RunGitCommandWithInput([]string{"commit", "-F", "-"}, message); err != nil {
		resetIndex()
		return "", fmt.Errorf("erro ao criar o commit: %w", err)
	}

	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-parse", "--short", "HEAD"})
	if err != nil {
		return "", nil
	}
	return strings.TrimSpace(string(out)), nil
}

func (handlerStruct *GitCommitsHandler) ListCommits(page int) ([]octohubStructs.Commit, error) {
	return handlerStruct.listCommits(page, "HEAD")
}

func validateCompareBranch(branch string) error {
	if strings.TrimSpace(branch) == "" || strings.HasPrefix(branch, "-") || strings.Contains(branch, "..") {
		return fmt.Errorf("branch inválida para comparação: %q", branch)
	}
	return nil
}

func (handlerStruct *GitCommitsHandler) ListCompareCommits(branch string, direction string, page int) ([]octohubStructs.Commit, error) {
	if err := validateCompareBranch(branch); err != nil {
		return nil, err
	}
	if direction == "ahead" {
		return handlerStruct.listCommits(page, branch+"..HEAD")
	}
	return handlerStruct.listCommits(page, "HEAD.."+branch)
}

func (handlerStruct *GitCommitsHandler) CompareBranch(branch string) (octohubStructs.BranchComparison, error) {
	var comparison octohubStructs.BranchComparison
	if err := validateCompareBranch(branch); err != nil {
		return comparison, err
	}
	if !handlerStruct.hasHead() {
		return comparison, nil
	}
	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"rev-list", "--left-right", "--count", "HEAD..." + branch, "--"})
	if err != nil {
		return comparison, err
	}
	counts := strings.Fields(string(out))
	if len(counts) != 2 {
		return comparison, fmt.Errorf("resposta inesperada do git ao comparar com %s", branch)
	}
	comparison.Ahead, _ = strconv.Atoi(counts[0])
	comparison.Behind, _ = strconv.Atoi(counts[1])
	return comparison, nil
}

func (handlerStruct *GitCommitsHandler) listCommits(page int, revisionRange string) ([]octohubStructs.Commit, error) {
	if !handlerStruct.hasHead() {
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
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
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
