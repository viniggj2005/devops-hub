package main

import (
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

type roundTripFunc func(request *http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func TestAppLoadAndSaveImage(test *testing.T) {
	appInstance := NewApp()
	appInstance.startup(context.Background())

	temporaryDir := test.TempDir()
	originalDirectory, err := os.Getwd()
	if err != nil {
		test.Fatalf("unexpected error getting cwd: %v", err)
	}
	defer os.Chdir(originalDirectory)

	if err := os.Chdir(temporaryDir); err != nil {
		test.Fatalf("unexpected error changing cwd: %v", err)
	}

	if _, err := appInstance.LoadImage("missing.png"); err == nil {
		test.Fatalf("expected error loading missing image")
	}

	uploadsDir := filepath.Join(temporaryDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		test.Fatalf("unexpected error creating uploads directory: %v", err)
	}

	rawBytes := []byte("fake-png-content")
	encoded := "data:image/png;base64," + base64.StdEncoding.EncodeToString(rawBytes)
	savedPath := filepath.Join(uploadsDir, "sample.png")

	if err := appInstance.SaveImage("invalid-base64,!!!", savedPath); err == nil {
		test.Fatalf("expected error saving invalid base64 image")
	}

	if err := appInstance.SaveImage(encoded, savedPath); err != nil {
		test.Fatalf("unexpected error saving image: %v", err)
	}

	loaded, err := appInstance.LoadImage("sample.png")
	if err != nil {
		test.Fatalf("unexpected error loading image: %v", err)
	}
	if loaded != encoded {
		test.Fatalf("expected %s, got %s", encoded, loaded)
	}
}

func TestUpdaterFunctionsAndCheckForUpdates(test *testing.T) {
	suffixes := assetSuffixes()
	if len(suffixes) == 0 {
		test.Fatalf("expected at least one asset suffix")
	}

	platformSuffix := runtime.GOOS + "_" + runtime.GOARCH
	assets := []releaseAsset{
		{Name: "devops-hub_other_arch", DownloadURL: "https://example.com/other"},
		{Name: "devops-hub_" + platformSuffix, DownloadURL: "https://example.com/match"},
	}

	matchedAsset, found := findPlatformAsset(assets)
	if !found || matchedAsset.DownloadURL != "https://example.com/match" {
		test.Fatalf("expected platform asset match, got %+v, found=%v", matchedAsset, found)
	}

	_, found = findPlatformAsset([]releaseAsset{{Name: "unrelated.zip"}})
	if found {
		test.Fatalf("expected no match for unrelated asset")
	}

	originalClient := httpClient
	defer func() {
		httpClient = originalClient
	}()

	httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			if strings.HasSuffix(request.URL.Path, "/notfound/releases/latest") {
				return &http.Response{
					StatusCode: http.StatusNotFound,
					Status:     "404 Not Found",
					Body:       io.NopCloser(strings.NewReader(`{}`)),
				}, nil
			}
			if strings.HasSuffix(request.URL.Path, "/servererror/releases/latest") {
				return &http.Response{
					StatusCode: http.StatusInternalServerError,
					Status:     "500 Internal Server Error",
					Body:       io.NopCloser(strings.NewReader(`{}`)),
				}, nil
			}
			body := `{"tag_name":"v9.9.9","assets":[{"name":"app_` + platformSuffix + `","browser_download_url":"https://example.com/bin"}]}`
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Body:       io.NopCloser(strings.NewReader(body)),
			}, nil
		}),
	}

	_, found, err := detectLatestRelease("owner/notfound")
	if err != nil || found {
		test.Fatalf("expected not found to return nil error and found=false, got found=%v, err=%v", found, err)
	}

	_, _, err = detectLatestRelease("owner/servererror")
	if err == nil {
		test.Fatalf("expected error on 500 response")
	}

	updateInfo, found, err := detectLatestRelease(RepoSlug)
	if err != nil || !found || updateInfo.Version.String() != "9.9.9" {
		test.Fatalf("unexpected release info: %+v, found=%v, err=%v", updateInfo, found, err)
	}

	appInstance := NewApp()
	message, err := appInstance.CheckForUpdates()
	if err != nil || !strings.Contains(message, "9.9.9") {
		test.Fatalf("unexpected CheckForUpdates message: %q, err=%v", message, err)
	}

	if pending := appInstance.GetAvailableUpdate(); pending != "" {
		test.Fatalf("expected no pending update before auto check, got %q", pending)
	}
	if err := appInstance.ApplyAvailableUpdate(); err == nil {
		test.Fatalf("expected error applying update without pending release")
	}
	appInstance.AutoCheckForUpdates()
	if pending := appInstance.GetAvailableUpdate(); pending != "9.9.9" {
		test.Fatalf("expected pending update 9.9.9, got %q", pending)
	}
}
