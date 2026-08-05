package models

import "gorm.io/gorm"

type OctohubModel struct {
	gorm.Model
	LocalPath string `gorm:"not null"`
	UserID    uint
	User      UserModel `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}
