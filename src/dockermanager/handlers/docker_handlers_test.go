package dockerHandlers

import (
	"bytes"
	"context"
	authFunctions "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/desktop"
	dockerDtos "docker-manager-go/src/dockermanager/dtos"
	"docker-manager-go/src/models"
	"docker-manager-go/src/types"
	"encoding/base64"
	"encoding/hex"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/glebarez/sqlite"
	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"
)

func setupDockerTestHandler(test *testing.T) (*DockerHandlerStruct, *DockerSdkHandlerStruct, string) {
	sessionKey := hex.EncodeToString(bytes.Repeat([]byte{0x33}, 32))
	if err := types.SetSessionKey(sessionKey); err != nil {
		test.Fatalf("unexpected error setting session key: %v", err)
	}

	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	if err := dataBase.AutoMigrate(&models.UserModel{}, &models.DockerCredentialsModel{}); err != nil {
		test.Fatalf("unexpected error migrating models: %v", err)
	}

	sessionManager := authFunctions.NewManager(time.Hour)
	token, _, err := sessionManager.Create(1)
	if err != nil {
		test.Fatalf("unexpected error creating session: %v", err)
	}

	dockerHandler := NewDockerHandler(dataBase, sessionManager)
	dockerHandler.ServiceStartup(context.Background(), application.ServiceOptions{})

	sdkHandler := NewDockerSdkHandler(dockerHandler)
	sdkHandler.ServiceStartup(context.Background(), application.ServiceOptions{})

	return dockerHandler, sdkHandler, token
}

func TestDockerHandlerCRUD(test *testing.T) {
	dockerHandler, sdkHandler, token := setupDockerTestHandler(test)

	if err := dockerHandler.ConnectDockerCredential("invalid", 1); err == nil {
		test.Fatalf("expected error with invalid token")
	}

	dockerHandler.dockerSdk = nil
	if err := dockerHandler.ConnectDockerCredential(token, 1); err == nil {
		test.Fatalf("expected error when sdkHandler is not registered")
	}

	dockerHandler.registerDockerSdkHandler(sdkHandler)

	if err := dockerHandler.ConnectDockerCredential(token, 999); err == nil {
		test.Fatalf("expected error when credential does not exist")
	}

	encodedValue := base64.StdEncoding.EncodeToString([]byte("pem-data"))

	if err := dockerHandler.CreateDockerConnection("invalid", dockerDtos.CreateDockerConnectionDto{}); err == nil {
		test.Fatalf("expected error with invalid token")
	}

	if err := dockerHandler.CreateDockerConnection(token, dockerDtos.CreateDockerConnectionDto{
		Key: "!!!invalid-base64",
	}); err == nil {
		test.Fatalf("expected error for invalid Key base64")
	}

	if err := dockerHandler.CreateDockerConnection(token, dockerDtos.CreateDockerConnectionDto{
		Key: encodedValue,
		Ca:  "!!!invalid-base64",
	}); err == nil {
		test.Fatalf("expected error for invalid Ca base64")
	}

	if err := dockerHandler.CreateDockerConnection(token, dockerDtos.CreateDockerConnectionDto{
		Key:  encodedValue,
		Ca:   encodedValue,
		Cert: "!!!invalid-base64",
	}); err == nil {
		test.Fatalf("expected error for invalid Cert base64")
	}

	if err := dockerHandler.CreateDockerConnection(token, dockerDtos.CreateDockerConnectionDto{
		Key:  encodedValue,
		Ca:   encodedValue,
		Cert: encodedValue,
		Url:  "",
	}); err == nil {
		test.Fatalf("expected error when Url is empty")
	}

	if err := dockerHandler.CreateDockerConnection(token, dockerDtos.CreateDockerConnectionDto{
		UserID:      1,
		Alias:       "Prod Docker",
		Description: "Production cluster",
		Url:         "tcp://127.0.0.1:2376",
		Key:         encodedValue,
		Ca:          encodedValue,
		Cert:        encodedValue,
	}); err != nil {
		test.Fatalf("unexpected error creating docker connection: %v", err)
	}

	if _, err := dockerHandler.FindAllByUser("invalid", 1); err == nil {
		test.Fatalf("expected error with invalid token")
	}

	connections, err := dockerHandler.FindAllByUser(token, 1)
	if err != nil || len(connections) != 1 || connections[0].Alias != "Prod Docker" {
		test.Fatalf("unexpected connections list: %+v, err=%v", connections, err)
	}

	connectionID := int(connections[0].ID)

	if _, err := dockerHandler.GetDockerConnectionById("invalid", connectionID); err == nil {
		test.Fatalf("expected error with invalid token")
	}

	found, err := dockerHandler.GetDockerConnectionById(token, connectionID)
	if err != nil || found.Url.Plaintext != "tcp://127.0.0.1:2376" {
		test.Fatalf("unexpected connection by ID: %+v, err=%v", found, err)
	}

	withoutToken, err := dockerHandler.getDockerConnectionByIdWithoutToken(connectionID)
	if err != nil || withoutToken.Alias != "Prod Docker" {
		test.Fatalf("unexpected connection without token: %+v, err=%v", withoutToken, err)
	}

	if err := dockerHandler.DeleteDockerConnection("invalid", uint(connectionID)); err == nil {
		test.Fatalf("expected error deleting with invalid token")
	}

	if err := dockerHandler.DeleteDockerConnection(token, uint(connectionID)); err != nil {
		test.Fatalf("unexpected error deleting docker connection: %v", err)
	}
}

