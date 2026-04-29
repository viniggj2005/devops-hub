package models

import (
	"docker-manager-go/src/types"

	"gorm.io/gorm"
)

type SshConnectionModel struct {
	gorm.Model
	Alias          string                `json:"alias"`
	Host           types.EncryptedString `gorm:"type:blob;not null;column:host"`
	SystemUser     string                `json:"systemUser" gorm:"column:system_user"`
	Port           int64                 `json:"port" gorm:"default:22"`
	Key            types.EncryptedString `gorm:"type:blob;column:key"`
	Password       types.EncryptedString `gorm:"type:blob;column:password"`
	KnownHostsData types.EncryptedString `gorm:"type:blob;column:known_hosts_data"`
	UserID         uint
	User           UserModel `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}
