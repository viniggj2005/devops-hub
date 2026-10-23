package cloudSyncFunctions

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

type fakeDrive struct {
	mutex             sync.Mutex
	fileID            string
	content           []byte
	properties        map[string]string
	pendingProperties map[string]string
}

func (drive *fakeDrive) handler(test *testing.T, serverURL func() string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/drive/v3/files", func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer test-access" {
			test.Errorf("expected the Google token on the request, got %q", request.Header.Get("Authorization"))
		}
		drive.mutex.Lock()
		defer drive.mutex.Unlock()
		files := []driveFile{}
		if drive.fileID != "" {
			files = append(files, driveFile{ID: drive.fileID, AppProperties: drive.properties})
		}
		json.NewEncoder(writer).Encode(map[string]any{"files": files})
	})
	mux.HandleFunc("/drive/v3/files/", func(writer http.ResponseWriter, request *http.Request) {
		drive.mutex.Lock()
		defer drive.mutex.Unlock()
		writer.Write(drive.content)
	})
	startUpload := func(writer http.ResponseWriter, request *http.Request) {
		var metadata struct {
			AppProperties map[string]string `json:"appProperties"`
		}
		json.NewDecoder(request.Body).Decode(&metadata)
		drive.mutex.Lock()
		drive.pendingProperties = metadata.AppProperties
		drive.mutex.Unlock()
		writer.Header().Set("Location", serverURL()+"/session")
	}
	mux.HandleFunc("/upload/drive/v3/files", startUpload)
	mux.HandleFunc("/upload/drive/v3/files/", startUpload)
	mux.HandleFunc("/session", func(writer http.ResponseWriter, request *http.Request) {
		content, _ := io.ReadAll(request.Body)
		drive.mutex.Lock()
		defer drive.mutex.Unlock()
		if drive.fileID == "" {
			drive.fileID = "file-1"
		}
		drive.content, drive.properties = content, drive.pendingProperties
		json.NewEncoder(writer).Encode(map[string]string{"id": drive.fileID})
	})
	return mux
}

func (drive *fakeDrive) publish(content []byte, syncedAt time.Time, hash string) {
	drive.mutex.Lock()
	defer drive.mutex.Unlock()
	drive.fileID, drive.content = "file-1", content
	drive.properties = map[string]string{sha256Property: hash, syncedAtProperty: syncedAt.Format(time.RFC3339Nano)}
}

func useFakeDrive(test *testing.T) *fakeDrive {
	drive := &fakeDrive{}
	var server *httptest.Server
	server = httptest.NewServer(drive.handler(test, func() string { return server.URL }))
	originalFilesURL, originalUploadURL := driveFilesURL, driveUploadURL
	driveFilesURL, driveUploadURL = server.URL+"/drive/v3/files", server.URL+"/upload/drive/v3/files"
	test.Cleanup(func() {
		server.Close()
		driveFilesURL, driveUploadURL = originalFilesURL, originalUploadURL
	})
	return drive
}

