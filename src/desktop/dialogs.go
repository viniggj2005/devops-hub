package desktop

import (
	"context"
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const dialogCancelledMessage = "cancelled by user"

var errDialogUnavailable = errors.New("diálogos nativos indisponíveis fora da aplicação")

type FileFilter = application.FileFilter

type FileDialogOptions struct {
	Title           string
	Directory       string
	DefaultFilename string
	Filters         []FileFilter
}

func ChooseFile(ctx context.Context, options FileDialogOptions) (string, error) {
	return promptOpenDialog(ctx, options, false)
}

func ChooseDirectory(ctx context.Context, options FileDialogOptions) (string, error) {
	return promptOpenDialog(ctx, options, true)
}

func ChooseSaveLocation(ctx context.Context, options FileDialogOptions) (string, error) {
	app := application.Get()
	if app == nil {
		return "", errDialogUnavailable
	}

	dialog := app.Dialog.SaveFileWithOptions(&application.SaveFileDialogOptions{
		Title:                options.Title,
		Window:               CallingWindow(ctx),
		Filters:              options.Filters,
		Filename:             options.DefaultFilename,
		Directory:            options.Directory,
		CanCreateDirectories: true,
	})
	return ignoreCancellation(dialog.PromptForSingleSelection())
}

func promptOpenDialog(ctx context.Context, options FileDialogOptions, chooseDirectory bool) (string, error) {
	app := application.Get()
	if app == nil {
		return "", errDialogUnavailable
	}

	dialog := app.Dialog.OpenFileWithOptions(&application.OpenFileDialogOptions{
		Title:                options.Title,
		Window:               CallingWindow(ctx),
		Filters:              options.Filters,
		Directory:            options.Directory,
		CanChooseFiles:       !chooseDirectory,
		CanChooseDirectories: chooseDirectory,
		CanCreateDirectories: chooseDirectory,
	})
	return ignoreCancellation(dialog.PromptForSingleSelection())
}

func ignoreCancellation(path string, err error) (string, error) {
	if err != nil && err.Error() == dialogCancelledMessage {
		return "", nil
	}
	return path, err
}
