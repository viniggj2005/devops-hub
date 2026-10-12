package models

import "gorm.io/gorm"

type ThemeProfileModel struct {
	gorm.Model
	Name   string    `gorm:"type:text;not null;uniqueIndex:idx_user_theme_profile_name"`
	Config string    `gorm:"type:json;not null"`
	UserID uint      `gorm:"not null;uniqueIndex:idx_user_theme_profile_name"`
	User   UserModel `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
