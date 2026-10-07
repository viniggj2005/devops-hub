package dockerDtos

import (
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

type ContainerCreateOptions struct {
	Config           map[string]interface{} `json:"config"`
	Platform         *v1.Platform           `json:"platform"`
	HostConfig       map[string]interface{} `json:"hostConfig"`
	NetworkingConfig map[string]interface{} `json:"networkingConfig"`
	ContainerName    string                 `json:"containerName"`
}
