package appErrors

import (
	"os"
	"regexp"
	"strings"
	"testing"
	"io/fs"
	"path/filepath"
)

var errorCodePattern = regexp.MustCompile(`appErrors\.(?:New|Wrap)\("([\w.]+)"`)

func collectErrorCodes(test *testing.T, projectRoot string) map[string]string {
	codes := map[string]string{}
	skippedFolders := map[string]bool{".git": true, "frontend": true, "node_modules": true, "build": true, "bin": true}
	walkErr := filepath.WalkDir(projectRoot, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() && skippedFolders[entry.Name()] {
			return filepath.SkipDir
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		content, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		for _, match := range errorCodePattern.FindAllStringSubmatch(string(content), -1) {
			codes[match[1]] = path
		}
		return nil
	})
	if walkErr != nil {
		test.Fatalf("unexpected error scanning sources: %v", walkErr)
	}
	return codes
}

func TestEveryErrorCodeHasTranslation(test *testing.T) {
	projectRoot := filepath.Join("..", "..")
	dictionaryPath := filepath.Join(projectRoot, "frontend", "src", "features", "i18n", "dictionaries", "ptBR.ts")
	dictionaryContent, err := os.ReadFile(dictionaryPath)
	if err != nil {
		test.Fatalf("unexpected error reading dictionary: %v", err)
	}
	dictionary := strings.ReplaceAll(string(dictionaryContent), "\r\n", "\n")
	errorsStart := strings.Index(dictionary, "\n  errors: {")
	if errorsStart < 0 {
		test.Fatalf("errors section not found in %s", dictionaryPath)
	}
	errorsSection := dictionary[errorsStart:]

	codes := collectErrorCodes(test, projectRoot)
	if len(codes) == 0 {
		test.Fatalf("expected to find error codes in the sources")
	}
	for code, sourcePath := range codes {
		group, key, found := strings.Cut(code, ".")
		if !found {
			test.Errorf("error code %q in %s must be <group>.<key>", code, sourcePath)
			continue
		}
		groupPattern := regexp.MustCompile(`(?s)\n    ` + regexp.QuoteMeta(group) + `: \{(.*?)\n    \}`)
		groupMatch := groupPattern.FindStringSubmatch(errorsSection)
		if groupMatch == nil || !strings.Contains(groupMatch[1], "\n      "+key+":") {
			test.Errorf("error code %q used in %s has no translation in ptBR.ts", code, sourcePath)
		}
	}
}
