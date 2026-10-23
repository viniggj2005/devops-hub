package models

import (
	"time"

	"docker-manager-go/src/types"
)

type VulpesCollectionModel struct {
	ID        uint                  `gorm:"primarykey"`
	Name      string                `gorm:"not null"`
	UserID    uint                  `gorm:"not null;index"`
	User      UserModel             `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Content   types.EncryptedString `gorm:"type:blob;not null"`
	CreatedAt time.Time             `gorm:"not null"`
	UpdatedAt time.Time             `gorm:"not null"`
}
