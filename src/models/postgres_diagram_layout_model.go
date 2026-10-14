package models

import "time"

type PostgresDiagramLayoutModel struct {
	ID           uint                    `gorm:"primarykey"`
	Layout       string                  `gorm:"type:json;not null"`
	CreatedAt    time.Time               `gorm:"not null"`
	UpdatedAt    time.Time               `gorm:"not null"`
	SchemaName   string                  `gorm:"not null;uniqueIndex:idx_postgres_diagram_layout"`
	UserID       uint                    `gorm:"not null;uniqueIndex:idx_postgres_diagram_layout"`
	DatabaseName string                  `gorm:"not null;uniqueIndex:idx_postgres_diagram_layout"`
	ConnectionID uint                    `gorm:"not null;uniqueIndex:idx_postgres_diagram_layout"`
	User         UserModel               `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Connection   PostgresConnectionModel `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