func TestDockerSdkHandlerAndMockEngine(test *testing.T) {
	_, sdkHandler, _ := setupDockerTestHandler(test)

	apiErr := &APIError{Code: 404, Message: "not found"}
	if apiErr.Error() != "code 404: not found" {
		test.Fatalf("unexpected APIError string: %s", apiErr.Error())
	}

	if _, _, err := sdkHandler.catchClient(404); err == nil {
		test.Fatalf("expected error catching missing client")
	}

	mockServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		path := request.URL.Path
		switch {
		case strings.HasSuffix(path, "/info"):
			_, _ = writer.Write([]byte(`{"ID":"sys-1","Name":"node-1","NCPU":4,"Images":10,"Containers":2}`))
		case strings.HasSuffix(path, "/containers/create"):
			writer.WriteHeader(http.StatusCreated)
			_, _ = writer.Write([]byte(`{"Id":"cont-123","Warnings":[]}`))
		case strings.HasSuffix(path, "/containers/json"):
			_, _ = writer.Write([]byte(`[{"Id":"cont-123","Names":["/web"]}]`))
		case strings.HasSuffix(path, "/containers/cont-123/json"):
			_, _ = writer.Write([]byte(`{"Id":"cont-123","Name":"/web"}`))
		case strings.HasSuffix(path, "/containers/cont-123/logs"):
			_, _ = writer.Write([]byte("GET /status 200\n"))
		case strings.HasSuffix(path, "/start") || strings.HasSuffix(path, "/stop") || strings.HasSuffix(path, "/pause") || strings.HasSuffix(path, "/unpause") || strings.HasSuffix(path, "/rename") || strings.HasSuffix(path, "/restart") || strings.HasSuffix(path, "/resize"):
			writer.WriteHeader(http.StatusNoContent)
		case request.Method == http.MethodDelete && strings.Contains(path, "/containers/"):
			writer.WriteHeader(http.StatusNoContent)
		case strings.HasSuffix(path, "/images/json"):
			_, _ = writer.Write([]byte(`[{"Id":"img-1","RepoTags":["<none>:<none>"]},{"Id":"img-2","RepoTags":["alpine:latest"]}]`))
		case request.Method == http.MethodDelete && strings.Contains(path, "/images/"):
			_, _ = writer.Write([]byte(`[{"Untagged":"alpine:latest"}]`))
		case strings.HasSuffix(path, "/images/prune"):
			_, _ = writer.Write([]byte(`{"SpaceReclaimed":1024}`))
		case strings.HasSuffix(path, "/images/alpine/json"):
			_, _ = writer.Write([]byte(`{"Id":"img-2"}`))
		case strings.HasSuffix(path, "/networks") && request.Method == http.MethodGet:
			_, _ = writer.Write([]byte(`[{"Name":"bridge","Id":"net-1"}]`))
		case strings.HasSuffix(path, "/networks/create"):
			writer.WriteHeader(http.StatusCreated)
			_, _ = writer.Write([]byte(`{"Id":"net-2","Warning":""}`))
		case strings.HasSuffix(path, "/networks/prune"):
			_, _ = writer.Write([]byte(`{"NetworksDeleted":["net-old"]}`))
		case strings.HasSuffix(path, "/networks/net-1") && request.Method == http.MethodGet:
			_, _ = writer.Write([]byte(`{"Name":"bridge","Id":"net-1"}`))
		case strings.HasSuffix(path, "/networks/net-1") && request.Method == http.MethodDelete:
			writer.WriteHeader(http.StatusNoContent)
		case strings.HasSuffix(path, "/volumes") && request.Method == http.MethodGet:
			_, _ = writer.Write([]byte(`{"Volumes":[{"Name":"vol-1"}],"Warnings":[]}`))
		case strings.HasSuffix(path, "/volumes/create"):
			writer.WriteHeader(http.StatusCreated)
			_, _ = writer.Write([]byte(`{"Name":"vol-new","Driver":"local"}`))
		case strings.HasSuffix(path, "/volumes/vol-1") && request.Method == http.MethodGet:
			_, _ = writer.Write([]byte(`{"Name":"vol-1","Driver":"local"}`))
		case strings.HasSuffix(path, "/volumes/vol-1") && request.Method == http.MethodDelete:
			writer.WriteHeader(http.StatusNoContent)
		default:
			writer.WriteHeader(http.StatusOK)
			_, _ = writer.Write([]byte(`{}`))
		}
	}))
	defer mockServer.Close()

	dockerClient, err := client.NewClientWithOpts(
		client.WithHost(mockServer.URL),
		client.WithHTTPClient(mockServer.Client()),
		client.WithVersion("1.45"),
	)
	if err != nil {
		test.Fatalf("unexpected error creating mock docker client: %v", err)
	}
	defer dockerClient.Close()

	sdkHandler.clients["1"] = dockerClient
	sdkHandler.contexts["1"] = context.Background()
	sdkHandler.statsCancel["1"] = make(map[string]context.CancelFunc)

	info, err := sdkHandler.GetInfo(1)
	if err != nil || info.Name != "node-1" || info.NCPU != 4 {
		test.Fatalf("unexpected GetInfo result: %+v, err=%v", info, err)
	}

	createdContainer, err := sdkHandler.CreateContainer(1, dockerDtos.ContainerCreateOptions{
		ContainerName:    "web",
		Config:           map[string]any{"Image": "alpine"},
		HostConfig:       map[string]any{"AutoRemove": true},
		NetworkingConfig: map[string]any{},
	})
	if err != nil || createdContainer.ID != "cont-123" {
		test.Fatalf("unexpected CreateContainer result: %+v, err=%v", createdContainer, err)
	}

	if err := sdkHandler.ContainerStart(1, "cont-123"); err != nil {
		test.Fatalf("unexpected ContainerStart error: %v", err)
	}
	if err := sdkHandler.ContainerStop(1, "cont-123"); err != nil {
		test.Fatalf("unexpected ContainerStop error: %v", err)
	}
	if err := sdkHandler.ContainerPause(1, "cont-123"); err != nil {
		test.Fatalf("unexpected ContainerPause error: %v", err)
	}
	if err := sdkHandler.ContainerUnPause(1, "cont-123"); err != nil {
		test.Fatalf("unexpected ContainerUnPause error: %v", err)
	}
	if err := sdkHandler.ContainerRename(1, "cont-123", "web-2"); err != nil {
		test.Fatalf("unexpected ContainerRename error: %v", err)
	}
	if err := sdkHandler.ContainerRestart(1, "cont-123"); err != nil {
		test.Fatalf("unexpected ContainerRestart error: %v", err)
	}

	logsOutput, err := sdkHandler.ContainerLogs(1, "cont-123")
	if err != nil || !strings.Contains(logsOutput, "GET") {
		test.Fatalf("unexpected ContainerLogs output: %s, err=%v", logsOutput, err)
	}

	containersList, err := sdkHandler.ContainersList(1)
	if err != nil || len(containersList) != 1 {
		test.Fatalf("unexpected ContainersList: %+v, err=%v", containersList, err)
	}

	inspectedContainer, err := sdkHandler.ContainerInspect(1, "cont-123")
	if err != nil || !strings.Contains(inspectedContainer, "cont-123") {
		test.Fatalf("unexpected ContainerInspect: %s, err=%v", inspectedContainer, err)
	}

	if err := sdkHandler.ContainerRemove(1, "cont-123"); err != nil {
		test.Fatalf("unexpected ContainerRemove error: %v", err)
	}

	imagesList, err := sdkHandler.ImagesList(1)
	if err != nil || len(imagesList) != 1 || imagesList[0].ID != "img-2" {
		test.Fatalf("unexpected ImagesList: %+v, err=%v", imagesList, err)
	}

	removedImages, err := sdkHandler.RemoveImage(1, "img-2")
	if err != nil || len(removedImages) != 1 {
		test.Fatalf("unexpected RemoveImage: %+v, err=%v", removedImages, err)
	}

	pruneReport, err := sdkHandler.PruneImages(1)
	if err != nil || pruneReport.SpaceReclaimed != 1024 {
		test.Fatalf("unexpected PruneImages: %+v, err=%v", pruneReport, err)
	}

	inspectedImage, err := sdkHandler.InspectImage(1, "alpine")
	if err != nil || !strings.Contains(inspectedImage, "img-2") {
		test.Fatalf("unexpected InspectImage: %s, err=%v", inspectedImage, err)
	}

	networksJSON, err := sdkHandler.ListNetworks(1)
	if err != nil || !strings.Contains(networksJSON, "bridge") {
		test.Fatalf("unexpected ListNetworks: %s, err=%v", networksJSON, err)
	}

	inspectedNetwork, err := sdkHandler.InspectNetwork(1, "net-1")
	if err != nil || !strings.Contains(inspectedNetwork, "bridge") {
		test.Fatalf("unexpected InspectNetwork: %s, err=%v", inspectedNetwork, err)
	}

	createdNetwork, err := sdkHandler.CreateNetwork(1, "net-2", network.CreateOptions{})
	if err != nil || !strings.Contains(createdNetwork, "net-2") {
		test.Fatalf("unexpected CreateNetwork: %s, err=%v", createdNetwork, err)
	}

	prunedNetworks, err := sdkHandler.PruneNetworks(1)
	if err != nil || !strings.Contains(prunedNetworks, "net-old") {
		test.Fatalf("unexpected PruneNetworks: %s, err=%v", prunedNetworks, err)
	}

	if err := sdkHandler.DeleteNetwork(1, "net-1"); err != nil {
		test.Fatalf("unexpected DeleteNetwork error: %v", err)
	}

	volumesJSON, err := sdkHandler.ListVolumes(1)
	if err != nil || !strings.Contains(volumesJSON, "vol-1") {
		test.Fatalf("unexpected ListVolumes: %s, err=%v", volumesJSON, err)
	}

	createdVolume, err := sdkHandler.CreateVolume(1, volume.CreateOptions{Name: "vol-new"})
	if err != nil || !strings.Contains(createdVolume, "vol-new") {
		test.Fatalf("unexpected CreateVolume: %s, err=%v", createdVolume, err)
	}

	inspectedVolume, err := sdkHandler.InspectVolume(1, "vol-1")
	if err != nil || !strings.Contains(inspectedVolume, "vol-1") {
		test.Fatalf("unexpected InspectVolume: %s, err=%v", inspectedVolume, err)
	}

	if err := sdkHandler.DeleteVolume(1, "vol-1"); err != nil {
		test.Fatalf("unexpected DeleteVolume error: %v", err)
	}

	if err := sdkHandler.TerminalWrite(context.Background(), "missing", "ls\n"); err == nil {
		test.Fatalf("expected error writing to missing terminal")
	}
	if err := sdkHandler.TerminalResize(context.Background(), 1, "missing", 80, 24); err == nil {
		test.Fatalf("expected error resizing missing terminal")
	}

	clientConn, serverConn := net.Pipe()
	defer serverConn.Close()
	sdkHandler.terminalConns[desktop.ScopedKey("", "cont-123")] = clientConn
	sdkHandler.terminalExecIds[desktop.ScopedKey("", "cont-123")] = "exec-1"

	go func() {
		buffer := make([]byte, 16)
		_, _ = serverConn.Read(buffer)
	}()

	if err := sdkHandler.TerminalWrite(context.Background(), "cont-123", "pwd\n"); err != nil {
		test.Fatalf("unexpected TerminalWrite error: %v", err)
	}
	if err := sdkHandler.TerminalResize(context.Background(), 1, "cont-123", 100, 30); err != nil {
		test.Fatalf("unexpected TerminalResize error: %v", err)
	}
	if err := sdkHandler.TerminalClose(context.Background(), "cont-123"); err != nil {
		test.Fatalf("unexpected TerminalClose error: %v", err)
	}
}

