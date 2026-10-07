package octohubHandler

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

var unsafeOpenExtensions = map[string]bool{
	".application": true, ".appinstaller": true,
	".app": true, ".run": true, ".msix": true, ".appx": true, ".psm1": true, ".tool": true,
	".js": true, ".py": true, ".sh": true, ".pl": true, ".rb": true, ".vb": true, ".ws": true,
	".gadget": true, ".command": true, ".desktop": true, ".appimage": true, ".appref-ms": true,
	".scr": true, ".pif": true, ".cpl": true, ".reg": true, ".lnk": true, ".url": true, ".hta": true,
	".jar": true, ".jse": true, ".vbs": true, ".vbe": true, ".wsf": true, ".wsh": true, ".wsc": true,
	".ps1": true, ".inf": true, ".scf": true, ".chm": true, ".pyw": true, ".pyz": true, ".rbw": true,
	".exe": true, ".com": true, ".bat": true, ".cmd": true, ".msi": true, ".msp": true, ".msc": true,
}

func startDetached(cmd *exec.Cmd) error {
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}

func (handlerStruct *GitBranchHandler) repoFile(file string) (string, error) {
	repoPath := handlerStruct.gitHandler.RepoPath()
	if repoPath == "" {
		return "", errNoRepository
	}
	root := filepath.Clean(repoPath)
	fullPath := filepath.Join(root, filepath.FromSlash(file))
	if !strings.HasPrefix(fullPath, root+string(filepath.Separator)) {
		return "", fmt.Errorf("caminho fora do repositório: %s", file)
	}
	return fullPath, nil
}

func vscodeExecutable() (string, error) {
	if runtime.GOOS != "windows" {
		return exec.LookPath("code")
	}
	var candidates []string
	if launcher, err := exec.LookPath("code"); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(filepath.Dir(launcher)), "Code.exe"))
	}
	if local := os.Getenv("LOCALAPPDATA"); local != "" {
		candidates = append(candidates, filepath.Join(local, "Programs", "Microsoft VS Code", "Code.exe"))
	}
	for _, programs := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)")} {
		if programs != "" {
			candidates = append(candidates, filepath.Join(programs, "Microsoft VS Code", "Code.exe"))
		}
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", errors.New("VS Code não encontrado")
}

func (handlerStruct *GitBranchHandler) OpenFileInEditor(file string) error {
	fullPath, err := handlerStruct.repoFile(file)
	if err != nil {
		return err
	}
	editor, err := vscodeExecutable()
	if err != nil {
		return errors.New(`VS Code não encontrado. Instale-o ou adicione o comando "code" ao PATH`)
	}
	cmd := exec.Command(editor, fullPath)
	for _, entry := range os.Environ() {
		if !strings.HasPrefix(strings.ToUpper(entry), "ELECTRON_RUN_AS_NODE=") {
			cmd.Env = append(cmd.Env, entry)
		}
	}
	return startDetached(cmd)
}

func (handlerStruct *GitBranchHandler) RevealInExplorer(file string) error {
	fullPath, err := handlerStruct.repoFile(file)
	if err != nil {
		return err
	}
	_, statErr := os.Stat(fullPath)
	exists := statErr == nil
	switch runtime.GOOS {
	case "windows":
		if exists {
			return startDetached(exec.Command("explorer", "/select,", fullPath))
		}
		return startDetached(exec.Command("explorer", filepath.Dir(fullPath)))
	case "darwin":
		if exists {
			return startDetached(exec.Command("open", "-R", fullPath))
		}
		return startDetached(exec.Command("open", filepath.Dir(fullPath)))
	default:
		return startDetached(exec.Command("xdg-open", filepath.Dir(fullPath)))
	}
}

func (handlerStruct *GitBranchHandler) OpenWithDefaultProgram(file string) error {
	fullPath, err := handlerStruct.repoFile(file)
	if err != nil {
		return err
	}
	extension := strings.ToLower(filepath.Ext(strings.TrimRight(fullPath, ". ")))
	if unsafeOpenExtensions[extension] {
		return fmt.Errorf("por segurança, arquivos %s não são abertos com o programa padrão (eles seriam executados). Use \"Abrir no VS Code\"", extension)
	}
	if _, err := os.Stat(fullPath); err != nil {
		return fmt.Errorf("o arquivo %s não existe mais", file)
	}
	switch runtime.GOOS {
	case "windows":
		return startDetached(exec.Command("rundll32", "url.dll,FileProtocolHandler", fullPath))
	case "darwin":
		return startDetached(exec.Command("open", fullPath))
	default:
		return startDetached(exec.Command("xdg-open", fullPath))
	}
}

func escapeGitignorePattern(value string) string {
	var builder strings.Builder
	for _, char := range value {
		if strings.ContainsRune(`\*?[]!#`, char) {
			builder.WriteRune('\\')
		}
		builder.WriteRune(char)
	}
	result := builder.String()
	if strings.HasSuffix(result, " ") {
		result = strings.TrimSuffix(result, " ") + `\ `
	}
	return result
}

func (handlerStruct *GitBranchHandler) IgnoreFile(file string) error {
	if _, err := handlerStruct.repoFile(file); err != nil {
		return err
	}
	return handlerStruct.appendGitignore("/" + escapeGitignorePattern(file))
}

func (handlerStruct *GitBranchHandler) IgnoreExtension(extension string) error {
	extension = strings.TrimPrefix(strings.TrimSpace(extension), ".")
	if extension == "" || strings.ContainsAny(extension, `/\`) {
		return fmt.Errorf("extensão inválida: %q", extension)
	}
	return handlerStruct.appendGitignore("*." + escapeGitignorePattern(extension))
}

func (handlerStruct *GitBranchHandler) appendGitignore(pattern string) error {
	if strings.ContainsAny(pattern, "\r\n") {
		return fmt.Errorf("padrão inválido para o .gitignore")
	}
	repoPath := handlerStruct.gitHandler.RepoPath()
	if repoPath == "" {
		return errNoRepository
	}
	path := filepath.Join(repoPath, ".gitignore")

	content, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	text := string(content)
	for _, line := range strings.Split(text, "\n") {
		if strings.TrimRight(line, "\r") == pattern {
			return nil
		}
	}

	newline := "\n"
	if strings.Contains(text, "\r\n") {
		newline = "\r\n"
	}
	if text != "" && !strings.HasSuffix(text, "\n") {
		text += newline
	}
	return os.WriteFile(path, []byte(text+pattern+newline), 0o644)
}
