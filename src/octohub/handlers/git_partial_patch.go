package octohubHandler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var hunkHeaderRegex = regexp.MustCompile(`^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@`)

type patchHunk struct {
	oldStart   int
	oldCount   int
	newCount   int
	hasChanges bool
	lines      []string
}

func hashDiff(diff string) string {
	sum := sha256.Sum256([]byte(diff))
	return hex.EncodeToString(sum[:])
}

func buildPartialPatch(diff string, selectedLines []int) (string, error) {
	return buildSelectionPatch(diff, selectedLines, false)
}

func buildDiscardPatch(diff string, selectedLines []int) (string, error) {
	return buildSelectionPatch(diff, selectedLines, true)
}

func buildSelectionPatch(diff string, selectedLines []int, discard bool) (string, error) {
	selected := make(map[int]bool, len(selectedLines))
	for _, index := range selectedLines {
		selected[index] = true
	}

	var header []string
	var hunks []*patchHunk
	var current *patchHunk
	lastLineKept := false
	totalDeletions, selectedDeletions := 0, 0

	keep := func(line string, inOld, inNew, isChange bool) {
		current.lines = append(current.lines, line)
		if inOld {
			current.oldCount++
		}
		if inNew {
			current.newCount++
		}
		if isChange {
			current.hasChanges = true
		}
		lastLineKept = true
	}

	for index, line := range strings.Split(diff, "\n") {
		switch {
		case strings.HasPrefix(line, "diff "):
			if current != nil {
				return "", fmt.Errorf("o diff contém mais de um arquivo")
			}
			header = append(header, line)
		case strings.HasPrefix(line, "@@"):
			match := hunkHeaderRegex.FindStringSubmatch(line)
			if match == nil {
				return "", fmt.Errorf("cabeçalho de hunk inválido: %s", line)
			}
			start := match[1]
			if discard {
				start = match[2]
			}
			oldStart, _ := strconv.Atoi(start)
			current = &patchHunk{oldStart: oldStart}
			hunks = append(hunks, current)
			lastLineKept = false
		case current == nil:
			if line != "" && !strings.HasPrefix(line, "index ") {
				header = append(header, line)
			}
		case strings.HasPrefix(line, "+"):
			switch {
			case discard && selected[index]:
				keep("-"+line[1:], true, false, true)
			case discard:
				keep(" "+line[1:], true, true, false)
			case selected[index]:
				keep(line, false, true, true)
			default:
				lastLineKept = false
			}
		case strings.HasPrefix(line, "-"):
			totalDeletions++
			switch {
			case discard && selected[index]:
				keep("+"+line[1:], false, true, true)
			case discard:
				lastLineKept = false
			case selected[index]:
				selectedDeletions++
				keep(line, true, false, true)
			default:
				keep(" "+line[1:], true, true, false)
			}
		case strings.HasPrefix(line, " "):
			keep(line, true, true, false)
		case strings.HasPrefix(line, "\\"):
			if lastLineKept {
				current.lines = append(current.lines, line)
			}
		}
	}

	var body []string
	delta := 0
	for _, hunk := range hunks {
		if !hunk.hasChanges {
			continue
		}
		newStart := hunk.oldStart + delta
		if hunk.oldCount == 0 {
			newStart++
		}
		if hunk.newCount == 0 {
			newStart--
		}
		body = append(body, fmt.Sprintf("@@ -%d,%d +%d,%d @@", hunk.oldStart, hunk.oldCount, newStart, hunk.newCount))
		body = append(body, hunk.lines...)
		delta += hunk.newCount - hunk.oldCount
	}
	if len(body) == 0 {
		return "", nil
	}

	if discard {
		header = discardHeader(header)
	} else if selectedDeletions < totalDeletions {
		header = keepDeletedFileAsModified(header)
	}

	return strings.Join(append(header, body...), "\n") + "\n", nil
}

func keepDeletedFileAsModified(header []string) []string {
	var oldPath string
	isDeleted := false
	for _, line := range header {
		if strings.HasPrefix(line, "--- ") {
			oldPath = strings.TrimPrefix(line, "--- ")
		}
		if strings.HasPrefix(line, "deleted file mode") {
			isDeleted = true
		}
	}
	if !isDeleted || oldPath == "" {
		return header
	}

	result := make([]string, 0, len(header))
	for _, line := range header {
		switch {
		case strings.HasPrefix(line, "deleted file mode"):
			continue
		case line == "+++ /dev/null":
			result = append(result, "+++ "+strings.Replace(oldPath, "a/", "b/", 1))
		default:
			result = append(result, line)
		}
	}
	return result
}

func discardHeader(header []string) []string {
	mode := "100644"
	var oldPath, newPath string
	for _, line := range header {
		switch {
		case strings.HasPrefix(line, "--- "):
			oldPath = strings.TrimPrefix(line, "--- ")
		case strings.HasPrefix(line, "+++ "):
			newPath = strings.TrimPrefix(line, "+++ ")
		case strings.HasPrefix(line, "deleted file mode "):
			mode = strings.TrimPrefix(line, "deleted file mode ")
		}
	}

	if newPath == "/dev/null" {
		target := strings.Replace(oldPath, "a/", "b/", 1)
		return []string{"diff --git " + oldPath + " " + target, "new file mode " + mode, "--- /dev/null", "+++ " + target}
	}
	source := strings.Replace(newPath, "b/", "a/", 1)
	return []string{"diff --git " + source + " " + newPath, "--- " + source, "+++ " + newPath}
}
