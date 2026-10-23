package cloudSyncFunctions

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/oauth2"
)

type SyncState struct {
	Token          *oauth2.Token `json:"token,omitempty"`
	AccountEmail   string        `json:"accountEmail,omitempty"`
	LastSyncedAt   time.Time     `json:"lastSyncedAt"`
	LastSyncedHash string        `json:"lastSyncedHash,omitempty"`
}

func (state SyncState) Connected() bool {
	return state.Token != nil
}

func statePath(dataBasePath string) string {
	return filepath.Join(filepath.Dir(dataBasePath), "cloud-sync.json")
}

func LoadState(dataBasePath string) (SyncState, error) {
	var state SyncState
	content, err := os.ReadFile(statePath(dataBasePath))
	if errors.Is(err, fs.ErrNotExist) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	return state, json.Unmarshal(content, &state)
}

func SaveState(dataBasePath string, state SyncState) error {
	content, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	temporaryPath := statePath(dataBasePath) + ".tmp"
	if err := os.WriteFile(temporaryPath, content, 0o600); err != nil {
		return err
	}
	return os.Rename(temporaryPath, statePath(dataBasePath))
}

func ClearState(dataBasePath string) error {
	if err := os.Remove(statePath(dataBasePath)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}
