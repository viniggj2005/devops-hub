package talpadbFunctions

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	goOra "github.com/sijms/go-ora/v2"
)

const ApplicationName = "Devops Hub"

const (
	EngineOracle   = "oracle"
	EngineSqlite   = "sqlite"
	EnginePostgres = "postgres"
)

var allowedEngines = map[string]bool{
	EngineOracle:   true,
	EngineSqlite:   true,
	EnginePostgres: true,
}

var oracleSslModes = map[string]bool{
	"disable":     true,
	"require":     true,
	"verify-full": true,
}

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
	Engine   string
	SslMode  string
	Database string
	Username string
	Password string
}

func NormalizeEngine(engine string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(engine))
	if normalized == "" {
		return EnginePostgres, nil
	}
	if !allowedEngines[normalized] {
		return "", fmt.Errorf("banco não suportado: %s", engine)
	}
	return normalized, nil
}

func NormalizeOracleSslMode(sslMode string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(sslMode))
	if normalized == "" {
		return "disable", nil
	}
	if !oracleSslModes[normalized] {
		return "", fmt.Errorf("modo SSL inválido para Oracle: %s", sslMode)
	}
	return normalized, nil
}

func BuildOracleConnectionString(params ConnectionParams) string {
	options := map[string]string{"CONNECTION TIMEOUT": "20"}
	switch params.SslMode {
	case "require":
		options["SSL"] = "enable"
		options["SSL VERIFY"] = "false"
	case "verify-full":
		options["SSL"] = "enable"
		options["SSL VERIFY"] = "true"
	}
	return goOra.BuildUrl(params.Host, int(params.Port), params.Database, params.Username, params.Password, options)
}

func BuildSqliteConnectionString(params ConnectionParams) (string, error) {
	path := strings.TrimSpace(params.Host)
	if strings.Contains(path, "?") {
		return "", errors.New("o caminho do arquivo SQLite não pode conter '?'")
	}
	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("arquivo SQLite não encontrado: %s", path)
		}
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("o caminho informado é uma pasta, não um arquivo SQLite: %s", path)
	}
	return path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", nil
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
