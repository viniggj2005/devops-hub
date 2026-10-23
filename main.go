package main

import (
	"embed"
	"log"
	"os"
	"time"

	auth "docker-manager-go/src/auth/functions"
	authHandlers "docker-manager-go/src/auth/handlers"
	cloudSyncFunctions "docker-manager-go/src/cloudSync/functions"
	cloudSyncHandlers "docker-manager-go/src/cloudSync/handlers"
	database "docker-manager-go/src/dataBase"
	"docker-manager-go/src/desktop"
	desktopHandlers "docker-manager-go/src/desktop/handlers"
	dockerHandlers "docker-manager-go/src/dockermanager/handlers"
	ferretShellHandlers "docker-manager-go/src/ferretshell/handlers"
	generalConfigsHandlers "docker-manager-go/src/generalConfigs/handlers"
	octohub "docker-manager-go/src/octohub/handlers"
	talpadbHandlers "docker-manager-go/src/talpadb/handlers"
	userHandlers "docker-manager-go/src/user/handlers"
	vulpesHandlers "docker-manager-go/src/vulpes/handlers"

	"github.com/joho/godotenv"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	godotenv.Load()
	app := NewApp()
	dataBasePath := database.DataBasePath()
	if restored, err := cloudSyncFunctions.RestoreBeforeOpen(dataBasePath); err != nil {
		log.Println("não foi possível buscar o backup do Google Drive:", err)
	} else if restored {
		log.Println("banco restaurado a partir do Google Drive")
	}
	database.InitDb()
	repositoryPath := os.Getenv("REPOSITORY")
	sessionManager := auth.NewManager(8 * time.Hour)
	localFileHandler := ferretShellHandlers.NewLocalFileHandler()
	terminal := ferretShellHandlers.NewTerminalHandler(sessionManager)
	localTerminal := ferretShellHandlers.NewLocalTerminalHandler()
	docker := dockerHandlers.NewDockerHandler(database.DataBase, sessionManager)
	dockerSdk := dockerHandlers.NewDockerSdkHandler(docker)
	sftpHandler := ferretShellHandlers.NewSftpHandler(terminal)
	windowHandler := desktopHandlers.NewWindowHandler(sessionManager)
	userHandler := userHandlers.NewUserHandler(database.DataBase, sessionManager)
	octohubHandler := octohub.NewOctohubHandler(database.DataBase, sessionManager)
	sshHandler := ferretShellHandlers.NewSshHandler(database.DataBase, sessionManager)
	authHandler := authHandlers.NewAuthHandler(database.DataBase, sessionManager, app)
	generalConfigsHandler := generalConfigsHandlers.NewGeneralConfigsHandler(database.DataBase, sessionManager)
	talpadbHandler := talpadbHandlers.NewTalpadbHandler(database.DataBase, sessionManager)
	talpadbClient := talpadbHandlers.NewTalpadbClientHandler(talpadbHandler)
	vulpesHandler := vulpesHandlers.NewVulpesHandler(database.DataBase, sessionManager)
	vulpesClient := vulpesHandlers.NewVulpesClientHandler(vulpesHandler)
	cloudSyncHandler := cloudSyncHandlers.NewCloudSyncHandler(database.DataBase, sessionManager, dataBasePath)

	gitHandler := octohub.NewGitHandler(repositoryPath)
	branchHandler := octohub.NewGitBranchHandler(gitHandler)
	commitHandler := octohub.NewGitCommitsHandler(gitHandler)
	repositoryHandler := octohub.NewRepositoryHandler(database.DataBase, sessionManager, gitHandler)

	desktopApplication := application.New(application.Options{
		Name:        "Devops Hub",
		Description: "Devops Hub Application",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Services: []application.Service{
			application.NewService(app),
			application.NewService(docker),
			application.NewService(terminal),
			application.NewService(dockerSdk),
			application.NewService(gitHandler),
			application.NewService(sshHandler),
			application.NewService(sftpHandler),
			application.NewService(authHandler),
			application.NewService(userHandler),
			application.NewService(localTerminal),
			application.NewService(branchHandler),
			application.NewService(commitHandler),
			application.NewService(talpadbClient),
			application.NewService(vulpesClient),
			application.NewService(windowHandler),
			application.NewService(cloudSyncHandler),
			application.NewService(octohubHandler),
			application.NewService(talpadbHandler),
			application.NewService(vulpesHandler),
			application.NewService(localFileHandler),
			application.NewService(repositoryHandler),
			application.NewService(generalConfigsHandler),
		},
	})

	desktop.OnWindowClosed(sessionManager.RevokeWindowOffer)
	desktopApplication.Window.OnCreate(desktop.TrackWindow)

	mainWindow := desktopApplication.Window.NewWithOptions(desktop.MainWindowOptions())
	mainWindow.OnWindowEvent(events.Common.WindowClosing, func(*application.WindowEvent) {
		go desktopApplication.Quit()
	})

	if err := desktopApplication.Run(); err != nil {
		log.Println("Error:", err.Error())
	}
}
