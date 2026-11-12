package dockerFunctions

import (
	"crypto/tls"
	"crypto/x509"
	"net/http"

	"docker-manager-go/src/appErrors"
)

func BuildTLSHTTPClient(caPEM, certPEM, keyPEM string) (*http.Client, error) {
	cert, err := tls.X509KeyPair([]byte(certPEM), []byte(keyPEM))
	if err != nil {
		return nil, appErrors.Wrap("docker.loadClientCertFailed", "erro ao carregar client cert/key", err)
	}

	roots := x509.NewCertPool()
	if ok := roots.AppendCertsFromPEM([]byte(caPEM)); !ok {
		return nil, appErrors.New("docker.invalidCa", "erro ao carregar CA: conteúdo inválido")
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      roots,
		MinVersion:   tls.VersionTLS12,
	}

	transport := &http.Transport{
		TLSClientConfig: tlsConfig,
	}

	return &http.Client{
		Transport: transport,
	}, nil
}
