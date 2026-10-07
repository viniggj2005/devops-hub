package dockerDtos

type StatsPayloadDto struct {
	ContainerID      string  `json:"containerId"`
	OSType           string  `json:"osType"`
	CPUPercentage    float64 `json:"cpuPercentage"`
	MemoryPercentage float64 `json:"memoryPercentage"`
	MemoryUsage      uint64  `json:"memoryUsage"`
	MemoryLimit      uint64  `json:"memoryLimit"`
	RxBytes          uint64  `json:"rxBytes"`
	TxBytes          uint64  `json:"txBytes"`
	Pids             uint64  `json:"pids"`
	Time             int64   `json:"time"`
}

type CreateDockerConnectionDto struct {
	Alias       string `json:"alias" binding:"required"`
	Description string `json:"description" binding:"required"`
	Url         string `json:"url" binding:"required"`
	Ca          string `json:"ca" binding:"required"`
	Cert        string `json:"cert" binding:"required"`
	Key         string `json:"key" binding:"required"`
	UserID      uint   `json:"userId" binding:"required"`
}
