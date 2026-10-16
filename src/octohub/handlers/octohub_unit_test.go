package octohubHandler

import (
	"crypto/ed25519"
	"crypto/rand"
	"docker-manager-go/src/octohub/structs"
	"encoding/pem"
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
)

func generateTestEd25519PEM(test *testing.T) string {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		test.Fatalf("unexpected error generating ed25519 key: %v", err)
	}
	block, err := ssh.MarshalPrivateKey(privateKey, "test")
	if err != nil {
		test.Fatalf("unexpected error marshaling private key: %v", err)
	}
	return string(pem.EncodeToMemory(block))
}

func TestGitAuthHelpers(test *testing.T) {
	header := basicAuthHeader("user", "pass")
	if !strings.HasPrefix(header, "AUTHORIZATION: basic ") {
		test.Fatalf("unexpected basicAuthHeader: %s", header)
	}

	authConfig := gitAuth{
		knownHosts: "/tmp/known_hosts",
		http: []httpCredential{
			{host: "github.com", header: header},
		},
	}
	envVars := authConfig.env()
	foundConfigCount := false
	for _, entry := range envVars {
		if entry == "GIT_CONFIG_COUNT=1" {
			foundConfigCount = true
		}
	}
	if !foundConfigCount {
		test.Fatalf("expected GIT_CONFIG_COUNT=1 in env")
	}

	privateKeyPem := generateTestEd25519PEM(test)
	decodedKey, err := decodePrivateKey(privateKeyPem, "")
	if err != nil || len(decodedKey) == 0 {
		test.Fatalf("unexpected error decoding valid private key: %v", err)
	}

	if _, err := decodePrivateKey("invalid-key", ""); err == nil {
		test.Fatalf("expected error decoding invalid private key")
	}

	authConfig.sshKey = decodedKey
	sshEnvVars, cleanup, err := authConfig.sshEnv()
	if err != nil {
		test.Fatalf("unexpected sshEnv error: %v", err)
	}
	defer cleanup()
	if len(sshEnvVars) != 1 || !strings.HasPrefix(sshEnvVars[0], "GIT_SSH_COMMAND=") {
		test.Fatalf("unexpected sshEnvVars: %v", sshEnvVars)
	}

	if !isNetworkCommand([]string{"-c", "color.ui=false", "push", "origin", "main"}) {
		test.Fatalf("expected push to be detected as network command")
	}
	if isNetworkCommand([]string{"status", "--porcelain"}) {
		test.Fatalf("expected status to not be network command")
	}

	if !isAuthError("fatal: Authentication failed for 'https://github.com/a/b.git'") {
		test.Fatalf("expected Authentication failed to be detected as auth error")
	}
	if isAuthError("Everything up-to-date") {
		test.Fatalf("expected normal output to not be auth error")
	}

	host, isSSH := parseRemote("git@github.com:owner/repo.git")
	if host != "github.com" || !isSSH {
		test.Fatalf("unexpected parseRemote for SCP URL: host=%s isSSH=%v", host, isSSH)
	}

	host, isSSH = parseRemote("https://GitLab.com/group/project.git")
	if host != "gitlab.com" || isSSH {
		test.Fatalf("unexpected parseRemote for HTTPS URL: host=%s isSSH=%v", host, isSSH)
	}

	if sshHostname("gitlab.com:2222") != "gitlab.com" {
		test.Fatalf("unexpected sshHostname")
	}

	if normalizeCredentialHost("https://GitLab.com/user/repo") != "gitlab.com" {
		test.Fatalf("unexpected normalizeCredentialHost for URL")
	}
	if normalizeCredentialHost("  git.example.com:8443 ") != "git.example.com:8443" {
		test.Fatalf("unexpected normalizeCredentialHost for host:port")
	}

	if authFailure("gitlab.com", true, "permission denied") == nil {
		test.Fatalf("expected non-nil authFailure error")
	}
}

func TestPartialAndDiscardPatchBuilders(test *testing.T) {
	sampleDiff := strings.Join([]string{
		"diff --git a/main.go b/main.go",
		"index 1111111..2222222 100644",
		"--- a/main.go",
		"+++ b/main.go",
		"@@ -1,3 +1,4 @@",
		" package main",
		"-oldLine",
		"+newLineOne",
		"+newLineTwo",
		" func main() {}",
	}, "\n")

	if len(hashDiff(sampleDiff)) != 64 {
		test.Fatalf("expected 64-char sha256 hex from hashDiff")
	}

	partialPatch, err := buildPartialPatch(sampleDiff, []int{7})
	if err != nil {
		test.Fatalf("unexpected error building partial patch: %v", err)
	}
	if !strings.Contains(partialPatch, "+newLineOne") || strings.Contains(partialPatch, "+newLineTwo") {
		test.Fatalf("unexpected partialPatch content:\n%s", partialPatch)
	}

	discardPatch, err := buildDiscardPatch(sampleDiff, []int{6, 7})
	if err != nil {
		test.Fatalf("unexpected error building discard patch: %v", err)
	}
	if !strings.Contains(discardPatch, "+oldLine") || !strings.Contains(discardPatch, "-newLineOne") {
		test.Fatalf("unexpected discardPatch content:\n%s", discardPatch)
	}

	deletedHeader := []string{
		"diff --git a/removed.txt b/removed.txt",
		"deleted file mode 100644",
		"--- a/removed.txt",
		"+++ /dev/null",
	}
	keptHeader := keepDeletedFileAsModified(deletedHeader)
	if len(keptHeader) != 3 || keptHeader[2] != "+++ b/removed.txt" {
		test.Fatalf("unexpected keepDeletedFileAsModified result: %v", keptHeader)
	}

	discardedDeletedHeader := discardHeader(deletedHeader)
	if len(discardedDeletedHeader) != 4 || discardedDeletedHeader[2] != "--- /dev/null" {
		test.Fatalf("unexpected discardHeader for deleted file: %v", discardedDeletedHeader)
	}
}

