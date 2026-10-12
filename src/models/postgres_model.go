package models

import (
	"docker-manager-go/src/types"

	"gorm.io/gorm"
)

type PostgresConnectionModel struct {
	gorm.Model
	Alias    string                `gorm:"column:alias"`
	Host     types.EncryptedString `gorm:"type:blob;not null;column:host"`
	Port     int64                 `gorm:"column:port;default:5432"`
	Database string                `gorm:"column:database_name;default:postgres"`
	Username string                `gorm:"column:username"`
	Password types.EncryptedString `gorm:"type:blob;column:password"`
	SslMode  string                `gorm:"column:ssl_mode;default:prefer"`
	UserID   uint
	User     UserModel `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}
