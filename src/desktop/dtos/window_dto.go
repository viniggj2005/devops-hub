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
	Handoff string `json:"handoff"`
}

type DropModuleInputDto struct {
	Module         string `json:"module"`
	ScreenX        int    `json:"screenX"`
	ScreenY        int    `json:"screenY"`
	Handoff        string `json:"handoff"`
	AllowNewWindow bool   `json:"allowNewWindow"`
}

type MoveModuleInputDto struct {
	Module  string `json:"module"`
	Handoff string `json:"handoff"`
}

type ScreenPointDto struct {
	ScreenX int `json:"screenX"`
	ScreenY int `json:"screenY"`
}

type TabDropResultDto struct {
	Outcome TabDropOutcome `json:"outcome"`
}

type AttachedTabDto struct {
	Module  string `json:"module"`
	Handoff string `json:"handoff,omitempty"`
}
