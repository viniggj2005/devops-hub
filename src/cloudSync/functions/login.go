package cloudSyncFunctions

import (
	"context"
	"fmt"
	"html"
	"net"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/oauth2"

	"docker-manager-go/src/appErrors"
)

const loginResultPage = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Devops Hub</title></head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 15vh; background: #09090b; color: #fafafa">
<h2>%s</h2>
<p>Você já pode fechar esta aba e voltar ao Devops Hub.</p>
</body>
</html>`

type callbackResult struct {
	code string
	err  error
}

func Login(ctx context.Context, openBrowser func(address string) error) (*oauth2.Token, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, appErrors.Wrap("cloudSync.loginCallbackFailed", "não foi possível preparar o retorno do login", err)
	}

	config := oauthConfig(fmt.Sprintf("http://127.0.0.1:%d/", listener.Addr().(*net.TCPAddr).Port))
	verifier := oauth2.GenerateVerifier()
	expectedState := oauth2.GenerateVerifier()
	results := make(chan callbackResult, 1)

	server := &http.Server{
		ReadHeaderTimeout: 10 * time.Second,
		Handler: http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.URL.Path != "/" {
				http.NotFound(writer, request)
				return
			}
			result := parseCallback(request.URL.Query(), expectedState)
			message := "Conta do Google conectada"
			if result.err != nil {
				message = "Não foi possível conectar a conta do Google"
			}
			writer.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(writer, loginResultPage, html.EscapeString(message))
			select {
			case results <- result:
			default:
			}
		}),
	}
	go server.Serve(listener)
	defer server.Close()

	authURL := config.AuthCodeURL(
		expectedState,
		oauth2.AccessTypeOffline,
		oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("prompt", "consent"),
	)
	if err := openBrowser(authURL); err != nil {
		return nil, appErrors.Wrap("cloudSync.openBrowserFailed", "não foi possível abrir o navegador", err)
	}

	select {
	case <-ctx.Done():
		return nil, appErrors.New("cloudSync.loginCancelled", "o login do Google foi cancelado ou expirou")
	case result := <-results:
		if result.err != nil {
			return nil, result.err
		}
		token, err := config.Exchange(ctx, result.code, oauth2.VerifierOption(verifier))
		if err != nil {
			return nil, appErrors.Wrap("cloudSync.loginFailed", "não foi possível concluir o login do Google", err)
		}
		if token.RefreshToken == "" {
			return nil, appErrors.New("cloudSync.noRefreshToken", "o Google não liberou o acesso contínuo; tente conectar novamente")
		}
		return token, nil
	}
}

func parseCallback(query url.Values, expectedState string) callbackResult {
	switch {
	case query.Get("error") != "":
		return callbackResult{err: appErrors.New("cloudSync.loginRefused", "o Google recusou o login: {reason}").With("reason", query.Get("error"))}
	case query.Get("state") != expectedState:
		return callbackResult{err: appErrors.New("cloudSync.invalidLoginResponse", "resposta de login inválida")}
	case query.Get("code") == "":
		return callbackResult{err: appErrors.New("cloudSync.missingAuthorizationCode", "o Google não retornou o código de autorização")}
	}
	return callbackResult{code: query.Get("code")}
}
