package ferretShellHandlers

import (
	"context"
	"os"
	"path/filepath"
)

type LocalFileHandler struct {
	ctx context.Context
}

func NewLocalFileHandler() *LocalFileHandler {
	return &LocalFileHandler{}
}

func (handlerStruct *LocalFileHandler) Startup(ctx context.Context) {
	handlerStruct.ctx = ctx
}

type LocalFileInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"isDir"`
	Path  string `json:"path"`
}

func (handlerStruct *LocalFileHandler) ListLocalFiles(path string) ([]LocalFileInfo, error) {
	if path == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		path = home
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var files []LocalFileInfo
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, LocalFileInfo{
			Name:  entry.Name(),
			Size:  info.Size(),
			IsDir: entry.IsDir(),
			Path:  filepath.Join(path, entry.Name()),
		})
	}
	return files, nil
}

func (handlerStruct *LocalFileHandler) GetHomeDir() (string, error) {
	return os.UserHomeDir()
}
