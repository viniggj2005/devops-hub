package dockerHandlers

import (
	"context"
	"fmt"
	"net"
	"sync"

	dockerDtos "docker-manager-go/src/dockermanager/dtos"
	dockerFunctions "docker-manager-go/src/dockermanager/functions"

	"github.com/docker/docker/client"
)

type DockerSdkHandlerStruct struct {
	mutex           sync.Mutex
	appContext      context.Context
	dockerHandler   *DockerHandlerStruct
	clients         map[string]*client.Client
	contexts        map[string]context.Context
	clientCancels   map[string]context.CancelFunc
	statsCancel     map[string]map[string]context.CancelFunc
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
	return &DockerSdkHandlerStruct{
		dockerHandler:   dockerHandler,
		clients:         make(map[string]*client.Client),
		contexts:        make(map[string]context.Context),
		clientCancels:   make(map[string]context.CancelFunc),
		statsCancel:     make(map[string]map[string]context.CancelFunc),
		terminalConns:   make(map[string]net.Conn),
		terminalExecIds: make(map[string]string),
	}
}

func (handlerStruct *DockerSdkHandlerStruct) AddDockerClient(id int) error {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()

	docker, err := handlerStruct.dockerHandler.GetDockerConnectionByIdWithoutToken(id)
	if err != nil {
		return fmt.Errorf("erro ao buscar conexão Docker: %w", err)
	}

	dockerId := fmt.Sprintf("%d", docker.ID)

	if cancel, exists := handlerStruct.clientCancels[dockerId]; exists {
		cancel()
		delete(handlerStruct.clientCancels, dockerId)
	}
	if cancelsMap, ok := handlerStruct.statsCancel[dockerId]; ok {
		for _, c := range cancelsMap {
			c()
		}
		delete(handlerStruct.statsCancel, dockerId)
	}

	if existingClient, exists := handlerStruct.clients[dockerId]; exists {
		existingClient.Close()
		delete(handlerStruct.clients, dockerId)
	}

	delete(handlerStruct.contexts, dockerId)
	delete(handlerStruct.clientCancels, dockerId)
	delete(handlerStruct.statsCancel, dockerId)

	httpClient, err := dockerFunctions.BuildTLSHTTPClient(
		docker.Ca.Plaintext,
		docker.Cert.Plaintext,
		docker.Key.Plaintext,
	)
	if err != nil {
		return fmt.Errorf("erro ao montar TLS: %w", err)
	}

	cli, err := client.NewClientWithOpts(
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

	ctx, cancel := context.WithCancel(baseContext)

	handlerStruct.clients[dockerId] = cli
	handlerStruct.contexts[dockerId] = ctx
	handlerStruct.clientCancels[dockerId] = cancel
	handlerStruct.statsCancel[dockerId] = make(map[string]context.CancelFunc)

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) CatchClient(clientId int) (*client.Client, context.Context, error) {
	id := fmt.Sprintf("%d", clientId)

	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()

	cli, exists := handlerStruct.clients[id]
	ctx, ctxExists := handlerStruct.contexts[id]

	if !exists || !ctxExists {
		return nil, nil, &APIError{
			Code:    404,
			Message: fmt.Sprintf("cliente %d não encontrado", clientId),
		}
	}

	return cli, ctx, nil
}

func (handlerStruct *DockerSdkHandlerStruct) ConnectDocker(id int) error {
	return handlerStruct.AddDockerClient(id)
}

func (handlerStruct *DockerSdkHandlerStruct) Startup(ctx context.Context) {
	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()

	handlerStruct.appContext = ctx

	for id := range handlerStruct.clients {
		handlerStruct.contexts[id] = ctx
	}
}

func (handlerStruct *DockerSdkHandlerStruct) GetInfo(clientId int) (dockerDtos.SystemInfoDto, error) {

	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return dockerDtos.SystemInfoDto{}, err
	}
	info, err := cli.Info(ctx)
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
