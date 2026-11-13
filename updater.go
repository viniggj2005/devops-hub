package main

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/inconshreveable/go-update"

	"docker-manager-go/src/appErrors"
)

type releaseAsset struct {
	Name        string `json:"name"`
	DownloadURL string `json:"browser_download_url"`
}

type githubRelease struct {
	TagName string         `json:"tag_name"`
	Assets  []releaseAsset `json:"assets"`
}

type availableUpdate struct {
	Version  semver.Version
	AssetURL string
}

var httpClient = &http.Client{Timeout: 2 * time.Minute}

func githubRequest(url string) (*http.Response, error) {
	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	return httpClient.Do(request)
}

func assetSuffixes() []string {
	platform := runtime.GOOS + "_" + runtime.GOARCH
	if runtime.GOOS == "windows" {
		return []string{platform + ".exe", platform}
	}
	return []string{platform + assetVariantSuffix}
}

func findPlatformAsset(assets []releaseAsset) (releaseAsset, bool) {
	for _, suffix := range assetSuffixes() {
		for _, asset := range assets {
			if strings.HasSuffix(asset.Name, suffix) {
				return asset, true
			}
		}
	}
	return releaseAsset{}, false
}

func detectLatestRelease(repositorySlug string) (*availableUpdate, bool, error) {
	response, err := githubRequest("https://api.github.com/repos/" + repositorySlug + "/releases/latest")
	if err != nil {
		return nil, false, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return nil, false, nil
	}
	if response.StatusCode != http.StatusOK {
		return nil, false, appErrors.New("update.githubResponded", "GitHub respondeu {status} ao buscar a última versão").With("status", response.Status)
	}

	var release githubRelease
	if err := json.NewDecoder(response.Body).Decode(&release); err != nil {
		return nil, false, err
	}
	version, err := semver.ParseTolerant(release.TagName)
	if err != nil {
		return nil, false, nil
	}
	asset, found := findPlatformAsset(release.Assets)
	if !found {
		return nil, false, nil
	}
	return &availableUpdate{Version: version, AssetURL: asset.DownloadURL}, true, nil
}

func applyUpdate(assetURL string) error {
	response, err := githubRequest(assetURL)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return appErrors.New("update.downloadFailed", "falha ao baixar a nova versão: {status}").With("status", response.Status)
	}

	updateErr := update.Apply(response.Body, update.Options{})
	if !errors.Is(updateErr, fs.ErrPermission) {
		return updateErr
	}
	executable, _ := os.Executable()
	return appErrors.Wrap("update.permissionDenied", "sem permissão para substituir o executável em {folder}; mova o devops-hub para uma pasta do seu usuário ou execute-o como administrador", updateErr).With("folder", filepath.Dir(executable))
}
