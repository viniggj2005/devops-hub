package octohubHandlers

import (
	"bufio"
	"context"
	octohubStructs "docker-manager-go/src/octohub/struct"
	"fmt"
	"os/exec"
	"strings"
)

type GitHandler struct {
	ctx          context.Context
	serverActive bool
	repoPath     string
}

func NewGitHandler(initialPath string) *GitHandler {
	return &GitHandler{
		repoPath: initialPath,
	}
}

func (handlerStruct *GitHandler) SetRepoPath(newPath string) {
	handlerStruct.repoPath = newPath
}

func (handlerStruct *GitHandler) Startup(ctx context.Context) {
	handlerStruct.ctx = ctx
}

func (handlerStruct *GitHandler) PublishBranch(branchName string) error {
	cmd := exec.CommandContext(handlerStruct.ctx, "git", "push", "-u", "origin", branchName)
	cmd.Dir = handlerStruct.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}
	return nil
}
func (handlerStruct *GitHandler) CreateBranch(branchName string) error {
	cmd := exec.CommandContext(handlerStruct.ctx, "git", "branch", branchName)
	cmd.Dir = handlerStruct.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}
	return nil
}

func (handlerStruct *GitHandler) ChangeBranch(targetBranch string) error {
	cmd := exec.CommandContext(handlerStruct.ctx, "git", "stash")
	cmd.Dir = handlerStruct.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}

	cmd = exec.CommandContext(handlerStruct.ctx, "git", "checkout", targetBranch)
	_, err = cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}

	return nil
}
func (handlerStruct *GitHandler) DeleteBranch(branch string) error {
	cmd := exec.CommandContext(handlerStruct.ctx, "git", "branch", "-d", branch)
	cmd.Dir = handlerStruct.repoPath
	_, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("o comando git expirou")
		}
		return err
	}
	return nil
}
func (handlerStruct *GitHandler) ListBranchs() ([]string, error) {
	cmd := exec.CommandContext(handlerStruct.ctx, "git", "branch")
	cmd.Dir = handlerStruct.repoPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("o comando git expirou")
		}
		return nil, err
	}
	var branches []string
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {

		line := scanner.Text()
		cleanLine := strings.TrimSpace(line)
		if cleanLine != "" {
			branches = append(branches, cleanLine)
		}
	}
	return branches, nil
}

func (handlerStruct *GitHandler) ListCommits(page int) ([]octohubStructs.Commit, error) {
	cmd := exec.CommandContext(handlerStruct.ctx, "git", "log", fmt.Sprintf("--skip=%d", page*15), "-n", "15")

	cmd.Dir = handlerStruct.repoPath

	out, err := cmd.CombinedOutput()
	if err != nil {
		if handlerStruct.ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("o comando git expirou")
		}
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
