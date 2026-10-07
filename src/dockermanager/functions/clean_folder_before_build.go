package dockerFunctions

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

func CleanFolderBeforeBuild(path string) []string {
	var excludes []string
	dockerIgnorePath := filepath.Join(path, ".dockerignore")
	if fileInfos, err := os.Stat(dockerIgnorePath); err == nil && !fileInfos.IsDir() {
		file, err := os.Open(dockerIgnorePath)
		if err == nil {
			defer file.Close()
			scanner := bufio.NewScanner(file)
			for scanner.Scan() {
				line := strings.TrimSpace(scanner.Text())
				if line != "" && !strings.HasPrefix(line, "#") {
					excludes = append(excludes, line)
				}
			}
		}
	}
	return excludes
}
