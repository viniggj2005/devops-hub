package dockerHandlers

import (
	"context"
	"docker-manager-go/src/desktop"
	dockerDtos "docker-manager-go/src/dockermanager/dtos"
	dockerFunctions "docker-manager-go/src/dockermanager/functions"
	"encoding/json"
	"fmt"
	"io"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
)

func (handlerStruct *DockerSdkHandlerStruct) CreateContainer(clientId int, config dockerDtos.ContainerCreateOptions) (container.CreateResponse, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return container.CreateResponse{}, err
	}

	var containerConfig container.Config
	if config.Config != nil {
		bytes, _ := json.Marshal(config.Config)
		json.Unmarshal(bytes, &containerConfig)
	}

	var hostConfig container.HostConfig
	if config.HostConfig != nil {
		bytes, _ := json.Marshal(config.HostConfig)
		json.Unmarshal(bytes, &hostConfig)
	}

	var networkingConfig network.NetworkingConfig
	if config.NetworkingConfig != nil {
		bytes, _ := json.Marshal(config.NetworkingConfig)
		json.Unmarshal(bytes, &networkingConfig)
	}

	createdContainer, err := dockerClient.ContainerCreate(ctx, &containerConfig, &hostConfig, &networkingConfig, config.Platform, config.ContainerName)
	if err != nil {
		return container.CreateResponse{}, err
	}
	return createdContainer, nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerStart(clientId int, containerId string) error {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	if err := dockerClient.ContainerStart(ctx, containerId, container.StartOptions{}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerStop(clientId int, containerId string) error {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	if err := dockerClient.ContainerStop(ctx, containerId, container.StopOptions{}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerPause(clientId int, containerId string) error {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	if err := dockerClient.ContainerPause(ctx, containerId); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerUnPause(clientId int, containerId string) error {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	if err := dockerClient.ContainerUnpause(ctx, containerId); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerRename(clientId int, containerId, newName string) error {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	if err := dockerClient.ContainerRename(ctx, containerId, newName); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerLogs(clientId int, containerId string) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}

	logs, err := dockerClient.ContainerLogs(ctx, containerId, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     false,
		Tail:       "2000",
	})
	if err != nil {
		return "", &APIError{Code: 500, Message: err.Error()}
	}
	defer logs.Close()

	return dockerFunctions.LogsTreatment(logs), nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainersList(clientId int) ([]container.Summary, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return nil, err
	}

	containers, err := dockerClient.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, &APIError{Code: 500, Message: err.Error()}
	}

	return containers, nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerRemove(clientId int, containerId string) error {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	if err := dockerClient.ContainerRemove(ctx, containerId, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerInspect(clientId int, containerId string) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}

	inspect, err := dockerClient.ContainerInspect(ctx, containerId)
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(inspect, "", "  ")
	if err != nil {
		return "", err
	}

	return string(bytesArray), nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerRestart(clientId int, containerId string) error {
	timeoutSec := 10

	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	if err := dockerClient.ContainerRestart(ctx, containerId, container.StopOptions{
		Timeout: &timeoutSec,
		Signal:  "SIGTERM",
	}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerExec(ctx context.Context, clientId int, containerId string) (string, error) {
	dockerClient, clientContext, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}

	execConfig := container.ExecOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Env:          []string{"TERM=xterm"},
		Cmd:          []string{"/bin/sh", "-c", "[ -x /bin/bash ] && exec /bin/bash || exec /bin/sh"},
	}

	execID, err := dockerClient.ContainerExecCreate(clientContext, containerId, execConfig)
	if err != nil {
		return "", &APIError{Code: 500, Message: fmt.Sprintf("Erro ao criar exec: %v", err)}
	}

	attachConfig := container.ExecStartOptions{
		Detach: false,
		Tty:    true,
	}

	attachResponse, err := dockerClient.ContainerExecAttach(clientContext, execID.ID, attachConfig)
	if err != nil {
		return "", &APIError{Code: 500, Message: fmt.Sprintf("Erro ao conectar exec: %v", err)}
	}

	windowName := desktop.CallingWindowName(ctx)
	terminalKey := desktop.ScopedKey(windowName, containerId)
	connection := attachResponse.Conn

	handlerStruct.mutex.Lock()
	handlerStruct.terminalConns[terminalKey] = connection
	handlerStruct.terminalExecIds[terminalKey] = execID.ID
	handlerStruct.mutex.Unlock()

	go func() {
		defer connection.Close()
		buffer := make([]byte, 1024)
		for {
			bytesRead, err := connection.Read(buffer)
			if err != nil {
				if err != io.EOF {
					fmt.Printf("Erro ao ler terminal: %v\n", err)
				}
				break
			}
			if bytesRead > 0 {
				desktop.EmitToWindow(windowName, "terminal:data:"+containerId, string(buffer[:bytesRead]))
			}
		}
		handlerStruct.mutex.Lock()
		if handlerStruct.terminalConns[terminalKey] == connection {
			delete(handlerStruct.terminalConns, terminalKey)
			delete(handlerStruct.terminalExecIds, terminalKey)
		}
		handlerStruct.mutex.Unlock()
		desktop.EmitToWindow(windowName, "terminal:closed:"+containerId, true)
	}()

	return "Connected", nil
}

func (handlerStruct *DockerSdkHandlerStruct) TerminalWrite(ctx context.Context, containerId string, data string) error {
	terminalKey := desktop.ScopedKey(desktop.CallingWindowName(ctx), containerId)

	handlerStruct.mutex.Lock()
	connection, ok := handlerStruct.terminalConns[terminalKey]
	handlerStruct.mutex.Unlock()

	if !ok {
		return fmt.Errorf("conexão terminal não encontrada para container %s", containerId)
	}

	_, err := connection.Write([]byte(data))
	if err != nil {
		return fmt.Errorf("erro ao escrever terminal: %w", err)
	}
	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) TerminalResize(ctx context.Context, clientId int, containerId string, cols, rows int) error {
	terminalKey := desktop.ScopedKey(desktop.CallingWindowName(ctx), containerId)

	handlerStruct.mutex.Lock()
	execID, ok := handlerStruct.terminalExecIds[terminalKey]
	handlerStruct.mutex.Unlock()

	if !ok {
		return fmt.Errorf("exec ID não encontrado para container %s", containerId)
	}

	dockerClient, clientContext, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	resizeOptions := container.ResizeOptions{
		Height: uint(rows),
		Width:  uint(cols),
	}

	err = dockerClient.ContainerExecResize(clientContext, execID, resizeOptions)
	if err != nil {
		return &APIError{Code: 500, Message: fmt.Sprintf("Erro ao redimensionar terminal: %v", err)}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) TerminalClose(ctx context.Context, containerId string) error {
	terminalKey := desktop.ScopedKey(desktop.CallingWindowName(ctx), containerId)

	handlerStruct.mutex.Lock()
	connection, ok := handlerStruct.terminalConns[terminalKey]
	if ok {
		delete(handlerStruct.terminalConns, terminalKey)
		delete(handlerStruct.terminalExecIds, terminalKey)
	}
	handlerStruct.mutex.Unlock()

	if ok {
		return connection.Close()
	}
	return nil
}
