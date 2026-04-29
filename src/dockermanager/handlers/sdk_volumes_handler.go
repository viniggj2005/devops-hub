package dockerHandlers

import (
	"encoding/json"

	"github.com/docker/docker/api/types/volume"
)

func (handlerStruct *DockerSdkHandlerStruct) ListVolumes(clientId int) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}
	volumesList, err := cli.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(volumesList, "", "  ")
	if err != nil {
		return "", err
	}

	return string(bytesArray), nil
}

func (handlerStruct *DockerSdkHandlerStruct) DeleteVolume(clientId int, volumeId string) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}

	err = cli.VolumeRemove(ctx, volumeId, true)
	if err != nil {
		return err
	}
	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) CreateVolume(clientId int, options volume.CreateOptions) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}
	volume, err := cli.VolumeCreate(ctx, options)

	if err != nil {
		return "", err
	}
	bytesarray, err := json.MarshalIndent(volume, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytesarray), nil

}

func (handlerStruct *DockerSdkHandlerStruct) InspectVolume(clientId int, volumeId string) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}
	volumeInspect, err := cli.VolumeInspect(ctx, volumeId)
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(volumeInspect, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytesArray), nil
}
