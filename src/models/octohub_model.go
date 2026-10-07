package models

import (
	"time"

	"gorm.io/gorm"
)

type OctohubModel struct {
	gorm.Model
	LastOpenedAt time.Time
	GithubID     int64     `gorm:"not null;default:0;index"`
	UserID       uint      `gorm:"uniqueIndex:idx_octohub_repository_user"`
	User         UserModel `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	LocalPath    string    `gorm:"not null;uniqueIndex:idx_octohub_repository_user"`
}
