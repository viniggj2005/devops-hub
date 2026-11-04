package talpadbFunctions

import (
	"os"
	"fmt"
	"net"
	"time"
	"errors"
	"net/url"
	"strconv"
	"strings"

	goOra "github.com/sijms/go-ora/v2"
	"github.com/go-sql-driver/mysql"
)

const ApplicationName = "Devops Hub"

const (
	EngineMysql    = "mysql"
	EngineOracle   = "oracle"
	EngineSqlite   = "sqlite"
	EnginePostgres = "postgres"
)

var allowedEngines = map[string]bool{
	EngineMysql:    true,
	EngineOracle:   true,
	EngineSqlite:   true,
	EnginePostgres: true,
}

var mysqlSslModes = map[string]bool{
	"prefer":      true,
	"disable":     true,
	"require":     true,
	"verify-full": true,
}

var oracleSslModes = map[string]bool{
	"disable":     true,
	"require":     true,
	"verify-full": true,
}

var allowedSslModes = map[string]bool{
	"allow":       true,
	"prefer":      true,
	"disable":     true,
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

func NormalizeMysqlSslMode(sslMode string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(sslMode))
	if normalized == "" {
		return "prefer", nil
	}
	if !mysqlSslModes[normalized] {
		return "", fmt.Errorf("modo SSL inválido para MySQL: %s", sslMode)
	}
	return normalized, nil
}

func BuildMysqlConnectionString(params ConnectionParams) string {
	config := mysql.NewConfig()
	config.Net = "tcp"
	config.User = params.Username
	config.Passwd = params.Password
	config.DBName = params.Database
	config.Timeout = 20 * time.Second
	config.AllowNativePasswords = true
	config.Addr = net.JoinHostPort(params.Host, strconv.FormatInt(params.Port, 10))
	switch params.SslMode {
	case "disable":
		config.TLSConfig = "false"
	case "prefer":
		config.TLSConfig = "preferred"
	case "require":
		config.TLSConfig = "skip-verify"
	case "verify-full":
		config.TLSConfig = "true"
	}
	return config.FormatDSN()
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
