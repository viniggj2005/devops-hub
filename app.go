package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"docker-manager-go/src/desktop"

	"github.com/blang/semver"
)

var AppVersion = "1.0.0"

const RepoSlug = "viniggj2005/devops-hub"
const UpdateAvailableEvent = "app:update-available"

type App struct {
	updateMutex     sync.Mutex
	pendingUpdate   *availableUpdate
	updateInstalled bool
}

func NewApp() *App {
	return &App{}
}

func (app *App) LoadImage(name string) (string, error) {
	execPath, _ := os.Getwd()
	imgPath := filepath.Join(execPath, "uploads", name)

	data, err := os.ReadFile(imgPath)
	if err != nil {
		return "", err
	}
	base64Str := "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
	return base64Str, nil
}

func (app *App) SaveImage(base64Str, path string) error {
	parts := strings.Split(base64Str, ",")
	data, err := base64.StdEncoding.DecodeString(parts[len(parts)-1])
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (app *App) GetFilePath(ctx context.Context) string {
	selection, err := desktop.ChooseFile(ctx, desktop.FileDialogOptions{
		Title: "Selecione um arquivo",
		Filters: []desktop.FileFilter{
			{
				DisplayName: "Dockerfiles (Dockerfile*)",
				Pattern:     "Dockerfile*",
			},
			{
				DisplayName: "Todos os arquivos (*.*)",
				Pattern:     "*.*",
			},
		},
	})

	if err != nil {
		return ""
	}
	return selection
}

func (app *App) AutoCheckForUpdates() {
	currentVersion, err := semver.ParseTolerant(AppVersion)
	if err != nil {
		return
	}
	latest, found, err := detectLatestRelease(RepoSlug)
	if err != nil || !found || latest.Version.LTE(currentVersion) {
		return
	}

	app.updateMutex.Lock()
	if app.updateInstalled {
		app.updateMutex.Unlock()
		return
	}
	app.pendingUpdate = latest
	app.updateMutex.Unlock()

	desktop.Broadcast(UpdateAvailableEvent, latest.Version.String())
}

func (app *App) GetAvailableUpdate() string {
	app.updateMutex.Lock()
	defer app.updateMutex.Unlock()
	if app.pendingUpdate == nil {
		return ""
	}
	return app.pendingUpdate.Version.String()
}

func (app *App) ApplyAvailableUpdate() error {
	app.updateMutex.Lock()
	defer app.updateMutex.Unlock()
	if app.pendingUpdate == nil {
		return errors.New("nenhuma atualização pendente")
	}
	if err := applyUpdate(app.pendingUpdate.AssetURL); err != nil {
		return fmt.Errorf("não foi possível atualizar: %w", err)
	}
	app.pendingUpdate = nil
	app.updateInstalled = true
	return nil
}

func (app *App) CheckForUpdates() (string, error) {
	app.updateMutex.Lock()
	installed := app.updateInstalled
	app.updateMutex.Unlock()
	if installed {
		return "Atualização já instalada. Reinicie o aplicativo para usar a nova versão.", nil
	}

	currentVersion, err := semver.ParseTolerant(AppVersion)
	if err != nil {
		return "", fmt.Errorf("versão do aplicativo inválida %q: %w", AppVersion, err)
	}

	latest, found, err := detectLatestRelease(RepoSlug)
	if err != nil {
		return "", err
	}

	if !found || latest.Version.LTE(currentVersion) {
		return "Você já está na versão mais recente.", nil
	}

	return "Nova versão disponível: " + latest.Version.String(), nil
}
