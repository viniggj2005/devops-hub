package talpadbHandlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
)

const maxSqlFileSize = 20 * 1024 * 1024

var fileFilters = map[string]runtime.FileFilter{
	".sql":  {DisplayName: "Arquivos SQL (*.sql)", Pattern: "*.sql"},
	".csv":  {DisplayName: "CSV (*.csv)", Pattern: "*.csv"},
	".json": {DisplayName: "JSON (*.json)", Pattern: "*.json"},
	".svg":  {DisplayName: "Imagem SVG (*.svg)", Pattern: "*.svg"},
}

var allFilesFilter = runtime.FileFilter{DisplayName: "Todos os arquivos (*.*)", Pattern: "*.*"}

var sqliteFilesFilter = runtime.FileFilter{DisplayName: "Bancos SQLite (*.db, *.sqlite, *.sqlite3, *.db3)", Pattern: "*.db;*.sqlite;*.sqlite3;*.db3"}

func (handlerStruct *TalpadbClientHandlerStruct) ChooseSqliteFile(token string) (string, error) {
	if _, err := handlerStruct.talpadb.authenticate(token); err != nil {
		return "", err
	}
	return runtime.OpenFileDialog(handlerStruct.context, runtime.OpenDialogOptions{
		Title:   "Selecionar banco SQLite",
		Filters: []runtime.FileFilter{sqliteFilesFilter, allFilesFilter},
	})
}

func (handlerStruct *TalpadbClientHandlerStruct) OpenSqlFile(token string) (*talpadbDtos.SqlFileDto, error) {
	if _, err := handlerStruct.talpadb.authenticate(token); err != nil {
		return nil, err
	}

	path, err := runtime.OpenFileDialog(handlerStruct.context, runtime.OpenDialogOptions{
		Title:   "Abrir arquivo SQL",
		Filters: []runtime.FileFilter{fileFilters[".sql"], allFilesFilter},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return nil, nil
	}

	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > maxSqlFileSize {
		return nil, fmt.Errorf("arquivo muito grande (%d MB); o limite é 20 MB", info.Size()/1024/1024)
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return &talpadbDtos.SqlFileDto{Path: path, Name: filepath.Base(path), Content: string(content)}, nil
}

// SaveTextFile abre o diálogo de salvar e grava o conteúdo; devolve "" se o usuário cancelar.
func (handlerStruct *TalpadbClientHandlerStruct) SaveTextFile(token string, defaultFilename string, content string) (string, error) {
	if _, err := handlerStruct.talpadb.authenticate(token); err != nil {
		return "", err
	}

	extension := strings.ToLower(filepath.Ext(defaultFilename))
	filters := []runtime.FileFilter{allFilesFilter}
	if filter, ok := fileFilters[extension]; ok {
		filters = []runtime.FileFilter{filter, allFilesFilter}
	}

	path, err := runtime.SaveFileDialog(handlerStruct.context, runtime.SaveDialogOptions{
		Title:           "Salvar arquivo",
		DefaultFilename: defaultFilename,
		Filters:         filters,
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	if filepath.Ext(path) == "" && extension != "" {
		path += extension
	}

	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", err
	}
	return path, nil
}
