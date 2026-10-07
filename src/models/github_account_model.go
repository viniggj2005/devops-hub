package models

import (
	"docker-manager-go/src/types"

	"gorm.io/gorm"
)

type GithubAccountModel struct {
	gorm.Model
	GithubID  int64                 `gorm:"not null;uniqueIndex:idx_github_account_user"`
	Login     string                `gorm:"not null"`
	Name      string                `gorm:"column:name"`
	Scope     string                `gorm:"column:scope"`
	AvatarURL string                `gorm:"column:avatar_url"`
	IsActive  bool                  `gorm:"not null;default:false"`
	Token     types.EncryptedString `gorm:"type:blob;not null;column:token"`
	UserID    uint                  `gorm:"not null;uniqueIndex:idx_github_account_user"`
	User      UserModel             `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
