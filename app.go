package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/blang/semver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "1.0.0"
const RepoSlug = "viniggj2005/devops-hub"

type App struct {
	ctx context.Context
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
	if err != nil {
		return
	}

	if !found || latest.Version.LTE(currentVersion) {
		return
	}

	res, err := runtime.MessageDialog(app.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Atualização disponível",
		Message:       "Uma nova versão (" + latest.Version.String() + ") está disponível. Deseja atualizar agora?",
		DefaultButton: "Yes",
	})

	if err != nil || res != "Yes" {
		return
	}

	if err := applyUpdate(latest.AssetURL); err != nil {
		runtime.MessageDialog(app.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Erro na atualização",
			Message: "Não foi possível atualizar: " + err.Error(),
		})
		return
	}

	runtime.MessageDialog(app.ctx, runtime.MessageDialogOptions{
		Type:    runtime.InfoDialog,
		Title:   "Atualização concluída",
		Message: "O aplicativo foi atualizado com sucesso. Por favor, reinicie o aplicativo.",
	})
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
