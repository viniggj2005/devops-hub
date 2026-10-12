package postgresFunctions

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
)

const ApplicationName = "Devops Hub"

var allowedSslModes = map[string]bool{
	"disable":     true,
	"allow":       true,
	"prefer":      true,
	"require":     true,
	"verify-ca":   true,
	"verify-full": true,
}

type ConnectionParams struct {
	Host     string
	Port     int64
	Database string
	Username string
	Password string
	SslMode  string
}

func NormalizeSslMode(sslMode string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(sslMode))
	if normalized == "" {
		return "prefer", nil
	}
	if !allowedSslModes[normalized] {
		return "", fmt.Errorf("modo SSL inválido: %s", sslMode)
	}
	return normalized, nil
}

// BuildConnectionString monta a URL de conexão escapando usuário, senha e banco,
// evitando quebras quando esses valores possuem caracteres especiais.
func BuildConnectionString(params ConnectionParams) string {
	userInfo := url.User(params.Username)
	if params.Password != "" {
		userInfo = url.UserPassword(params.Username, params.Password)
	}

	query := url.Values{}
	query.Set("sslmode", params.SslMode)
	query.Set("connect_timeout", "10")
	query.Set("application_name", ApplicationName)

	connectionUrl := url.URL{
		Scheme:   "postgres",
		User:     userInfo,
		Host:     net.JoinHostPort(params.Host, strconv.FormatInt(params.Port, 10)),
		Path:     "/" + params.Database,
		RawQuery: query.Encode(),
	}
	return connectionUrl.String()
}
