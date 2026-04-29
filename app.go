package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/blang/semver"
	"github.com/rhysd/go-github-selfupdate/selfupdate"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "1.0.1"
const RepoSlug = "viniggj2005/devops-hub"

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) LoadImage(name string) (string, error) {
	execPath, _ := os.Getwd()
	imgPath := filepath.Join(execPath, "uploads", name)

	data, err := os.ReadFile(imgPath)
	if err != nil {
		return "", err
	}
	base64Str := "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
	return base64Str, nil
}

func (a *App) SaveImage(base64Str, path string) error {
	parts := strings.Split(base64Str, ",")
	data, err := base64.StdEncoding.DecodeString(parts[len(parts)-1])
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (a *App) GetFilePath() string {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
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

func (a *App) AutoCheckForUpdates() {
	v := semver.MustParse(AppVersion)
	latest, found, err := selfupdate.DetectLatest(RepoSlug)
	if err != nil {
		return
	}

	if !found || latest.Version.LTE(v) {
		return
	}

	res, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Atualização disponível",
		Message:       "Uma nova versão (" + latest.Version.String() + ") está disponível. Deseja atualizar agora?",
		DefaultButton: "Yes",
	})

	if err != nil || res != "Yes" {
		return
	}

	if err := selfupdate.UpdateTo(latest.AssetURL, os.Args[0]); err != nil {
		runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Erro na atualização",
			Message: "Não foi possível atualizar: " + err.Error(),
		})
		return
	}

	runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.InfoDialog,
		Title:   "Atualização concluída",
		Message: "O aplicativo foi atualizado com sucesso. Por favor, reinicie o aplicativo.",
	})
}

func (a *App) CheckForUpdates() (string, error) {
	v := semver.MustParse(AppVersion)

	latest, found, err := selfupdate.DetectLatest(RepoSlug)
	if err != nil {
		return "", err
	}

	if !found || latest.Version.LTE(v) {
		return "Você já está na versão mais recente.", nil
	}

	return "Nova versão disponível: " + latest.Version.String(), nil
}
