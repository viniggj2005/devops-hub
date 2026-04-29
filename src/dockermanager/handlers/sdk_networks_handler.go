package dockerHandlers

import (
	"encoding/json"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
)

func (handlerStruct *DockerSdkHandlerStruct) ListNetworks(clientId int) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}
	networksList, err := cli.NetworkList(ctx, network.ListOptions{})
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
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}
	inspect, err := cli.NetworkInspect(ctx, newtworkId, network.InspectOptions{Verbose: true})
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
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}
	err = cli.NetworkRemove(ctx, newtworkId)
	if err != nil {
		return err
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) PruneNetworks(clientId int) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}
	report, err := cli.NetworksPrune(ctx, filters.Args{})
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
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}
	report, err := cli.NetworkCreate(ctx, name, options)
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}

	return string(bytesArray), nil
}
