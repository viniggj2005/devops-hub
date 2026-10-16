package dockerFunctions

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/pkg/stdcopy"
)

func generateTestCertificates(test *testing.T) (string, string, string) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		test.Fatalf("unexpected error generating RSA key: %v", err)
	}

	template := x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{Organization: []string{"DevopsHub Test"}},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	if err != nil {
		test.Fatalf("unexpected error creating certificate: %v", err)
	}

	certPemBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	keyPemBytes := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privateKey)})

	return string(certPemBytes), string(certPemBytes), string(keyPemBytes)
}

func TestBuildTLSHTTPClient(test *testing.T) {
	caPem, certPem, keyPem := generateTestCertificates(test)

	httpClient, err := BuildTLSHTTPClient(caPem, certPem, keyPem)
	if err != nil || httpClient == nil {
		test.Fatalf("unexpected error building TLS HTTP client: %v", err)
	}

	_, err = BuildTLSHTTPClient(caPem, "invalid-cert", keyPem)
	if err == nil {
		test.Fatalf("expected error for invalid client cert/key")
	}

	_, err = BuildTLSHTTPClient("invalid-ca", certPem, keyPem)
	if err == nil {
		test.Fatalf("expected error for invalid CA")
	}
}

func TestCleanFolderBeforeBuild(test *testing.T) {
	temporaryDir := test.TempDir()

	excludes := CleanFolderBeforeBuild(temporaryDir)
	if len(excludes) != 0 {
		test.Fatalf("expected empty excludes when .dockerignore is missing, got %v", excludes)
	}

	dockerIgnoreContent := "# comment line\n\nnode_modules\n  dist/  \n# another comment\n.env\n"
	dockerIgnorePath := filepath.Join(temporaryDir, ".dockerignore")
	if err := os.WriteFile(dockerIgnorePath, []byte(dockerIgnoreContent), 0o644); err != nil {
		test.Fatalf("unexpected error writing .dockerignore: %v", err)
	}

	excludes = CleanFolderBeforeBuild(temporaryDir)
	if len(excludes) != 3 || excludes[0] != "node_modules" || excludes[1] != "dist/" || excludes[2] != ".env" {
		test.Fatalf("unexpected excludes: %v", excludes)
	}
}

func TestLogsTreatment(test *testing.T) {
	plainInput := "\x1b[32m2026-10-16T12:00:00Z\x1b[0m GET /health 200 10.0.0.1\nPOST /err 500\nPUT /item 301\nPATCH /u 404\nDELETE /x 204\nHEAD /y"
	formatted := LogsTreatment(io.NopCloser(strings.NewReader(plainInput)))

	expectedSnippets := []string{
		`<span class="text-sky-400">2026-10-16T12:00:00Z</span>`,
		`<span class="text-emerald-400">GET</span>`,
		`<span class="text-emerald-400">200</span>`,
		`<span class="text-emerald-300">10.0.0.1</span>`,
		`<span class="text-cyan-400">POST</span>`,
		`<span class="text-red-500 font-semibold">500</span>`,
		`<span class="text-amber-300">PUT</span>`,
		`<span class="text-amber-300">301</span>`,
		`<span class="text-yellow-300">PATCH</span>`,
		`<span class="text-rose-400 font-semibold">404</span>`,
		`<span class="text-rose-400 font-semibold">DELETE</span>`,
		`<br>`,
	}

	for _, snippet := range expectedSnippets {
		if !strings.Contains(formatted, snippet) {
			test.Fatalf("expected formatted logs to contain %q, got %q", snippet, formatted)
		}
	}

	var muxBuffer bytes.Buffer
	stdoutWriter := stdcopy.NewStdWriter(&muxBuffer, stdcopy.Stdout)
	stderrWriter := stdcopy.NewStdWriter(&muxBuffer, stdcopy.Stderr)
	_, _ = stdoutWriter.Write([]byte("GET /mux 200\n"))
	_, _ = stderrWriter.Write([]byte("DELETE /mux 500\n"))

	muxFormatted := LogsTreatment(io.NopCloser(bytes.NewReader(muxBuffer.Bytes())))
	if !strings.Contains(muxFormatted, `<span class="text-emerald-400">GET</span>`) || !strings.Contains(muxFormatted, `<span class="text-rose-400 font-semibold">DELETE</span>`) {
		test.Fatalf("unexpected mux formatted output: %s", muxFormatted)
	}
}
