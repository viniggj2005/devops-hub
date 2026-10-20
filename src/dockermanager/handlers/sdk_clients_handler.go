package dockerHandlers

import (
	"context"
	"fmt"
	"net"
	"sync"

	"docker-manager-go/src/desktop"
	dockerDtos "docker-manager-go/src/dockermanager/dtos"
	dockerFunctions "docker-manager-go/src/dockermanager/functions"

	"github.com/docker/docker/client"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type DockerSdkHandlerStruct struct {
	mutex           sync.Mutex
	clients         map[string]*client.Client
	contexts        map[string]context.Context
	appContext      context.Context
	statsCancel     map[string]map[string]context.CancelFunc
	dockerHandler   *DockerHandlerStruct
	clientCancels   map[string]context.CancelFunc
	terminalConns   map[string]net.Conn
	terminalExecIds map[string]string
}

type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (err *APIError) Error() string {
	return fmt.Sprintf("code %d: %s", err.Code, err.Message)
}

func NewDockerSdkHandler(dockerHandler *DockerHandlerStruct) *DockerSdkHandlerStruct {
	sdkHandler := &DockerSdkHandlerStruct{
		clients:         make(map[string]*client.Client),
		contexts:        make(map[string]context.Context),
		statsCancel:     make(map[string]map[string]context.CancelFunc),
		dockerHandler:   dockerHandler,
		clientCancels:   make(map[string]context.CancelFunc),
		terminalConns:   make(map[string]net.Conn),
		terminalExecIds: make(map[string]string),
	}
	dockerHandler.registerDockerSdkHandler(sdkHandler)
	return sdkHandler
}

func (handlerStruct *DockerSdkHandlerStruct) AddDockerClient(id int) error {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()

	docker, err := handlerStruct.dockerHandler.getDockerConnectionByIdWithoutToken(id)
	if err != nil {
		return fmt.Errorf("erro ao buscar conexão Docker: %w", err)
	}

	dockerId := fmt.Sprintf("%d", docker.ID)
	if _, exists := handlerStruct.clients[dockerId]; exists {
		return nil
	}

	httpClient, err := dockerFunctions.BuildTLSHTTPClient(
		docker.Ca.Plaintext,
		docker.Cert.Plaintext,
		docker.Key.Plaintext,
	)
	if err != nil {
		return fmt.Errorf("erro ao montar TLS: %w", err)
	}

	dockerClient, err := client.NewClientWithOpts(
		client.WithHost(docker.Url.Plaintext),
		client.WithHTTPClient(httpClient),
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return fmt.Errorf("erro ao criar cliente Docker: %w", err)
	}

	baseContext := handlerStruct.appContext
	if baseContext == nil {
		baseContext = context.Background()
	}

	clientContext, cancel := context.WithCancel(baseContext)

	handlerStruct.clients[dockerId] = dockerClient
	handlerStruct.contexts[dockerId] = clientContext
	handlerStruct.clientCancels[dockerId] = cancel
	handlerStruct.statsCancel[dockerId] = make(map[string]context.CancelFunc)

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) catchClient(clientId int) (*client.Client, context.Context, error) {
	id := fmt.Sprintf("%d", clientId)

	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()

	dockerClient, exists := handlerStruct.clients[id]
	clientContext, contextExists := handlerStruct.contexts[id]

	if !exists || !contextExists {
		return nil, nil, &APIError{
			Code:    404,
			Message: fmt.Sprintf("cliente %d não encontrado", clientId),
		}
	}

	return dockerClient, clientContext, nil
}

func (handlerStruct *DockerSdkHandlerStruct) ConnectDocker(id int) error {
	return handlerStruct.AddDockerClient(id)
}

func (handlerStruct *DockerSdkHandlerStruct) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()

	handlerStruct.appContext = ctx

	for id := range handlerStruct.clients {
		handlerStruct.contexts[id] = ctx
	}

	desktop.OnWindowClosed(handlerStruct.releaseWindowResources)
	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) releaseWindowResources(windowName string) {
	var terminals []net.Conn

	handlerStruct.mutex.Lock()
	for _, streams := range handlerStruct.statsCancel {
		for streamKey, cancel := range streams {
			if desktop.IsScopedTo(streamKey, windowName) {
				cancel()
				delete(streams, streamKey)
			}
		}
	}
	for terminalKey, connection := range handlerStruct.terminalConns {
		if desktop.IsScopedTo(terminalKey, windowName) {
			terminals = append(terminals, connection)
			delete(handlerStruct.terminalConns, terminalKey)
			delete(handlerStruct.terminalExecIds, terminalKey)
		}
	}
	handlerStruct.mutex.Unlock()

	for _, connection := range terminals {
		_ = connection.Close()
	}
}

func (handlerStruct *DockerSdkHandlerStruct) GetInfo(clientId int) (dockerDtos.SystemInfoDto, error) {

	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return dockerDtos.SystemInfoDto{}, err
	}
	info, err := dockerClient.Info(ctx)
	if err != nil {
		return dockerDtos.SystemInfoDto{}, err
	}
	return dockerDtos.SystemInfoDto{
		ID:                info.ID,
		Name:              info.Name,
		NCPU:              info.NCPU,
		Images:            info.Images,
		MemTotal:          info.MemTotal,
		SystemTime:        info.SystemTime,
		Containers:        info.Containers,
		Architecture:      info.Architecture,
		ServerVersion:     info.ServerVersion,
		OperatingSystem:   info.OperatingSystem,
		ContainersPaused:  info.ContainersPaused,
		ContainersRunning: info.ContainersRunning,
		ContainersStopped: info.ContainersStopped,
	}, nil
}
