package main

import (
	"context"
	database "docker-manager-go/src/dataBase"
	dockerHandlers "docker-manager-go/src/dockermanager/handlers"
	ferretShellHandlers "docker-manager-go/src/ferretshell/handlers"

	auth "docker-manager-go/src/auth/functions"
	authHandlers "docker-manager-go/src/auth/handlers"
	userHandlers "docker-manager-go/src/user/handlers"
	"embed"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {

	database.InitDb()
	app := NewApp()
	sessionManager := auth.NewManager(8 * time.Hour)
	docker := dockerHandlers.NewDockerHandler(database.DataBase, sessionManager)
	dockerSdk := dockerHandlers.NewDockerSdkHandler(docker)
	docker.RegisterDockerSdkHandler(dockerSdk)
	terminal := ferretShellHandlers.NewTerminalHandler(sessionManager)
	sftpHandler := ferretShellHandlers.NewSftpHandler(terminal)
	sshHandler := ferretShellHandlers.NewSshHandler(database.DataBase, sessionManager)
	authHandler := authHandlers.NewAuthHandler(database.DataBase, sessionManager, app)
	userHandler := userHandlers.NewUserHandler(database.DataBase, sessionManager)
	localFileHandler := ferretShellHandlers.NewLocalFileHandler()

	err := wails.Run(&options.App{
		Title:            "Docker Manager",
		Width:            1024,
		Height:           768,
		Fullscreen:       false,
		WindowStartState: options.Maximised,
		Frameless:        true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			docker.Startup(ctx)
			terminal.Startup(ctx)
			sftpHandler.Startup(ctx)
			dockerSdk.Startup(ctx)
			sshHandler.Startup(ctx)
			authHandler.Startup(ctx)
			userHandler.Startup(ctx)
			localFileHandler.Startup(ctx)

		},
		Windows: &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			BackdropType:         windows.Mica,
		},
		Bind: []interface{}{
			app,
			terminal,
			docker,
			dockerSdk,
			sshHandler,
			sftpHandler,
			authHandler,
			userHandler,
			localFileHandler,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