func TestDockerStatsCalculations(test *testing.T) {
	stats := &container.StatsResponse{}
	if cpuPercent(stats) != 0 {
		test.Fatalf("expected 0 cpuPercent on empty stats")
	}
	if memPercent(stats) != 0 {
		test.Fatalf("expected 0 memPercent when limit is 0")
	}

	stats.PreCPUStats.CPUUsage.TotalUsage = 100
	stats.CPUStats.CPUUsage.TotalUsage = 200
	stats.PreCPUStats.SystemUsage = 1000
	stats.CPUStats.SystemUsage = 2000
	stats.CPUStats.OnlineCPUs = 2

	calculatedCpu := cpuPercent(stats)
	if calculatedCpu != 20.0 {
		test.Fatalf("expected 20.0 cpuPercent, got %f", calculatedCpu)
	}

	stats.MemoryStats.Usage = 500
	stats.MemoryStats.Limit = 1000
	stats.MemoryStats.Stats = map[string]uint64{"cache": 100}

	if memUsage(stats) != 400 {
		test.Fatalf("expected 400 memUsage, got %d", memUsage(stats))
	}
	if memPercent(stats) != 40.0 {
		test.Fatalf("expected 40.0 memPercent, got %f", memPercent(stats))
	}

	stats.Networks = map[string]container.NetworkStats{
		"eth0": {RxBytes: 120, TxBytes: 80},
		"eth1": {RxBytes: 30, TxBytes: 20},
	}
	if sumRx(stats) != 150 || sumTx(stats) != 100 {
		test.Fatalf("unexpected network totals: rx=%d tx=%d", sumRx(stats), sumTx(stats))
	}
}


