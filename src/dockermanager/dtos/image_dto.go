package dockerDtos

type ImageCreateDto struct {
	Path       string `json:"path" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Tag        string `json:"tag" binding:"required"`
	Dockerfile string `json:"dockerfile"`
}
