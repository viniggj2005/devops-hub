package models

import (
	"docker-manager-go/src/types"

	"gorm.io/gorm"
)

type GitCredentialModel struct {
	gorm.Model
	Username   string
	Password   types.EncryptedString `gorm:"type:blob;column:password"`
	Passphrase types.EncryptedString `gorm:"type:blob;column:passphrase"`
	PrivateKey types.EncryptedString `gorm:"type:blob;column:private_key"`
	Host       string                `gorm:"not null;uniqueIndex:idx_git_credential_user"`
	UserID     uint                  `gorm:"not null;uniqueIndex:idx_git_credential_user"`
	User       UserModel             `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
