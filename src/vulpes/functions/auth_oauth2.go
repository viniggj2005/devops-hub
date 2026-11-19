package vulpesFunctions

import (
	"io"
	"time"
	"context"
	"strconv"
	"strings"
	"net/url"
	"net/http"
	"encoding/json"
	"docker-manager-go/src/appErrors"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const maxTokenResponseBytes = 1 << 20

type OAuth2Token struct {
	ExpiresIn   time.Duration
	AccessToken string
}

func OAuth2CacheKey(auth vulpesDtos.AuthDto) string {
	return strings.Join([]string{
		auth.Scope,
		auth.TokenUrl,
		auth.ClientId,
		auth.Username,
		auth.Password,
		auth.GrantType,
		auth.ClientAuth,
		auth.ClientSecret,
	}, "\x00")
}

func RequestOAuth2Token(ctx context.Context, client *http.Client, auth vulpesDtos.AuthDto) (OAuth2Token, error) {
	if strings.TrimSpace(auth.TokenUrl) == "" {
		return OAuth2Token{}, appErrors.New("vulpes.oauth2TokenUrlRequired", "informe a URL do token OAuth 2.0")
	}
	tokenUrl, err := NormalizeUrl(auth.TokenUrl, "https")
	if err != nil {
		return OAuth2Token{}, err
	}

	form := url.Values{}
	form.Set("grant_type", auth.GrantType)
	if scope := strings.TrimSpace(auth.Scope); scope != "" {
		form.Set("scope", scope)
	}
	if auth.GrantType == vulpesDtos.GrantPassword {
		form.Set("username", auth.Username)
		form.Set("password", auth.Password)
	}
	clientId := strings.TrimSpace(auth.ClientId)
	if auth.ClientAuth == vulpesDtos.ClientAuthBody && clientId != "" {
		form.Set("client_id", clientId)
		if auth.ClientSecret != "" {
			form.Set("client_secret", auth.ClientSecret)
		}
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenUrl, strings.NewReader(form.Encode()))
	if err != nil {
		return OAuth2Token{}, appErrors.Wrap("vulpes.oauth2TokenFailed", "não foi possível obter o token OAuth 2.0", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", DefaultUserAgent)
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if auth.ClientAuth != vulpesDtos.ClientAuthBody && clientId != "" {
		request.SetBasicAuth(clientId, auth.ClientSecret)
	}

	response, err := client.Do(request)
	if err != nil {
		return OAuth2Token{}, appErrors.Wrap("vulpes.oauth2TokenFailed", "não foi possível obter o token OAuth 2.0", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxTokenResponseBytes))
	if err != nil {
		return OAuth2Token{}, appErrors.Wrap("vulpes.oauth2TokenFailed", "não foi possível obter o token OAuth 2.0", err)
	}

	fields := parseTokenResponse(body)
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return OAuth2Token{}, appErrors.New("vulpes.oauth2TokenRejected", "o servidor de autorização respondeu {status}: {detail}").
			With("status", response.Status).
			With("detail", tokenErrorDetail(fields, body))
	}
	accessToken := fields["access_token"]
	if accessToken == "" {
		return OAuth2Token{}, appErrors.New("vulpes.oauth2TokenMissing", "a resposta do servidor de autorização não trouxe access_token: {detail}").
			With("detail", tokenErrorDetail(fields, body))
	}

	token := OAuth2Token{AccessToken: accessToken}
	if seconds, err := strconv.Atoi(fields["expires_in"]); err == nil && seconds > 0 {
		token.ExpiresIn = time.Duration(seconds) * time.Second
	}
	return token, nil
}

func parseTokenResponse(body []byte) map[string]string {
	fields := map[string]string{}
	var decoded map[string]any
	if json.Unmarshal(body, &decoded) == nil {
		for key, value := range decoded {
			switch typed := value.(type) {
			case string:
				fields[key] = typed
			case float64:
				fields[key] = strconv.FormatFloat(typed, 'f', -1, 64)
			}
		}
		return fields
	}
	if values, err := url.ParseQuery(string(body)); err == nil {
		for key := range values {
			fields[key] = values.Get(key)
		}
	}
	return fields
}

func tokenErrorDetail(fields map[string]string, body []byte) string {
	if description := fields["error_description"]; description != "" {
		return description
	}
	if code := fields["error"]; code != "" {
		return code
	}
	detail := strings.TrimSpace(string(body))
	if len(detail) > 300 {
		detail = detail[:300] + "…"
	}
	if detail == "" {
		return "-"
	}
	return detail
}
