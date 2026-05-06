package octohubHandler

import (
	"bufio"
	"context"
	octohubStructs "docker-manager-go/src/octohub/structs"
	"fmt"
	"strings"
)

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
	var args []string
	if strings.Contains(filePath, " -> ") {
		parts := strings.Split(filePath, " -> ")
		oldPath := strings.TrimSpace(parts[0])
		newPath := strings.TrimSpace(parts[1])
		args = []string{"diff", "-M", commitHash + "^:" + oldPath, commitHash + ":" + newPath}
	} else {
		args = []string{"diff", commitHash + "^", commitHash, "--", filePath}
	}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		if handlerStruct.gitHandler.ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("o comando git expirou")
		}
		return "", err
	}

	lines := strings.Split(string(out), "\n")
	var cleanLines []string
	for _, line := range lines {

		if strings.HasPrefix(line, "diff --git") ||
			strings.HasPrefix(line, "index ") ||
			strings.HasPrefix(line, "--- ") ||
			strings.HasPrefix(line, "+++ ") {
			continue
		}
		cleanLines = append(cleanLines, line)
	}

	return strings.Join(cleanLines, "\n"), nil
}
func (handlerStruct *GitCommitsHandler) GetGitStatus() ([]octohubStructs.FilesStatus, error) {
	args := []string{"status", "-s"}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return nil, err
	}
	var filesStatus []octohubStructs.FilesStatus
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		filesStatus = append(filesStatus, octohubStructs.FilesStatus{FileName: parts[1], Status: parts[0]})
	}
	return filesStatus, nil
}
func (handlerStruct *GitCommitsHandler) ListCommits(page int) ([]octohubStructs.Commit, error) {

	args := []string{"log", fmt.Sprintf("--skip=%d", page*15), "-n", "15"}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return nil, err
	}
	var commits []octohubStructs.Commit
	var current *octohubStructs.Commit

	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "commit") {
			if current != nil {
				commits = append(commits, *current)
			}
			current = &octohubStructs.Commit{}
			current.Hash = strings.TrimSpace(strings.TrimPrefix(line, "commit "))
			continue
		}
		if current != nil {
			if strings.HasPrefix(line, "Author:") {
				pieces := strings.Split(line, "<")
				if len(pieces) == 2 {
					current.PseudoEmail = strings.TrimSuffix(pieces[1], ">")
					current.Author = strings.TrimSpace(strings.TrimPrefix(pieces[0], "Author:"))
				}
			} else if strings.HasPrefix(line, "Date:") {
				current.Date = strings.TrimSpace(strings.TrimPrefix(line, "Date:"))
			} else if strings.HasPrefix(line, "    ") {
				title := strings.TrimSpace(line)
				if title != "" && current.Title == "" {
					current.Title = title
				}
			}
		}
	}

	if current != nil {
		commits = append(commits, *current)
	}
	return commits, nil
}

func (handlerStruct *GitCommitsHandler) GetUncommitedFileChanges(filePath string) (string, error) {
	args := []string{"diff", "HEAD", "--", filePath}
	out, err := handlerStruct.gitHandler.RunGitCommand(args)
	if err != nil {
		return "", err
	}

	return string(out), nil
}
