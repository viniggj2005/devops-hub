package dockerHandlers

import (
	"encoding/json"

	"github.com/docker/docker/api/types/volume"
)

func (handlerStruct *DockerSdkHandlerStruct) ListVolumes(clientId int) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}
	volumesList, err := dockerClient.VolumeList(ctx, volume.ListOptions{})
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
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	err = dockerClient.VolumeRemove(ctx, volumeId, true)
	if err != nil {
		return err
	}
	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) CreateVolume(clientId int, options volume.CreateOptions) (string, error) {
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}
	volume, err := dockerClient.VolumeCreate(ctx, options)

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
	dockerClient, ctx, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return "", err
	}
	volumeInspect, err := dockerClient.VolumeInspect(ctx, volumeId)
	if err != nil {
		return "", err
	}

	bytesArray, err := json.MarshalIndent(volumeInspect, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytesArray), nil
}
