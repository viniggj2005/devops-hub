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

	"github.com/blang/semver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "1.0.0"
const RepoSlug = "viniggj2005/devops-hub"
const UpdateAvailableEvent = "app:update-available"

type App struct {
	ctx           context.Context
	updateMutex   sync.Mutex
	pendingUpdate *availableUpdate
}

func NewApp() *App {
	return &App{}
}

func (app *App) startup(ctx context.Context) {
	app.ctx = ctx
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

func (app *App) GetFilePath() string {
	selection, err := runtime.OpenFileDialog(app.ctx, runtime.OpenDialogOptions{
		Title: "Selecione um arquivo",
		Filters: []runtime.FileFilter{
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
	currentVersion := semver.MustParse(AppVersion)
	latest, found, err := detectLatestRelease(RepoSlug)
	if err != nil || !found || latest.Version.LTE(currentVersion) {
		return
	}

	app.updateMutex.Lock()
	app.pendingUpdate = latest
	app.updateMutex.Unlock()

	if app.ctx != nil {
		runtime.EventsEmit(app.ctx, UpdateAvailableEvent, latest.Version.String())
	}
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
	return nil
}

func (app *App) CheckForUpdates() (string, error) {
	currentVersion := semver.MustParse(AppVersion)

	latest, found, err := detectLatestRelease(RepoSlug)
	if err != nil {
		return "", err
	}

	if !found || latest.Version.LTE(currentVersion) {
		return "Você já está na versão mais recente.", nil
	}

	return "Nova versão disponível: " + latest.Version.String(), nil
}
