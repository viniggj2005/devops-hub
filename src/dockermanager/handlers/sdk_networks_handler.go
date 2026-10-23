package dockerHandlers

import (
	"encoding/json"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
)

func (handlerStruct *DockerSdkHandlerStruct) ListNetworks(clientId int) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}
	networksList, err := dockerClient.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(networksList, "", "  ")
	if err != nil {
		return "", err
	}

	return string(bytesArray), nil
}

func (handlerStruct *DockerSdkHandlerStruct) InspectNetwork(clientId int, newtworkId string) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}
	inspect, err := dockerClient.NetworkInspect(ctx, newtworkId, network.InspectOptions{Verbose: true})
	if err != nil {
		return "", err
	}
	bytesArray, err := json.MarshalIndent(inspect, "", "  ")
	if err != nil {
		return "", err
	}

	return string(bytesArray), nil
}
func (handlerStruct *DockerSdkHandlerStruct) DeleteNetwork(clientId int, newtworkId string) error {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}
	err = dockerClient.NetworkRemove(ctx, newtworkId)
	if err != nil {
		return err
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) PruneNetworks(clientId int) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}
	report, err := dockerClient.NetworksPrune(ctx, filters.Args{})
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}

	return string(bytesArray), nil
}

func (handlerStruct *DockerSdkHandlerStruct) CreateNetwork(clientId int, name string, options network.CreateOptions) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}
	report, err := dockerClient.NetworkCreate(ctx, name, options)
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}

	return string(bytesArray), nil
}
