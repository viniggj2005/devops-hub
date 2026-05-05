package octohubHandler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/zalando/go-keyring"
)

type OctohubHandler struct {
	ctx          context.Context
	serverActive bool
}

type GitHubResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
}

func NewOctohubHandler() *OctohubHandler {
	return &OctohubHandler{}
}

func (handlerStruct *OctohubHandler) Startup(ctx context.Context) {
	handlerStruct.ctx = ctx
}

func (handlerStruct *OctohubHandler) StartLogin() {
	clientID := "Ov23liIA8eq127XEw2d7"
	url := fmt.Sprintf("https://github.com/login/oauth/authorize?client_id=%s&scope=repo", clientID)
	runtime.BrowserOpenURL(handlerStruct.ctx, url)

	if !handlerStruct.serverActive {
		go handlerStruct.listenCallback()
	}
}

func (handlerStruct *OctohubHandler) listenCallback() {
	handlerStruct.serverActive = true
	defer func() { handlerStruct.serverActive = false }()

	mux := http.NewServeMux()
	server := &http.Server{Addr: ":54321", Handler: mux}

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code != "" {
			token, err := handlerStruct.exchangeCodeForToken(code)
			if err != nil {
				fmt.Fprintf(w, "Erro ao obter token: %v", err)
				return
			}
			fmt.Printf("Token obtido com sucesso: %s\n", token[:5]+"...")
			os.WriteFile(".github-token", []byte(token), 0600)

			err = keyring.Set("meu-app-git", "github-token", token)
			if err != nil {
				fmt.Printf("Erro ao salvar no keyring: %v\n", err)
			} else {
				fmt.Printf("Token salvo no keyring com sucesso.\n")
			}

			fmt.Fprintf(w, "Login bem-sucedido! Pode fechar esta aba e voltar ao app.")

			runtime.EventsEmit(handlerStruct.ctx, "login-success", true)

			go server.Shutdown(context.Background())
		}
	})

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Printf("Erro no servidor de callback: %v\n", err)
	}
}

func (handlerStruct *OctohubHandler) exchangeCodeForToken(code string) (string, error) {
	clientID := "Ov23liIA8eq127XEw2d7"
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")

	jsonData := map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"code":          code,
	}
	body, _ := json.Marshal(jsonData)

	req, _ := http.NewRequest("POST", "https://github.com/login/oauth/access_token", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	json.NewDecoder(resp.Body).Decode(&res)

	if res.Error != "" {
		return "", fmt.Errorf("github error: %s - %s", res.Error, res.ErrorDesc)
	}

	return res.AccessToken, nil
}

func (handlerStruct *OctohubHandler) VerifyLogin() string {
	token, err := keyring.Get("meu-app-git", "github-token")
	if err != nil {
		data, err := os.ReadFile(".github-token")
		if err != nil {
			return ""
		}
		return string(data)
	}
	return token
}

func (handlerStruct *OctohubHandler) GetUserInfo() (map[string]interface{}, error) {
	token := handlerStruct.VerifyLogin()
	if token == "" {
		return nil, fmt.Errorf("não autenticado")
	}

	req, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("erro ao buscar usuário: status %d", resp.StatusCode)
	}

	var user map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&user)

	return user, nil
}
