package models

import (
	"gorm.io/gorm"
)

type UserModel struct {
	gorm.Model
	Name     string                   `json:"nome" gorm:"not null"`
	Email    string                   `json:"email" gorm:"uniqueIndex;not null"`
	Password string                   `json:"-" gorm:"uniqueIndex;not null"`
	Docker   []DockerCredentialsModel `gorm:"foreignKey:UserID;references:ID"`
	Ssh      []SshConnectionModel     `gorm:"foreignKey:UserID;references:ID"`
}
