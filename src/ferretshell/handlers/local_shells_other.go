//go:build !windows

package ferretshellHandlers

import (
	"os"
	"path/filepath"
)

func detectLocalShells() []localShell {
	shells := []localShell{}
	knownPaths := map[string]bool{}

	addShell := func(path string) {
		if path == "" || knownPaths[path] {
			return
		}
		if _, statError := os.Stat(path); statError != nil {
			return
		}
		knownPaths[path] = true
		name := filepath.Base(path)
		shells = append(shells, newLocalShell(name, shellKindUnix, name, path, "-l"))
	}

	addShell(os.Getenv("SHELL"))
	addShell("/bin/bash")
	addShell("/bin/zsh")
	addShell("/bin/sh")

	return markDefaultShell(shells, 0)
}