func openTestDatabase(test *testing.T, path string) *gorm.DB {
	dataBase, err := gorm.Open(sqlite.Open("file:"+path+"?_journal_mode=WAL"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening database: %v", err)
	}
	if err := dataBase.Exec("CREATE TABLE IF NOT EXISTS notes (text TEXT)").Error; err != nil {
		test.Fatalf("unexpected error creating table: %v", err)
	}
	return dataBase
}

func closeTestDatabase(test *testing.T, dataBase *gorm.DB) {
	connection, err := dataBase.DB()
	if err != nil {
		test.Fatalf("unexpected error reading connection: %v", err)
	}
	connection.Close()
}

func readNotes(test *testing.T, path string) []string {
	dataBase := openTestDatabase(test, path)
	defer closeTestDatabase(test, dataBase)
	var notes []string
	if err := dataBase.Raw("SELECT text FROM notes ORDER BY text").Scan(&notes).Error; err != nil {
		test.Fatalf("unexpected error reading notes: %v", err)
	}
	return notes
}

func connectTestAccount(test *testing.T, dataBasePath string) {
	token := &oauth2.Token{AccessToken: "test-access", RefreshToken: "test-refresh", Expiry: time.Now().Add(time.Hour)}
	if err := SaveState(dataBasePath, SyncState{Token: token, AccountEmail: "dev@example.com"}); err != nil {
		test.Fatalf("unexpected error saving state: %v", err)
	}
}

func TestUploadAndRestoreRoundTrip(test *testing.T) {
	drive := useFakeDrive(test)
	directory := test.TempDir()
	dataBasePath := filepath.Join(directory, "secure.db")
	dataBase := openTestDatabase(test, dataBasePath)
	dataBase.Exec("INSERT INTO notes (text) VALUES ('local')")

	if _, err := UploadDatabase(context.Background(), dataBase, dataBasePath, false); err != ErrNotConnected {
		test.Fatalf("expected an upload without account to fail with ErrNotConnected, got %v", err)
	}
	connectTestAccount(test, dataBasePath)

	uploaded, err := UploadDatabase(context.Background(), dataBase, dataBasePath, false)
	if err != nil || !uploaded || drive.fileID == "" {
		test.Fatalf("expected the first upload to create the backup, uploaded=%v err=%v", uploaded, err)
	}
	firstHash := drive.properties[sha256Property]
	if uploaded, err = UploadDatabase(context.Background(), dataBase, dataBasePath, false); err != nil || uploaded {
		test.Fatalf("expected an unchanged database not to be uploaded again, uploaded=%v err=%v", uploaded, err)
	}

	dataBase.Exec("INSERT INTO notes (text) VALUES ('second')")
	if uploaded, err = UploadDatabase(context.Background(), dataBase, dataBasePath, false); err != nil || !uploaded {
		test.Fatalf("expected a changed database to be uploaded, uploaded=%v err=%v", uploaded, err)
	}
	if drive.properties[sha256Property] == firstHash {
		test.Fatalf("expected the cloud backup to be replaced by the new version")
	}
	if restored, err := RestoreBeforeOpen(dataBasePath); err != nil || restored {
		test.Fatalf("expected our own upload not to trigger a restore, restored=%v err=%v", restored, err)
	}
	closeTestDatabase(test, dataBase)

	otherMachinePath := filepath.Join(directory, "other-machine.db")
	otherMachine := openTestDatabase(test, otherMachinePath)
	otherMachine.Exec("INSERT INTO notes (text) VALUES ('from another machine')")
	cloudSnapshotPath := filepath.Join(directory, "cloud-snapshot.db")
	if err := snapshotDatabase(context.Background(), otherMachine, cloudSnapshotPath); err != nil {
		test.Fatalf("unexpected error creating cloud snapshot: %v", err)
	}
	closeTestDatabase(test, otherMachine)
	cloudContent, _ := os.ReadFile(cloudSnapshotPath)
	cloudHash := sha256.Sum256(cloudContent)
	newerSyncedAt := time.Now().Add(time.Minute).UTC()
	drive.publish(cloudContent, newerSyncedAt, hex.EncodeToString(cloudHash[:]))

	restored, err := RestoreBeforeOpen(dataBasePath)
	if err != nil || !restored {
		test.Fatalf("expected a newer cloud backup to be restored, restored=%v err=%v", restored, err)
	}
	if notes := readNotes(test, dataBasePath); len(notes) != 1 || notes[0] != "from another machine" {
		test.Fatalf("expected the restored database to hold the cloud notes, got %v", notes)
	}
	backups, _ := filepath.Glob(filepath.Join(directory, "backups", "secure-*.db"))
	if len(backups) != 1 {
		test.Fatalf("expected the previous local database to be kept as a backup, got %v", backups)
	}
	if notes := readNotes(test, backups[0]); len(notes) != 2 {
		test.Fatalf("expected the backup to keep the local notes, got %v", notes)
	}

	state, _ := LoadState(dataBasePath)
	if !state.LastSyncedAt.Equal(newerSyncedAt) {
		test.Fatalf("expected the sync state to follow the restored backup, got %v", state.LastSyncedAt)
	}
	if restored, err := RestoreBeforeOpen(dataBasePath); err != nil || restored {
		test.Fatalf("expected the same backup not to be restored twice, restored=%v err=%v", restored, err)
	}
}

func TestRestoreRejectsCorruptedBackup(test *testing.T) {
	drive := useFakeDrive(test)
	dataBasePath := filepath.Join(test.TempDir(), "secure.db")
	dataBase := openTestDatabase(test, dataBasePath)
	dataBase.Exec("INSERT INTO notes (text) VALUES ('local')")
	closeTestDatabase(test, dataBase)
	connectTestAccount(test, dataBasePath)

	drive.publish([]byte(sqliteHeader+"truncated"), time.Now().UTC(), strings.Repeat("0", 64))
	if restored, err := RestoreBeforeOpen(dataBasePath); err == nil || restored {
		test.Fatalf("expected a corrupted backup to be rejected, restored=%v err=%v", restored, err)
	}
	drive.publish([]byte("not a database"), time.Now().UTC(), "")
	if restored, err := RestoreBeforeOpen(dataBasePath); err == nil || restored {
		test.Fatalf("expected a non SQLite backup to be rejected, restored=%v err=%v", restored, err)
	}
	if notes := readNotes(test, dataBasePath); len(notes) != 1 || notes[0] != "local" {
		test.Fatalf("expected the local database to stay untouched, got %v", notes)
	}
}

func TestPruneBackupsKeepsNewest(test *testing.T) {
	directory := test.TempDir()
	dataBasePath := filepath.Join(directory, "secure.db")
	os.WriteFile(dataBasePath, []byte(sqliteHeader), 0o600)
	os.WriteFile(dataBasePath+"-wal", []byte("wal"), 0o600)

	start := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	for offset := range maxLocalBackups + 2 {
		if err := backupLocalDatabase(dataBasePath, start.Add(time.Duration(offset)*time.Minute)); err != nil {
			test.Fatalf("unexpected error creating backup: %v", err)
		}
	}

	backups, _ := filepath.Glob(filepath.Join(directory, "backups", "secure-*.db"))
	walBackups, _ := filepath.Glob(filepath.Join(directory, "backups", "secure-*.db-wal"))
	if len(backups) != maxLocalBackups || len(walBackups) != maxLocalBackups {
		test.Fatalf("expected %d backups with their WAL, got %d and %d", maxLocalBackups, len(backups), len(walBackups))
	}
	if strings.Contains(strings.Join(backups, ","), "secure-20260101-100000.db") {
		test.Fatalf("expected the oldest backup to be pruned, got %v", backups)
	}
}

func TestParseCallback(test *testing.T) {
	cases := []struct {
		query     url.Values
		expectErr bool
	}{
		{query: url.Values{"state": {"expected"}, "code": {"auth-code"}}},
		{query: url.Values{"state": {"forged"}, "code": {"auth-code"}}, expectErr: true},
		{query: url.Values{"state": {"expected"}}, expectErr: true},
		{query: url.Values{"error": {"access_denied"}}, expectErr: true},
	}
	for _, testCase := range cases {
		result := parseCallback(testCase.query, "expected")
		if (result.err != nil) != testCase.expectErr {
			test.Fatalf("unexpected callback result for %v: %+v", testCase.query, result)
		}
		if !testCase.expectErr && result.code != "auth-code" {
			test.Fatalf("expected the authorization code, got %q", result.code)
		}
	}
}

func TestStateLifecycle(test *testing.T) {
	dataBasePath := filepath.Join(test.TempDir(), "secure.db")
	if state, err := LoadState(dataBasePath); err != nil || state.Connected() {
		test.Fatalf("expected an empty state without file, got %+v err=%v", state, err)
	}
	connectTestAccount(test, dataBasePath)
	if state, err := LoadState(dataBasePath); err != nil || !state.Connected() || state.Token.RefreshToken != "test-refresh" {
		test.Fatalf("expected the saved token to load back, got %+v err=%v", state, err)
	}
	if err := ClearState(dataBasePath); err != nil {
		test.Fatalf("unexpected error clearing state: %v", err)
	}
	if state, _ := LoadState(dataBasePath); state.Connected() {
		test.Fatalf("expected the state to be cleared")
	}
}
