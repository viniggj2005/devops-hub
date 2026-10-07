package octohubDtos

import (
	"os"
	"path/filepath"

	"docker-manager-go/src/models"
)

type RepositoryDto struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	Exists    bool   `json:"exists"`
	IsCurrent bool   `json:"isCurrent"`
}

type RemoteRepositoryDto struct {
	Fork              bool   `json:"fork"`
	Name              string `json:"name"`
	Owner             string `json:"owner"`
	Private           bool   `json:"private"`
	Archived          bool   `json:"archived"`
	CloneURL          string `json:"cloneUrl"`
	FullName          string `json:"fullName"`
	LocalPath         string `json:"localPath"`
	UpdatedAt         string `json:"updatedAt"`
	Description       string `json:"description"`
	LocalRepositoryID uint   `json:"localRepositoryId"`
}

func ToRepositoryDto(model *models.OctohubModel, currentPath string) *RepositoryDto {
	_, err := os.Stat(model.LocalPath)
	return &RepositoryDto{
		ID:        model.ID,
		Name:      filepath.Base(model.LocalPath),
		Path:      model.LocalPath,
		IsCurrent: currentPath != "" && model.LocalPath == currentPath,
		Exists:    err == nil,
	}
}

func ToRepositoryDtoList(repositories []models.OctohubModel, currentPath string) []RepositoryDto {
	list := make([]RepositoryDto, 0, len(repositories))
	for _, repository := range repositories {
		list = append(list, *ToRepositoryDto(&repository, currentPath))
	}
	return list
}
