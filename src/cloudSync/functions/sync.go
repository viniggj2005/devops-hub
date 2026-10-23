package cloudSyncFunctions

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	maxLocalBackups = 5
	restoreTimeout  = 15 * time.Second
	sqliteHeader    = "SQLite format 3\x00"
)

var ErrNotConnected = errors.New("nenhuma conta do Google conectada")

var sidecarSuffixes = []string{"-wal", "-shm"}

func UploadDatabase(ctx context.Context, dataBase *gorm.DB, dataBasePath string, force bool) (bool, error) {
	state, err := LoadState(dataBasePath)
	if err != nil {
		return false, err
	}
	if !state.Connected() {
		return false, ErrNotConnected
	}

	snapshotPath := dataBasePath + ".upload"
	defer os.Remove(snapshotPath)
	if err := snapshotDatabase(ctx, dataBase, snapshotPath); err != nil {
		return false, fmt.Errorf("não foi possível copiar o banco para envio: %w", err)
	}
	hash, err := fileSHA256(snapshotPath)
	if err != nil {
		return false, err
	}
	if !force && hash == state.LastSyncedHash {
		return false, nil
	}

	remote, err := FindRemoteBackup(ctx, state.Token)
	if err != nil {
		return false, err
	}
	remoteID := ""
	if remote != nil {
		remoteID = remote.ID
	}

	syncedAt := time.Now().UTC()
	properties := map[string]string{
		sha256Property:   hash,
		syncedAtProperty: syncedAt.Format(time.RFC3339Nano),
	}
	if err := uploadBackup(ctx, driveHTTPClient(ctx, state.Token), remoteID, snapshotPath, properties); err != nil {
		return false, err
	}

	state.LastSyncedAt, state.LastSyncedHash = syncedAt, hash
	return true, SaveState(dataBasePath, state)
}

func RestoreBeforeOpen(dataBasePath string) (bool, error) {
	state, err := LoadState(dataBasePath)
	if err != nil || !state.Connected() {
		return false, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), restoreTimeout)
	defer cancel()
	remote, err := FindRemoteBackup(ctx, state.Token)
	if err != nil || remote == nil || !remote.SyncedAt.After(state.LastSyncedAt) {
		return false, err
	}

	downloadPath := dataBasePath + ".cloud"
	defer os.Remove(downloadPath)
	if err := downloadBackup(ctx, driveHTTPClient(ctx, state.Token), remote.ID, downloadPath); err != nil {
		return false, fmt.Errorf("não foi possível baixar o backup da nuvem: %w", err)
	}
	if err := verifyBackup(downloadPath, remote.Hash); err != nil {
		return false, err
	}
	if err := backupLocalDatabase(dataBasePath, time.Now()); err != nil {
		return false, fmt.Errorf("não foi possível guardar uma cópia do banco local: %w", err)
	}
	if err := replaceDatabase(dataBasePath, downloadPath); err != nil {
		return false, err
	}

	state.LastSyncedAt, state.LastSyncedHash = remote.SyncedAt, remote.Hash
	return true, SaveState(dataBasePath, state)
}

func snapshotDatabase(ctx context.Context, dataBase *gorm.DB, destination string) error {
	if err := os.Remove(destination); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return dataBase.WithContext(ctx).Exec("VACUUM INTO ?", destination).Error
}

func verifyBackup(path string, expectedHash string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	header := make([]byte, len(sqliteHeader))
	if _, err := io.ReadFull(file, header); err != nil || !bytes.Equal(header, []byte(sqliteHeader)) {
		return errors.New("o backup da nuvem não é um banco SQLite válido")
	}
	if expectedHash == "" {
		return nil
	}
	hash, err := fileSHA256(path)
	if err != nil {
		return err
	}
	if hash != expectedHash {
		return errors.New("o backup da nuvem chegou corrompido")
	}
	return nil
}

func replaceDatabase(dataBasePath string, replacementPath string) error {
	for _, suffix := range sidecarSuffixes {
		if err := os.Remove(dataBasePath + suffix); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return err
		}
	}
	return os.Rename(replacementPath, dataBasePath)
}

func backupLocalDatabase(dataBasePath string, now time.Time) error {
	if _, err := os.Stat(dataBasePath); errors.Is(err, fs.ErrNotExist) {
		return nil
	}

	backupDirectory := filepath.Join(filepath.Dir(dataBasePath), "backups")
	if err := os.MkdirAll(backupDirectory, 0o700); err != nil {
		return err
	}

	baseName := strings.TrimSuffix(filepath.Base(dataBasePath), filepath.Ext(dataBasePath))
	backupPath := filepath.Join(backupDirectory, fmt.Sprintf("%s-%s.db", baseName, now.Format("20060102-150405")))
	for _, suffix := range append([]string{""}, sidecarSuffixes...) {
		if _, err := os.Stat(dataBasePath + suffix); errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err := copyFile(dataBasePath+suffix, backupPath+suffix); err != nil {
			return err
		}
	}
	return pruneBackups(backupDirectory, baseName)
}

func pruneBackups(backupDirectory string, baseName string) error {
	backups, err := filepath.Glob(filepath.Join(backupDirectory, baseName+"-*.db"))
	if err != nil {
		return err
	}
	sort.Sort(sort.Reverse(sort.StringSlice(backups)))
	for _, staleBackup := range backups[min(len(backups), maxLocalBackups):] {
		for _, suffix := range append([]string{""}, sidecarSuffixes...) {
			if err := os.Remove(staleBackup + suffix); err != nil && !errors.Is(err, fs.ErrNotExist) {
				return err
			}
		}
	}
	return nil
}

func copyFile(sourcePath string, destinationPath string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.OpenFile(destinationPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(destination, source)
	return errors.Join(copyErr, destination.Close())
}

func fileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}
