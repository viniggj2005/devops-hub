package ferretshellHandlers

import (
	"bytes"
	"docker-manager-go/src/processes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unicode/utf16"
)

type wslDistribution struct {
	name      string
	isDefault bool
}

func detectLocalShells() []localShell {
	shells := []localShell{}
	defaultIndex := 0

	wslPath, wslLookError := exec.LookPath("wsl.exe")
	if wslLookError != nil {
		wslPath = ""
	}

	for _, distribution := range listWslDistributions(wslPath) {
		if distribution.isDefault {
			defaultIndex = len(shells)
		}
		shells = append(shells, newLocalShell(
			"wsl:"+distribution.name,
			shellKindWsl,
			"WSL · "+distribution.name,
			wslPath,
			"-d", distribution.name, "--cd", "~",
		))
	}

	if pwshPath, lookError := exec.LookPath("pwsh.exe"); lookError == nil {
		shells = append(shells, newLocalShell("pwsh", shellKindPowerShell, "PowerShell 7", pwshPath, "-NoLogo"))
	}
	if powershellPath, lookError := exec.LookPath("powershell.exe"); lookError == nil {
		shells = append(shells, newLocalShell("powershell", shellKindPowerShell, "Windows PowerShell", powershellPath, "-NoLogo"))
	}
	if cmdPath, lookError := exec.LookPath("cmd.exe"); lookError == nil {
		shells = append(shells, newLocalShell("cmd", shellKindCmd, "Prompt de Comando", cmdPath))
	}
	if gitBashPath := findGitBash(); gitBashPath != "" {
		shells = append(shells, newLocalShell("gitbash", shellKindGitBash, "Git Bash", gitBashPath, "--login", "-i"))
	}

	return markDefaultShell(shells, defaultIndex)
}

func listWslDistributions(wslPath string) []wslDistribution {
	if wslPath == "" {
		return nil
	}

	output, runError := processes.Command(wslPath, "--list", "--verbose").Output()
	if runError != nil {
		return nil
	}

	lines := strings.Split(decodeWslOutput(output), "\n")
	if len(lines) < 2 {
		return nil
	}

	distributions := []wslDistribution{}
	for _, line := range lines[1:] {
		trimmedLine := strings.TrimSpace(line)
		isDefault := strings.HasPrefix(trimmedLine, "*")
		fields := strings.Fields(strings.TrimPrefix(trimmedLine, "*"))
		if len(fields) == 0 || strings.HasPrefix(strings.ToLower(fields[0]), "docker-desktop") {
			continue
		}
		distributions = append(distributions, wslDistribution{name: fields[0], isDefault: isDefault})
	}
	return distributions
}

func decodeWslOutput(output []byte) string {
	isUtf16 := len(output) >= 2 && bytes.Count(output, []byte{0}) >= len(output)/3
	if !isUtf16 {
		return strings.ReplaceAll(string(output), "\r", "")
	}

	codeUnits := make([]uint16, 0, len(output)/2)
	for position := 0; position+1 < len(output); position += 2 {
		codeUnits = append(codeUnits, uint16(output[position])|uint16(output[position+1])<<8)
	}
	decoded := string(utf16.Decode(codeUnits))
	decoded = strings.TrimPrefix(decoded, "\ufeff")
	return strings.ReplaceAll(decoded, "\r", "")
}

func findGitBash() string {
	candidates := []string{
		filepath.Join(os.Getenv("ProgramFiles"), "Git", "bin", "bash.exe"),
		filepath.Join(os.Getenv("LocalAppData"), "Programs", "Git", "bin", "bash.exe"),
	}
	for _, candidate := range candidates {
		if _, statError := os.Stat(candidate); statError == nil {
			return candidate
		}
	}
	return ""
}