func TestDockerClientIsReusedAcrossWindows(test *testing.T) {
	dockerHandler, sdkHandler, token := setupDockerTestHandler(test)
	encodedValue := base64.StdEncoding.EncodeToString([]byte("pem-data"))
	if err := dockerHandler.CreateDockerConnection(token, dockerDtos.CreateDockerConnectionDto{
		UserID: 1,
		Alias:  "Shared Docker",
		Url:    "tcp://127.0.0.1:2376",
		Key:    encodedValue,
		Ca:     encodedValue,
		Cert:   encodedValue,
	}); err != nil {
		test.Fatalf("unexpected error creating docker connection: %v", err)
	}

	existingClient, err := client.NewClientWithOpts(client.WithHost("tcp://127.0.0.1:2376"))
	if err != nil {
		test.Fatalf("unexpected error creating docker client: %v", err)
	}
	defer existingClient.Close()

	clientContext, cancelClient := context.WithCancel(context.Background())
	defer cancelClient()
	streamContext, cancelStream := context.WithCancel(clientContext)
	defer cancelStream()

	sdkHandler.clients["1"] = existingClient
	sdkHandler.contexts["1"] = clientContext
	sdkHandler.clientCancels["1"] = cancelClient
	sdkHandler.statsCancel["1"] = map[string]context.CancelFunc{desktop.ScopedKey("main", "cont-1"): cancelStream}

	if err := sdkHandler.AddDockerClient(1); err != nil {
		test.Fatalf("unexpected error reconnecting docker client: %v", err)
	}
	if sdkHandler.clients["1"] != existingClient {
		test.Fatalf("expected a second window to reuse the existing docker client")
	}
	if streamContext.Err() != nil {
		test.Fatalf("expected the first window stats stream to keep running")
	}
}

