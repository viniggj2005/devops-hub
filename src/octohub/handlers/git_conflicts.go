package octohubHandler

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	octohubStructs "docker-manager-go/src/octohub/structs"
)

var conflictKinds = map[string]string{
	"AA": "both-added",
	"AU": "added-by-us",
	"DD": "both-deleted",
	"DU": "deleted-by-us",
	"UU": "both-modified",
	"UA": "added-by-them",
	"UD": "deleted-by-them",
}

func (handlerStruct *GitBranchHandler) unmergedEntries() (map[string]string, []string, error) {
	out, err := handlerStruct.gitHandler.RunGitCommand([]string{"status", "--porcelain=v1", "-z", "--untracked-files=no"})
	if err != nil {
		return nil, nil, err
	}

	kinds := map[string]string{}
	var order []string
	entries := strings.Split(string(out), "\x00")
	for index := 0; index < len(entries); index++ {
		entry := entries[index]
		if len(entry) < 4 {
			continue
		}
		code := entry[:2]
		if code[0] == 'R' || code[0] == 'C' {
			index++
		}
		if kind, found := conflictKinds[code]; found {
			kinds[entry[3:]] = kind
			order = append(order, entry[3:])
		}
	}
	return kinds, order, nil
}

func isBinaryContent(content []byte) bool {
	return bytes.IndexByte(content[:min(len(content), 8000)], 0) >= 0
}

func countConflictMarkers(content []byte) int {
	count := 0
	for _, line := range bytes.Split(content, []byte("\n")) {
		if bytes.HasPrefix(line, []byte("<<<<<<< ")) {
			count++
		}
	}
	return count
}

func sameContent(first, second []byte) bool {
	crlf, lf := []byte("\r\n"), []byte("\n")
	return bytes.Equal(bytes.ReplaceAll(first, crlf, lf), bytes.ReplaceAll(second, crlf, lf))
}

func (handlerStruct *GitBranchHandler) CheckConflicts(tracked []string) (octohubStructs.ConflictReport, error) {
	report := octohubStructs.ConflictReport{Files: []octohubStructs.ConflictFile{}}
	kinds, order, err := handlerStruct.unmergedEntries()
	if err != nil {
		return report, err
	}

	root := handlerStruct.gitHandler.RepoPath()
	var toAdd, toRemove []string
	for _, file := range order {
		item := octohubStructs.ConflictFile{File: file, Kind: kinds[file]}
		if item.Kind == "both-deleted" {
			toRemove = append(toRemove, file)
			item.Resolved = true
			report.Files = append(report.Files, item)
			continue
		}

		content, readErr := os.ReadFile(filepath.Join(root, filepath.FromSlash(file)))
		if readErr == nil {
			item.Binary = isBinaryContent(content)
			item.Markers = countConflictMarkers(content)
		}
		textConflict := item.Kind == "both-modified" || item.Kind == "both-added"
		if readErr == nil && textConflict && !item.Binary && item.Markers == 0 && !hasConflictMarkers(content) {
			ours, err := handlerStruct.gitHandler.RunGitCommand([]string{"show", ":2:" + file})
			if err == nil && sameContent(ours, content) {
				item.SameAsOurs = true
			} else {
				toAdd = append(toAdd, file)
				item.Resolved = true
			}
		}
		report.Files = append(report.Files, item)
	}

	if len(toAdd) > 0 {
		args := []string{"--literal-pathspecs", "add", "--force", "--pathspec-from-file=-", "--pathspec-file-nul"}
		if _, err := handlerStruct.gitHandler.RunGitCommandWithInput(args, strings.Join(toAdd, "\x00")); err != nil {
			return report, err
		}
	}
	if len(toRemove) > 0 {
		args := []string{"--literal-pathspecs", "rm", "-q", "--ignore-unmatch", "--pathspec-from-file=-", "--pathspec-file-nul"}
		if _, err := handlerStruct.gitHandler.RunGitCommandWithInput(args, strings.Join(toRemove, "\x00")); err != nil {
			return report, err
		}
	}

	for _, file := range tracked {
		if _, stillConflicted := kinds[file]; !stillConflicted {
			report.Files = append(report.Files, octohubStructs.ConflictFile{File: file, Resolved: true})
		}
	}

	report.Operation, err = handlerStruct.GetOperationState()
	return report, err
}

func (handlerStruct *GitBranchHandler) ResolveConflict(file, resolution string) error {
	kinds, _, err := handlerStruct.unmergedEntries()
	if err != nil {
		return err
	}
	if _, found := kinds[file]; !found {
		return fmt.Errorf("%s não está mais em conflito", file)
	}

	run := func(args ...string) error {
		_, err := handlerStruct.gitHandler.RunGitCommand(append(append([]string{"--literal-pathspecs"}, args...), "--", file))
		return err
	}
	switch resolution {
	case "ours", "theirs":
		if err := run("checkout", "--"+resolution); err != nil {
			return err
		}
		return run("add", "--force")
	case "keep":
		return run("add", "--force")
	case "delete":
		return run("rm", "-q")
	}
	return fmt.Errorf("resolução desconhecida: %s", resolution)
}
