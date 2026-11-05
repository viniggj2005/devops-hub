package models

import "time"

type TalpadbSavedQueryModel struct {
	ID           uint      `gorm:"primaryKey"`
	Name         string    `gorm:"size:255;not null"`
	Sql          string    `gorm:"type:text;not null"`
	Variables    string    `gorm:"type:text;not null"`
	DatabaseName string    `gorm:"size:255;not null;index:idx_talpadb_saved_query_scope"`
	UserID       uint      `gorm:"not null;index:idx_talpadb_saved_query_scope"`
	ConnectionID uint      `gorm:"not null;index:idx_talpadb_saved_query_scope"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

