package octohubHandler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/gorm"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	octohubDtos "docker-manager-go/src/octohub/dtos"
	"docker-manager-go/src/types"
)

const (
	githubClientID    = "Ov23liIA8eq127XEw2d7"
	LoginErrorEvent   = "octohub:login-error"
	LoginSuccessEvent = "octohub:login-success"
	githubScopes      = "repo read:user workflow"
	deviceGrantType   = "urn:ietf:params:oauth:grant-type:device_code"
)

type OctohubHandler struct {
	DataBase    *gorm.DB
	mutex       sync.Mutex
	ctx         context.Context
	cancelLogin context.CancelFunc
	Session     *auth.ManagerStruct
}

type githubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

type githubOAuthError struct {
	Error     string `json:"error"`
	ErrorDesc string `json:"error_description"`
}

func NewOctohubHandler(dataBase *gorm.DB, sessionManager *auth.ManagerStruct) *OctohubHandler {
	return &OctohubHandler{DataBase: dataBase, Session: sessionManager}
}

func (handlerStruct *OctohubHandler) Startup(ctx context.Context) {
	handlerStruct.ctx = ctx
}

func (handlerStruct *OctohubHandler) userID(token string) (uint, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return 0, err
	}
	return session.UserID, nil
}

func (handlerStruct *OctohubHandler) StartDeviceLogin(token string) (*octohubDtos.DeviceCodeDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}

	var response struct {
		githubOAuthError
		Interval        int    `json:"interval"`
		UserCode        string `json:"user_code"`
		ExpiresIn       int    `json:"expires_in"`
		DeviceCode      string `json:"device_code"`
		VerificationURI string `json:"verification_uri"`
	}
	err = postGithubForm("https://github.com/login/device/code", url.Values{
		"client_id": {githubClientID},
		"scope":     {githubScopes},
	}, &response)
	if err != nil {
		return nil, err
	}
	if response.Error == "device_flow_disabled" {
		return nil, fmt.Errorf("o Device Flow está desativado no OAuth App do GitHub, habilite 'Enable Device Flow' nas configurações do app")
	}
	if response.Error != "" {
		return nil, fmt.Errorf("github: %s - %s", response.Error, response.ErrorDesc)
	}

	handlerStruct.CancelDeviceLogin()
	loginCtx, cancel := context.WithTimeout(handlerStruct.ctx, time.Duration(response.ExpiresIn)*time.Second)
	handlerStruct.mutex.Lock()
	handlerStruct.cancelLogin = cancel
	handlerStruct.mutex.Unlock()

	go handlerStruct.pollDeviceToken(loginCtx, userID, response.DeviceCode, response.Interval)

	return &octohubDtos.DeviceCodeDto{
		UserCode:        response.UserCode,
		VerificationUri: response.VerificationURI,
		ExpiresIn:       response.ExpiresIn,
	}, nil
}

func (handlerStruct *OctohubHandler) CancelDeviceLogin() {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()
	if handlerStruct.cancelLogin != nil {
		handlerStruct.cancelLogin()
		handlerStruct.cancelLogin = nil
	}
}

func (handlerStruct *OctohubHandler) pollDeviceToken(ctx context.Context, userID uint, deviceCode string, intervalSeconds int) {
	interval := time.Duration(max(intervalSeconds, 5)) * time.Second

	for {
		select {
		case <-ctx.Done():
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				runtime.EventsEmit(handlerStruct.ctx, LoginErrorEvent, "o código expirou, tente conectar novamente")
			}
			return
		case <-time.After(interval):
		}

		var response struct {
			githubOAuthError
			AccessToken string `json:"access_token"`
			Scope       string `json:"scope"`
			Interval    int    `json:"interval"`
		}
		err := postGithubForm("https://github.com/login/oauth/access_token", url.Values{
			"client_id":   {githubClientID},
			"device_code": {deviceCode},
			"grant_type":  {deviceGrantType},
		}, &response)
		if err != nil {
			continue
		}

		switch response.Error {
		case "":
			account, err := handlerStruct.saveAccount(userID, response.AccessToken, response.Scope)
			if err != nil {
				runtime.EventsEmit(handlerStruct.ctx, LoginErrorEvent, err.Error())
			} else {
				runtime.EventsEmit(handlerStruct.ctx, LoginSuccessEvent, account)
			}
			handlerStruct.CancelDeviceLogin()
			return
		case "authorization_pending":
		case "slow_down":
			interval = time.Duration(max(response.Interval, int(interval.Seconds())+5)) * time.Second
		case "access_denied":
			runtime.EventsEmit(handlerStruct.ctx, LoginErrorEvent, "autorização negada no GitHub")
			return
		default:
			runtime.EventsEmit(handlerStruct.ctx, LoginErrorEvent, fmt.Sprintf("github: %s - %s", response.Error, response.ErrorDesc))
			return
		}
	}
}