func TestDockerTerminalsAndStatsAreIsolatedPerWindow(test *testing.T) {
	_, sdkHandler, _ := setupDockerTestHandler(test)
	mainWindow := desktop.WithWindowName(context.Background(), "main")
	moduleWindow := desktop.WithWindowName(context.Background(), "module-1")
	mainKey := desktop.ScopedKey("main", "cont-1")
	moduleKey := desktop.ScopedKey("module-1", "cont-1")

	mainConnection, mainPeer := net.Pipe()
	moduleConnection, modulePeer := net.Pipe()
	defer mainPeer.Close()
	defer modulePeer.Close()
	sdkHandler.terminalConns[mainKey] = mainConnection
	sdkHandler.terminalConns[moduleKey] = moduleConnection
	sdkHandler.terminalExecIds[mainKey] = "exec-main"
	sdkHandler.terminalExecIds[moduleKey] = "exec-module"

	received := make(chan string, 1)
	go func() {
		buffer := make([]byte, 16)
		bytesRead, _ := modulePeer.Read(buffer)
		received <- string(buffer[:bytesRead])
	}()
	if err := sdkHandler.TerminalWrite(moduleWindow, "cont-1", "ls\n"); err != nil {
		test.Fatalf("unexpected error writing to module window terminal: %v", err)
	}
	if output := <-received; output != "ls\n" {
		test.Fatalf("expected input to reach the module window terminal, got %q", output)
	}

	mainStatsCancelled, moduleStatsCancelled := false, false
	sdkHandler.statsCancel["1"] = map[string]context.CancelFunc{
		mainKey:   func() { mainStatsCancelled = true },
		moduleKey: func() { moduleStatsCancelled = true },
	}

	sdkHandler.releaseWindowResources("module-1")

	if !moduleStatsCancelled || mainStatsCancelled {
		test.Fatalf("expected only the closed window stats to stop, main=%v module=%v", mainStatsCancelled, moduleStatsCancelled)
	}
	if _, exists := sdkHandler.terminalConns[moduleKey]; exists {
		test.Fatalf("expected the closed window terminal to be released")
	}
	if _, err := moduleConnection.Write([]byte("x")); err == nil {
		test.Fatalf("expected the closed window terminal connection to be closed")
	}

	go func() {
		buffer := make([]byte, 16)
		bytesRead, _ := mainPeer.Read(buffer)
		received <- string(buffer[:bytesRead])
	}()
	if err := sdkHandler.TerminalWrite(mainWindow, "cont-1", "pwd\n"); err != nil {
		test.Fatalf("expected the main window terminal to keep working: %v", err)
	}
	if output := <-received; output != "pwd\n" {
		test.Fatalf("expected input to reach the main window terminal, got %q", output)
	}
}
