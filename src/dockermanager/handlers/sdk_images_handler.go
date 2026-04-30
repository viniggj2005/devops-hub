package dockerHandlers

import (
	"bytes"
	dockerDtos "docker-manager-go/src/dockermanager/dtos"
	dockerFunctions "docker-manager-go/src/dockermanager/functions"
	"encoding/json"
	"fmt"
	"io"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/archive"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (handlerStruct *DockerSdkHandlerStruct) ImageCreate(clientId int, body dockerDtos.ImageCreateDto) error {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return err
	}
	excludes := dockerFunctions.CleanFolderBeforeBuild(body.Path)

	buildContext, err := archive.TarWithOptions(body.Path, &archive.TarOptions{
		ExcludePatterns: excludes,
	})
	if err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}

	if body.Dockerfile == "" {
		body.Dockerfile = "Dockerfile"
	}

	options := types.ImageBuildOptions{
		Dockerfile: body.Dockerfile,
		Tags:       []string{body.Name + ":" + body.Tag},
		Remove:     true,
	}

	res, err := cli.ImageBuild(ctx, buildContext, options)
	if err != nil {
		return &APIError{Code: 500, Message: err.Error()}
	}
	defer res.Body.Close()

	decoder := json.NewDecoder(res.Body)

	for {
		var buildResult struct {
			Stream string `json:"stream"`
			Error  string `json:"error"`
		}

		if err := decoder.Decode(&buildResult); err != nil {
			if err == io.EOF {
				break
			}
			return &APIError{Code: 500, Message: err.Error()}
		}

		if buildResult.Error != "" {
			return &APIError{Code: 500, Message: buildResult.Error}
		}

		if buildResult.Stream != "" {
			runtime.EventsEmit(handlerStruct.appContext, "image:build", map[string]string{
				"clientId": fmt.Sprintf("%d", clientId),
				"log":      buildResult.Stream,
			})
		}
	}

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) ImagesList(clientId int) ([]image.Summary, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return nil, err
	}

	images, err := cli.ImageList(ctx, image.ListOptions{All: false})
	if err != nil {
		return nil, &APIError{Code: 500, Message: err.Error()}
	}

	var filteredImages []image.Summary
	for _, img := range images {
		if len(img.RepoTags) > 0 && img.RepoTags[0] != "<none>:<none>" {
			filteredImages = append(filteredImages, img)
		}
	}

	return filteredImages, nil
}

func (handlerStruct *DockerSdkHandlerStruct) RemoveImage(clientId int, imageId string) ([]image.DeleteResponse, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return nil, err
	}

	removed, err := cli.ImageRemove(ctx, imageId, image.RemoveOptions{Force: true})
	if err != nil {
		return nil, &APIError{Code: 500, Message: err.Error()}
	}

	return removed, nil
}

func (handlerStruct *DockerSdkHandlerStruct) PruneImages(clientId int) (image.PruneReport, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return image.PruneReport{}, err
	}

	pruneFilters := filters.NewArgs()
	pruneFilters.Add("dangling", "false")

	report, err := cli.ImagesPrune(ctx, pruneFilters)
	if err != nil {
		return image.PruneReport{}, &APIError{Code: 500, Message: err.Error()}
	}

	return report, nil
}

func (handlerStruct *DockerSdkHandlerStruct) InspectImage(clientId int, imageId string) (string, error) {
	cli, ctx, err := handlerStruct.CatchClient(clientId)
	if err != nil {
		return "", err
	}

	var raw bytes.Buffer

	_, err = cli.ImageInspect(
		ctx,
		imageId,
		client.ImageInspectWithRawResponse(&raw),
	)
	if err != nil {
		return "bytes.Buffer{}", err
	}

	var pretty bytes.Buffer
	err = json.Indent(&pretty, raw.Bytes(), "", "  ")
	if err != nil {
		return "", err
	}

	return pretty.String(), nil
}
