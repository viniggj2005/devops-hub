package octohubHandler

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/crypto/ssh"
)

type httpCredential struct {
	host   string
	header string
}

type gitAuth struct {
	sshKey     []byte
	knownHosts string
	http       []httpCredential
}

var (
	hostOnlyRegex   = regexp.MustCompile(`^[\w.-]+(:\d+)?$`)
	scpRemoteRegex  = regexp.MustCompile(`^(?:[\w.-]+@)?([\w.-]+):`)
	networkCommands = map[string]bool{"push": true, "fetch": true, "pull": true, "clone": true, "ls-remote": true}
	authErrorHints  = []string{
		"authentication failed", "could not read username", "could not read password", "terminal prompts disabled",
		"user interactivity has been disabled", "permission denied (publickey", "http basic: access denied",
		"invalid username or password", "returned error: 401", "returned error: 403", "access denied",
	}
)

func basicAuthHeader(username, secret string) string {
	return "AUTHORIZATION: basic " + base64.StdEncoding.EncodeToString([]byte(username+":"+secret))
}

func (auth gitAuth) env() []string {
	env := append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	if len(auth.http) == 0 {
		return env
	}
	env = append(env, "GCM_INTERACTIVE=never", fmt.Sprintf("GIT_CONFIG_COUNT=%d", len(auth.http)))
	for index, credential := range auth.http {
		env = append(env,
			fmt.Sprintf("GIT_CONFIG_KEY_%d=http.https://%s/.extraheader", index, credential.host),
			fmt.Sprintf("GIT_CONFIG_VALUE_%d=%s", index, credential.header),
		)
	}
	return env
}

func (auth gitAuth) sshEnv() ([]string, func(), error) {
	if len(auth.sshKey) == 0 {
		return nil, func() {}, nil
	}
	file, err := os.CreateTemp("", "octohub-ssh-*")
	if err != nil {
		return nil, nil, err
	}
	path := file.Name()
	cleanup := func() { os.Remove(path) }
	_, err = file.Write(auth.sshKey)
	file.Close()
	if err != nil {
		cleanup()
		return nil, nil, err
	}
	os.Chmod(path, 0o600)

	command := "ssh -i " + shellQuote(path) + " -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new"
	if auth.knownHosts != "" {
		command += " -o UserKnownHostsFile=" + shellQuote(auth.knownHosts)
	}
	return []string{"GIT_SSH_COMMAND=" + command}, cleanup, nil
}

func shellQuote(path string) string {
	return "'" + strings.ReplaceAll(filepath.ToSlash(path), "'", `'\''`) + "'"
}

func appKnownHostsFile() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	folder := filepath.Join(configDir, "DockerManager")
	os.MkdirAll(folder, 0o700)
	return filepath.Join(folder, "known_hosts")
}

func isNetworkCommand(args []string) bool {
	for index := 0; index < len(args); index++ {
		switch {
		case args[index] == "-c" || args[index] == "-C":
			index++
		case strings.HasPrefix(args[index], "-"):
		default:
			return networkCommands[args[index]]
		}
	}
	return false
}

func isAuthError(message string) bool {
	lower := strings.ToLower(message)
	for _, hint := range authErrorHints {
		if strings.Contains(lower, hint) {
			return true
		}
	}
	return false
}

func parseRemote(remoteURL string) (string, bool) {
	value := strings.TrimSpace(remoteURL)
	if strings.Contains(value, "://") {
		parsed, err := url.Parse(value)
		if err != nil {
			return "", false
		}
		switch parsed.Scheme {
		case "ssh", "git+ssh", "ssh+git":
			return strings.ToLower(parsed.Hostname()), true
		case "http", "https":
			return strings.ToLower(parsed.Host), false
		}
		return "", false
	}
	if match := scpRemoteRegex.FindStringSubmatch(value); match != nil && len(match[1]) > 1 {
		return strings.ToLower(match[1]), true
	}
	return "", false
}

func sshHostname(host string) string {
	return strings.SplitN(host, ":", 2)[0]
}

func normalizeCredentialHost(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if hostOnlyRegex.MatchString(value) {
		return value
	}
	if host, _ := parseRemote(value); host != "" {
		return host
	}
	return ""
}

func authFailure(host string, isSSH bool, message string) error {
	if host == "" || (host == "github.com" && !isSSH) {
		return errors.New(friendlyGitError(message))
	}
	return fmt.Errorf("%s recusou o acesso: configure usuário e senha (ou token) ou uma chave SSH para esse servidor. [auth:%s]\n%s", host, host, message)
}

func decodePrivateKey(privateKey, passphrase string) ([]byte, error) {
	var raw any
	var err error
	if passphrase != "" {
		raw, err = ssh.ParseRawPrivateKeyWithPassphrase([]byte(privateKey), []byte(passphrase))
	} else {
		raw, err = ssh.ParseRawPrivateKey([]byte(privateKey))
	}
	if err != nil {
		var missing *ssh.PassphraseMissingError
		if errors.As(err, &missing) {
			return nil, fmt.Errorf("essa chave SSH é protegida por senha: informe a senha da chave")
		}
		if passphrase != "" {
			return nil, fmt.Errorf("não foi possível abrir a chave SSH, confira a senha: %w", err)
		}
		return nil, fmt.Errorf("chave SSH inválida: %w", err)
	}
	if key, isPointer := raw.(*ed25519.PrivateKey); isPointer {
		raw = *key
	}
	block, err := ssh.MarshalPrivateKey(raw, "octohub")
	if err != nil {
		return nil, err
	}
	return pem.EncodeToMemory(block), nil
}
