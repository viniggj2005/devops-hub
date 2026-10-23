package cloudSyncFunctions

import (
	"cmp"
	"os"

	"golang.org/x/oauth2"
)

var (
	googleClientID     string
	googleClientSecret string
)

const driveAppDataScope = "https://www.googleapis.com/auth/drive.appdata"

var googleEndpoint = oauth2.Endpoint{
	AuthURL:   "https://accounts.google.com/o/oauth2/v2/auth",
	TokenURL:  "https://oauth2.googleapis.com/token",
	AuthStyle: oauth2.AuthStyleInParams,
}

func clientID() string {
	return cmp.Or(os.Getenv("GOOGLE_CLIENT_ID"), googleClientID)
}

func clientSecret() string {
	return cmp.Or(os.Getenv("GOOGLE_CLIENT_SECRET"), googleClientSecret)
}

func IsConfigured() bool {
	return clientID() != "" && clientSecret() != ""
}

func oauthConfig(redirectURL string) *oauth2.Config {
	return &oauth2.Config{
		Scopes:       []string{driveAppDataScope},
		Endpoint:     googleEndpoint,
		ClientID:     clientID(),
		RedirectURL:  redirectURL,
		ClientSecret: clientSecret(),
	}
}
