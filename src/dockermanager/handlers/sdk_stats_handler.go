package dockerHandlers

import (
	"context"
	"docker-manager-go/src/desktop"
	dockerDtos "docker-manager-go/src/dockermanager/dtos"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

func (handlerStruct *DockerSdkHandlerStruct) StartContainerStats(ctx context.Context, clientId int, containerID string) error {
	dockerId := fmt.Sprintf("%d", clientId)
	windowName := desktop.CallingWindowName(ctx)
	streamKey := desktop.ScopedKey(windowName, containerID)

	dockerClient, baseContext, err := handlerStruct.catchClient(clientId)
	if err != nil {
		return err
	}

	handlerStruct.mutex.Lock()

	if handlerStruct.statsCancel[dockerId] == nil {
		handlerStruct.statsCancel[dockerId] = make(map[string]context.CancelFunc)
	}

	if oldCancel, ok := handlerStruct.statsCancel[dockerId][streamKey]; ok {
		oldCancel()
	}

	streamContext, cancel := context.WithCancel(baseContext)
	handlerStruct.statsCancel[dockerId][streamKey] = cancel

	handlerStruct.mutex.Unlock()

	go handlerStruct.streamStats(streamContext, dockerClient, containerID, windowName)

	return nil
}

func (handlerStruct *DockerSdkHandlerStruct) streamStats(ctx context.Context, dockerClient *client.Client, containerID string, windowName string) {
	stats, err := dockerClient.ContainerStats(ctx, containerID, true)
	if err != nil {
		desktop.EmitToWindow(windowName, "container:stats:error", map[string]string{
			"containerId": containerID,
			"error":       err.Error(),
		})
		return
	}
	defer stats.Body.Close()

	decoder := json.NewDecoder(stats.Body)

	for {
		select {
		case <-ctx.Done():
			return
		default:
			var body container.StatsResponse
			if err := decoder.Decode(&body); err != nil {
				if err == io.EOF || ctx.Err() != nil {
					return
				}
				desktop.EmitToWindow(windowName, "container:stats:error", map[string]string{
					"containerId": containerID,
					"error":       err.Error(),
				})
				return
			}

			payload := dockerDtos.StatsPayloadDto{
				ContainerID:      containerID,
				OSType:           "",
				CPUPercentage:    cpuPercent(&body),
				MemoryPercentage: memPercent(&body),
				MemoryUsage:      memUsage(&body),
				MemoryLimit:      body.MemoryStats.Limit,
				RxBytes:          sumRx(&body),
				TxBytes:          sumTx(&body),
				Pids:             body.PidsStats.Current,
				Time:             time.Now().UnixMilli(),
			}

			desktop.EmitToWindow(windowName, "container:stats", payload)
		}
	}
}

func (handlerStruct *DockerSdkHandlerStruct) StopContainerStats(ctx context.Context, clientId int, containerID string) error {
	dockerId := fmt.Sprintf("%d", clientId)
	windowName := desktop.CallingWindowName(ctx)
	streamKey := desktop.ScopedKey(windowName, containerID)

	handlerStruct.mutex.Lock()
	defer handlerStruct.mutex.Unlock()

	cancelsMap := handlerStruct.statsCancel[dockerId]
	if cancelsMap == nil {
		return nil
	}

	if cancel, ok := cancelsMap[streamKey]; ok {
		cancel()
		delete(cancelsMap, streamKey)

		desktop.EmitToWindow(windowName, "container:stats:stopped", map[string]string{
			"containerId": containerID,
		})
	}

	return nil
}

func cpuPercent(body *container.StatsResponse) float64 {
	cpuDelta := float64(body.CPUStats.CPUUsage.TotalUsage - body.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(body.CPUStats.SystemUsage - body.PreCPUStats.SystemUsage)
	if cpuDelta <= 0 || sysDelta <= 0 {
		return 0
	}

	numberOfCpus := float64(body.CPUStats.OnlineCPUs)
	if numberOfCpus == 0 {
		numberOfCpus = float64(len(body.CPUStats.CPUUsage.PercpuUsage))
		if numberOfCpus == 0 {
			numberOfCpus = 1
		}
	}

	return (cpuDelta / sysDelta) * numberOfCpus * 100.0
}

func memUsage(body *container.StatsResponse) uint64 {
	if body.MemoryStats.Stats != nil {
		if cache, ok := body.MemoryStats.Stats["cache"]; ok && body.MemoryStats.Usage >= cache {
			return body.MemoryStats.Usage - cache
		}
	}
	return body.MemoryStats.Usage
}

func memPercent(body *container.StatsResponse) float64 {
	usage := float64(memUsage(body))
	limit := float64(body.MemoryStats.Limit)
	if limit == 0 {
		return 0
	}
	return (usage / limit) * 100.0
}

func sumRx(body *container.StatsResponse) uint64 {
	var total uint64
	for _, network := range body.Networks {
		total += network.RxBytes
	}
	return total
}

func sumTx(body *container.StatsResponse) uint64 {
	var total uint64
	for _, network := range body.Networks {
		total += network.TxBytes
	}
	return total
}
