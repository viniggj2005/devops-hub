package models

import "gorm.io/gorm"

type ConfigType string

const (
	User   ConfigType = "user"
	Theme  ConfigType = "theme"
	Colors ConfigType = "colors"
)

func (configType ConfigType) IsValid() bool {
	switch configType {
	case User, Theme, Colors:
		return true
	}
	return false
}

type ModuleName string

const (
	Vulpes        ModuleName = "vulpes"
	OctoHub       ModuleName = "octohub"
	FerretShell   ModuleName = "ferretshell"
	DockerManager ModuleName = "docker-manager"
)

func (module ModuleName) IsValid() bool {
	switch module {
	case Vulpes, OctoHub, FerretShell, DockerManager:
		return true
	}
	return false
}

type GeneralConfigsModel struct {
	gorm.Model
	Config     string     `gorm:"type:json;not null"`
	IsActive   bool       `gorm:"not null;default:true"`
	UserID     uint       `gorm:"not null;uniqueIndex:idx_user_module_config"`
	User       UserModel  `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	ConfigType ConfigType `gorm:"type:text;not null;uniqueIndex:idx_user_module_config;check:chk_config_type,config_type IN ('theme','user','colors')"`
	ModuleName ModuleName `gorm:"type:text;not null;uniqueIndex:idx_user_module_config;check:chk_module_name,module_name IN ('docker-manager','ferretshell','octohub','vulpes')"`
}
