package dockerHandlers

import (
	"docker-manager-go/src/dtos"
	"docker-manager-go/src/functions"
	"encoding/json"
	"fmt"
	"io"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (handlerStruct *DockerSdkHandlerStruct) CreateContainer(clientId int, config dtos.ContainerCreateOptions) (container.CreateResponse, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
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

	resp, err := cli.ContainerCreate(ctx, &containerConfig, &hostConfig, &networkingConfig, config.Platform, config.ContainerName)
	if err != nil {
		return container.CreateResponse{}, err
	}
	return resp, nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerStart(clientId int, containerId string) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	if err := cli.ContainerStart(ctx, containerId, container.StartOptions{}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerStop(clientId int, containerId string) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	if err := cli.ContainerStop(ctx, containerId, container.StopOptions{}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerPause(clientId int, containerId string) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	if err := cli.ContainerPause(ctx, containerId); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerUnPause(clientId int, containerId string) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	if err := cli.ContainerUnpause(ctx, containerId); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerRename(clientId int, containerId, newName string) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	if err := cli.ContainerRename(ctx, containerId, newName); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerLogs(clientId int, containerId string) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}

	logs, err := cli.ContainerLogs(ctx, containerId, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     false,
		Tail:       "2000",
	})
	if err != nil {
		return "", &APIError{Code: 500, Message: err.Error()}
	}
	defer logs.Close()

	return functions.LogsTreatment(logs), nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainersList(clientId int) ([]container.Summary, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return nil, err
	}

	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, &APIError{Code: 500, Message: err.Error()}
	}

	return containers, nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerRemove(clientId int, containerId string) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	if err := cli.ContainerRemove(ctx, containerId, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerInspect(clientId int, containerId string) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}

	inspect, err := cli.ContainerInspect(ctx, containerId)
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

	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	if err := cli.ContainerRestart(ctx, containerId, container.StopOptions{
		Timeout: &timeoutSec,
		Signal:  "SIGTERM",
	}); err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ContainerExec(clientId int, containerId string) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
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

	execID, err := cli.ContainerExecCreate(ctx, containerId, execConfig)
	if err != nil {
		return "", &APIError{Code: 500, Message: fmt.Sprintf("Erro ao criar exec: %v", err)}
	}

	attachConfig := container.ExecStartOptions{
		Detach: false,
		Tty:    true,
	}

	resp, err := cli.ContainerExecAttach(ctx, execID.ID, attachConfig)
	if err != nil {
		return "", &APIError{Code: 500, Message: fmt.Sprintf("Erro ao conectar exec: %v", err)}
	}

	handlerStruct.mutex.Lock()
	handlerStruct.terminalConns[containerId] = resp.Conn
	handlerStruct.terminalExecIds[containerId] = execID.ID
	handlerStruct.mutex.Unlock()

	go func() {
		defer resp.Conn.Close()
		buf := make([]byte, 1024)
		for {
			n, err := resp.Conn.Read(buf)
			if err != nil {
				if err != io.EOF {
					fmt.Printf("Erro ao ler terminal: %v\n", err)
				}
				break
			}
			if n > 0 {
				runtime.EventsEmit(handlerStruct.appContext, "terminal:data:"+containerId, string(buf[:n]))
			}
		}
		handlerStruct.mutex.Lock()
		delete(handlerStruct.terminalConns, containerId)
		delete(handlerStruct.terminalExecIds, containerId)
		handlerStruct.mutex.Unlock()
		runtime.EventsEmit(handlerStruct.appContext, "terminal:closed:"+containerId, true)
	}()

	return "Connected", nil
}

func (handlerStruct *DockerSdkHandlerStruct) TerminalWrite(containerId string, data string) error {
	handlerStruct.mutex.Lock()
	conn, ok := handlerStruct.terminalConns[containerId]
	handlerStruct.mutex.Unlock()

	if !ok {
		return fmt.Errorf("conexão terminal não encontrada para container %s", containerId)
	}

	_, err := conn.Write([]byte(data))
	if err != nil {
		return fmt.Errorf("erro ao escrever terminal: %w", err)
	}
	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) TerminalResize(clientId int, containerId string, cols, rows int) error {
	handlerStruct.mutex.Lock()
	execID, ok := handlerStruct.terminalExecIds[containerId]
	handlerStruct.mutex.Unlock()

	if !ok {
		return fmt.Errorf("exec ID não encontrado para container %s", containerId)
	}

	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	resizeOptions := container.ResizeOptions{
		Height: uint(rows),
		Width:  uint(cols),
	}

	err = cli.ContainerExecResize(ctx, execID, resizeOptions)
	if err != nil {
		return &APIError{Code: 500, Message: fmt.Sprintf("Erro ao redimensionar terminal: %v", err)}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) TerminalClose(containerId string) error {
	handlerStruct.mutex.Lock()
	conn, ok := handlerStruct.terminalConns[containerId]
	if ok {
		delete(handlerStruct.terminalConns, containerId)
		delete(handlerStruct.terminalExecIds, containerId)
	}
	handlerStruct.mutex.Unlock()

	if ok {
		return conn.Close()
	}
	return nil
}
