package vulpesFunctions

import (
	"encoding/base64"
	"strings"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

type AuthEntries struct {
	Query   []vulpesDtos.HeaderDto
	Headers []vulpesDtos.HeaderDto
}

func EffectiveAuth(content *vulpesDtos.CollectionContentDto, itemID string, requestAuth vulpesDtos.AuthDto) vulpesDtos.AuthDto {
	if requestAuth.Type != vulpesDtos.AuthInherit {
		return requestAuth
	}
	if content == nil {
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
	}

	ancestors, _ := ItemAncestors(content.Items, itemID)
	for position := len(ancestors) - 1; position >= 0; position-- {
		folderAuth := ancestors[position].Auth
		if folderAuth != nil && folderAuth.Type != vulpesDtos.AuthInherit {
			return *folderAuth
		}
	}
	if content.Auth.Type == vulpesDtos.AuthInherit {
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthNone}
	}
	return content.Auth
}

func BuildAuthEntries(auth vulpesDtos.AuthDto) AuthEntries {
	var entries AuthEntries
	switch auth.Type {
	case vulpesDtos.AuthBearer:
		if token := strings.TrimSpace(auth.Token); token != "" {
			entries.Headers = append(entries.Headers, vulpesDtos.HeaderDto{Key: "Authorization", Value: "Bearer " + token})
		}
	case vulpesDtos.AuthBasic:
		if auth.Username == "" && auth.Password == "" {
			break
		}
		credentials := base64.StdEncoding.EncodeToString([]byte(auth.Username + ":" + auth.Password))
		entries.Headers = append(entries.Headers, vulpesDtos.HeaderDto{Key: "Authorization", Value: "Basic " + credentials})
	case vulpesDtos.AuthApiKey:
		key := strings.TrimSpace(auth.Key)
		if key == "" {
			break
		}
		entry := vulpesDtos.HeaderDto{Key: key, Value: auth.Value}
		if auth.Location == "query" {
			entries.Query = append(entries.Query, entry)
		} else {
			entries.Headers = append(entries.Headers, entry)
		}
	}
	return entries
}
