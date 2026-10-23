package ferretshellHandlers

import ferretShellDtos "docker-manager-go/src/ferretshell/dtos"

const (
	shellKindCmd        = "cmd"
	shellKindWsl        = "wsl"
	shellKindUnix       = "unix"
	shellKindGitBash    = "gitbash"
	shellKindPowerShell = "powershell"
)

type localShell struct {
	path        string
	arguments   []string
	description ferretShellDtos.LocalShellDto
}

func newLocalShell(id, kind, name, path string, arguments ...string) localShell {
	return localShell{
		path:      path,
		arguments: arguments,
		description: ferretShellDtos.LocalShellDto{
			Id:   id,
			Kind: kind,
			Name: name,
		},
	}
}

func markDefaultShell(shells []localShell, defaultIndex int) []localShell {
	if defaultIndex < 0 || defaultIndex >= len(shells) {
		defaultIndex = 0
	}
	if len(shells) > 0 {
		shells[defaultIndex].description.IsDefault = true
	}
	return shells
}
