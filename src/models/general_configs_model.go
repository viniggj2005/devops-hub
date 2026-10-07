package models

import "gorm.io/gorm"

type ConfigType string

const (
	Theme ConfigType = "theme"
	User  ConfigType = "user"
)

func (configType ConfigType) IsValid() bool {
	switch configType {
	case Theme, User:
		return true
	}
	return false
}

type ModuleName string

const (
	DockerManager ModuleName = "docker-manager"
	FerretShell   ModuleName = "ferretshell"
	OctoHub       ModuleName = "octohub"
)

func (module ModuleName) IsValid() bool {
	switch module {
	case DockerManager, FerretShell, OctoHub:
		return true
	}
	return false
}

type generalConfigsModel struct {
	gorm.Model
	ModuleName ModuleName `gorm:"type:text;not null;check:chk_module_name,module_name IN ('docker-manager','ferretshell','octohub')"`
	ConfigType ConfigType `gorm:"type:text;not null;check:chk_config_type,config_type IN ('theme','user')"`
	Config     string     `gorm:"type:json;not null"`
}