func (handlerStruct *OctohubHandler) saveAccount(userID uint, accessToken, scope string) (*octohubDtos.GithubAccountDto, error) {
	user, err := fetchGithubUser(accessToken)
	if err != nil {
		return nil, err
	}
	return handlerStruct.upsertAccount(userID, user, accessToken, scope)
}

func (handlerStruct *OctohubHandler) upsertAccount(userID uint, user *githubUser, accessToken, scope string) (*octohubDtos.GithubAccountDto, error) {
	var account models.GithubAccountModel
	err := handlerStruct.DataBase.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.GithubAccountModel{}).Where("user_id = ?", userID).Update("is_active", false).Error; err != nil {
			return err
		}

		if err := tx.Where("user_id = ? AND github_id = ?", userID, user.ID).Limit(1).Find(&account).Error; err != nil {
			return err
		}

		account.Scope = scope
		account.UserID = userID
		account.IsActive = true
		account.Name = user.Name
		account.GithubID = user.ID
		account.Login = user.Login
		account.AvatarURL = user.AvatarURL
		account.Token = types.EncryptedString{Plaintext: accessToken}
		return tx.Save(&account).Error
	})
	if err != nil {
		return nil, fmt.Errorf("erro ao salvar conta do GitHub: %w", err)
	}

	return octohubDtos.ToGithubAccountDto(&account), nil
}

func (handlerStruct *OctohubHandler) ListAccounts(token string) ([]octohubDtos.GithubAccountDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}

	var accounts []models.GithubAccountModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.ctx).
		Where("user_id = ?", userID).
		Order("login").
		Find(&accounts).Error; err != nil {
		return nil, err
	}

	return octohubDtos.ToGithubAccountDtoList(accounts), nil
}

func (handlerStruct *OctohubHandler) GetActiveAccount(token string) (*octohubDtos.GithubAccountDto, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}

	account, err := handlerStruct.activeAccount(userID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return octohubDtos.ToGithubAccountDto(account), nil
}

func (handlerStruct *OctohubHandler) SwitchAccount(token string, accountID uint) error {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return err
	}

	return handlerStruct.DataBase.Transaction(func(tx *gorm.DB) error {
		var account models.GithubAccountModel
		if err := tx.Where("id = ? AND user_id = ?", accountID, userID).First(&account).Error; err != nil {
			return fmt.Errorf("conta não encontrada: %w", err)
		}
		if err := tx.Model(&models.GithubAccountModel{}).Where("user_id = ?", userID).Update("is_active", false).Error; err != nil {
			return err
		}
		return tx.Model(&account).Update("is_active", true).Error
	})
}

func (handlerStruct *OctohubHandler) RemoveAccount(token string, accountID uint) error {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return err
	}

	return handlerStruct.DataBase.Transaction(func(tx *gorm.DB) error {
		var account models.GithubAccountModel
		if err := tx.Where("id = ? AND user_id = ?", accountID, userID).First(&account).Error; err != nil {
			return fmt.Errorf("conta não encontrada: %w", err)
		}
		if err := tx.Unscoped().Delete(&account).Error; err != nil {
			return err
		}
		if !account.IsActive {
			return nil
		}

		var next models.GithubAccountModel
		err := tx.Where("user_id = ?", userID).Order("login").First(&next).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return tx.Model(&next).Update("is_active", true).Error
	})
}

func (handlerStruct *OctohubHandler) GetUserInfo(token string) (map[string]interface{}, error) {
	userID, err := handlerStruct.userID(token)
	if err != nil {
		return nil, err
	}

	account, err := handlerStruct.activeAccount(userID)
	if err != nil {
		return nil, fmt.Errorf("nenhuma conta do GitHub conectada")
	}

	var user map[string]interface{}
	if err := getGithubAPI("https://api.github.com/user", account.Token.Plaintext, &user); err != nil {
		return nil, err
	}
	return user, nil
}

func (handlerStruct *OctohubHandler) activeAccount(userID uint) (*models.GithubAccountModel, error) {
	var account models.GithubAccountModel
	if err := handlerStruct.DataBase.WithContext(handlerStruct.ctx).
		Where("user_id = ? AND is_active = ?", userID, true).
		First(&account).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

func fetchGithubUser(accessToken string) (*githubUser, error) {
	var user githubUser
	if err := getGithubAPI("https://api.github.com/user", accessToken, &user); err != nil {
		return nil, err
	}
	return &user, nil
}

func postGithubForm(endpoint string, values url.Values, out any) error {
	request, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Accept", "application/json")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	return json.NewDecoder(response.Body).Decode(out)
}

func getGithubAPI(endpoint, accessToken string, out any) error {
	request, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Accept", "application/vnd.github+json")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("token do GitHub inválido ou revogado, reconecte a conta")
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("erro ao consultar o GitHub: status %d", response.StatusCode)
	}

	return json.NewDecoder(response.Body).Decode(out)
}