func TestGitParsingAndValidationHelpers(test *testing.T) {
	if validCommitHash("abc1234") != nil {
		test.Fatalf("expected 7-char hex hash to be valid")
	}
	if validCommitHash("not-a-hash!") == nil {
		test.Fatalf("expected invalid commit hash to fail")
	}

	if !sameCommits([]string{"a", "b"}, []string{"b", "a"}) {
		test.Fatalf("expected sameCommits to return true for permutation")
	}
	if sameCommits([]string{"a", "b"}, []string{"a", "c"}) {
		test.Fatalf("expected sameCommits to return false for different elements")
	}

	if !isBinaryContent([]byte{'a', 0, 'b'}) {
		test.Fatalf("expected null byte content to be detected as binary")
	}
	if isBinaryContent([]byte("plain text")) {
		test.Fatalf("expected plain text to not be binary")
	}

	conflictedText := []byte("line 1\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n")
	if countConflictMarkers(conflictedText) != 1 || !hasConflictMarkers(conflictedText) {
		test.Fatalf("expected conflict markers to be detected")
	}

	if !sameContent([]byte("a\r\nb\r\n"), []byte("a\nb\n")) {
		test.Fatalf("expected CRLF and LF content to be considered equal")
	}

	cleanedMessage := cleanCommitMessage("Title\n# comment\nBody\n")
	if cleanedMessage != "Title\nBody" {
		test.Fatalf("unexpected cleanCommitMessage: %q", cleanedMessage)
	}

	if validBranchArgument("-bad") == nil || validBranchArgument("") == nil {
		test.Fatalf("expected invalid branch argument to fail")
	}
	if validateCompareBranch("a..b") == nil || validateCompareBranch("-flag") == nil {
		test.Fatalf("expected invalid compare branch to fail")
	}

	tags := parseTagDecorations("HEAD -> main, tag: v2.0.0, origin/main, tag: v1.0.0")
	if len(tags) != 2 || tags[0] != "v1.0.0" || tags[1] != "v2.0.0" {
		test.Fatalf("unexpected parsed tags: %v", tags)
	}

	if fileKind("??") != octohubStructs.FileKindUntracked {
		test.Fatalf("expected untracked kind")
	}
	if fileKind("UU") != octohubStructs.FileKindConflicted {
		test.Fatalf("expected conflicted kind")
	}
	if fileKind("R ") != octohubStructs.FileKindRenamed {
		test.Fatalf("expected renamed kind")
	}
	if fileKind("D ") != octohubStructs.FileKindDeleted {
		test.Fatalf("expected deleted kind")
	}
	if fileKind("A ") != octohubStructs.FileKindAdded {
		test.Fatalf("expected added kind")
	}
	if fileKind(" M") != octohubStructs.FileKindModified {
		test.Fatalf("expected modified kind")
	}

	escaped := escapeGitignorePattern("file [1]*?.txt ")
	if escaped != `file \[1\]\*\?.txt\ ` {
		test.Fatalf("unexpected escaped gitignore pattern: %q", escaped)
	}

	if !validRepositoryName("my-repo_1.0") || validRepositoryName("..") || validRepositoryName("bad/name") {
		test.Fatalf("unexpected validRepositoryName behavior")
	}

	if repositoryNameFromURL("https://github.com/owner/devops-hub.git/") != "devops-hub" {
		test.Fatalf("unexpected repositoryNameFromURL")
	}

	if githubFullName("git@github.com:Owner/Repo.git") != "owner/repo" {
		test.Fatalf("unexpected githubFullName for SSH URL")
	}
	if githubFullName("https://github.com/Owner/Repo.git") != "owner/repo" {
		test.Fatalf("unexpected githubFullName for HTTPS URL")
	}

	remoteHost, remotePath := remoteRepositoryPath("git@gitlab.com:Group/Sub/Project.git")
	if remoteHost != "gitlab.com" || remotePath != "group/sub/project" {
		test.Fatalf("unexpected remoteRepositoryPath: host=%s path=%s", remoteHost, remotePath)
	}

	advance, token, err := splitProgressLines([]byte("Receiving objects: 50%\rDone\n"), false)
	if err != nil || advance == 0 || string(token) != "Receiving objects: 50%" {
		test.Fatalf("unexpected splitProgressLines: advance=%d token=%q err=%v", advance, string(token), err)
	}
}

