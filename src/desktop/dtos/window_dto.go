package desktopDtos

type TabDropOutcome string

const (
	TabDropAttached TabDropOutcome = "attached"
	TabDropDetached TabDropOutcome = "detached"
	TabDropIgnored  TabDropOutcome = "ignored"
)

type DetachModuleInputDto struct {
	Module  string `json:"module"`
	ScreenX int    `json:"screenX"`
	ScreenY int    `json:"screenY"`
}

type DropModuleInputDto struct {
	Module         string `json:"module"`
	ScreenX        int    `json:"screenX"`
	ScreenY        int    `json:"screenY"`
	AllowNewWindow bool   `json:"allowNewWindow"`
}

type ScreenPointDto struct {
	ScreenX int `json:"screenX"`
	ScreenY int `json:"screenY"`
}

type TabDropResultDto struct {
	Outcome TabDropOutcome `json:"outcome"`
}

type AttachedTabDto struct {
	Module string `json:"module"`
}
