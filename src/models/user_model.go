package models

import (
	"gorm.io/gorm"
)

type Language string

const (
	English          Language = "en-US"
	Spanish          Language = "es-ES"
	PortugueseBrazil Language = "pt-BR"
	DefaultLanguage           = PortugueseBrazil
)

func (language Language) IsValid() bool {
	switch language {
	case English, Spanish, PortugueseBrazil:
		return true
	}
	return false
}

type UserModel struct {
	gorm.Model
	Name               string                   `json:"nome" gorm:"not null"`
	Email              string                   `json:"email" gorm:"uniqueIndex;not null"`
	Password           string                   `json:"-" gorm:"uniqueIndex;not null"`
	Language           Language                 `json:"language" gorm:"type:text;not null;default:'pt-BR'"`
	Docker             []DockerCredentialsModel `gorm:"foreignKey:UserID;references:ID"`
	Ssh                []SshConnectionModel     `gorm:"foreignKey:UserID;references:ID"`
	TalpadbConnections []TalpadbConnectionModel `gorm:"foreignKey:UserID;references:ID"`
}
