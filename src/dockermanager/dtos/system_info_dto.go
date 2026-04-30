package dockerDtos

type SystemInfoDto struct {
	ID                string `json:"ID"`
	Name              string `json:"Name"`
	NCPU              int    `json:"NCPU"`
	Images            int    `json:"Images"`
	MemTotal          int64  `json:"MemTotal"`
	SystemTime        string `json:"SystemTime"`
	Containers        int    `json:"Containers"`
	Architecture      string `json:"Architecture"`
	ServerVersion     string `json:"ServerVersion"`
	OperatingSystem   string `json:"OperatingSystem"`
	ContainersPaused  int    `json:"ContainersPaused"`
	ContainersStopped int    `json:"ContainersStopped"`
	ContainersRunning int    `json:"ContainersRunning"`
}
