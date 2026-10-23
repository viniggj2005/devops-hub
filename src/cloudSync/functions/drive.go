package cloudSyncFunctions

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"golang.org/x/oauth2"
)

const (
	backupFileName   = "devops-hub.db"
	sha256Property   = "sha256"
	syncedAtProperty = "syncedAt"
)

var (
	driveAboutURL  = "https://www.googleapis.com/drive/v3/about"
	driveFilesURL  = "https://www.googleapis.com/drive/v3/files"
	tokenRevokeURL = "https://oauth2.googleapis.com/revoke"
	driveUploadURL = "https://www.googleapis.com/upload/drive/v3/files"
)

type RemoteBackup struct {
	ID       string
	Hash     string
	SyncedAt time.Time
}

type driveFile struct {
	ID            string            `json:"id"`
	AppProperties map[string]string `json:"appProperties"`
}

func driveHTTPClient(ctx context.Context, token *oauth2.Token) *http.Client {
	return oauthConfig("").Client(ctx, token)
}

func FindRemoteBackup(ctx context.Context, token *oauth2.Token) (*RemoteBackup, error) {
	query := url.Values{}
	query.Set("pageSize", "1")
	query.Set("spaces", "appDataFolder")
	query.Set("orderBy", "modifiedTime desc")
	query.Set("fields", "files(id,appProperties)")
	query.Set("q", fmt.Sprintf("name = '%s' and trashed = false", backupFileName))

	var listing struct {
		Files []driveFile `json:"files"`
	}
	if err := getJSON(ctx, driveHTTPClient(ctx, token), driveFilesURL+"?"+query.Encode(), &listing); err != nil {
		return nil, err
	}
	if len(listing.Files) == 0 {
		return nil, nil
	}

	file := listing.Files[0]
	syncedAt, _ := time.Parse(time.RFC3339Nano, file.AppProperties[syncedAtProperty])
	return &RemoteBackup{ID: file.ID, Hash: file.AppProperties[sha256Property], SyncedAt: syncedAt}, nil
}

func AccountEmail(ctx context.Context, token *oauth2.Token) (string, error) {
	var about struct {
		User struct {
			EmailAddress string `json:"emailAddress"`
		} `json:"user"`
	}
	err := getJSON(ctx, driveHTTPClient(ctx, token), driveAboutURL+"?fields=user(emailAddress)", &about)
	return about.User.EmailAddress, err
}

func RevokeToken(ctx context.Context, token *oauth2.Token) error {
	value := token.RefreshToken
	if value == "" {
		value = token.AccessToken
	}
	form := url.Values{"token": {value}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenRevokeURL, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	return checkResponse(response)
}

func downloadBackup(ctx context.Context, client *http.Client, fileID string, destination string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, driveFilesURL+"/"+url.PathEscape(fileID)+"?alt=media", nil)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if err := checkResponse(response); err != nil {
		return err
	}

	file, err := os.OpenFile(destination, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(file, response.Body)
	return errors.Join(copyErr, file.Close())
}

func uploadBackup(ctx context.Context, client *http.Client, existingID string, sourcePath string, properties map[string]string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()
	info, err := source.Stat()
	if err != nil {
		return err
	}

	sessionURL, err := startResumableUpload(ctx, client, existingID, info.Size(), properties)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPut, sessionURL, source)
	if err != nil {
		return err
	}
	request.ContentLength = info.Size()
	request.Header.Set("Content-Type", "application/octet-stream")
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	return checkResponse(response)
}

func startResumableUpload(ctx context.Context, client *http.Client, existingID string, size int64, properties map[string]string) (string, error) {
	metadata := map[string]any{"appProperties": properties}
	method, address := http.MethodPatch, driveUploadURL+"/"+url.PathEscape(existingID)+"?uploadType=resumable"
	if existingID == "" {
		metadata["name"] = backupFileName
		metadata["parents"] = []string{"appDataFolder"}
		method, address = http.MethodPost, driveUploadURL+"?uploadType=resumable"
	}

	body, err := json.Marshal(metadata)
	if err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, method, address, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json; charset=UTF-8")
	request.Header.Set("X-Upload-Content-Type", "application/octet-stream")
	request.Header.Set("X-Upload-Content-Length", strconv.FormatInt(size, 10))

	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if err := checkResponse(response); err != nil {
		return "", err
	}
	sessionURL := response.Header.Get("Location")
	if sessionURL == "" {
		return "", errors.New("o Google Drive não iniciou o envio do arquivo")
	}
	return sessionURL, nil
}

func getJSON(ctx context.Context, client *http.Client, address string, target any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if err := checkResponse(response); err != nil {
		return err
	}
	return json.NewDecoder(response.Body).Decode(target)
}

func checkResponse(response *http.Response) error {
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}
	detail, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
	return fmt.Errorf("o Google respondeu %s: %s", response.Status, strings.TrimSpace(string(detail)))
}
