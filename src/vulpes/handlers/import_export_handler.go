package vulpesHandlers

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"

	"docker-manager-go/src/desktop"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const maxImportFileBytes = 50 << 20

var (
	jsonFilesFilter   = desktop.FileFilter{DisplayName: "Arquivos JSON (*.json)", Pattern: "*.json"}
	allFilesFilter    = desktop.FileFilter{DisplayName: "Todos os arquivos (*.*)", Pattern: "*.*"}
	importFilesFilter = desktop.FileFilter{DisplayName: "Postman e Insomnia (*.json, *.yaml, *.yml)", Pattern: "*.json;*.yaml;*.yml"}
	invalidFileChars  = strings.NewReplacer("<", "_", ">", "_", ":", "_", `"`, "_", "/", "_", `\`, "_", "|", "_", "?", "_", "*", "_")
)

var errUnknownExportFormat = errors.New("formato de exportação desconhecido; use postman ou insomnia")

func (handlerStruct *VulpesHandlerStruct) ImportFromFiles(callContext context.Context, token string) (*vulpesDtos.ImportResultDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	paths, err := desktop.ChooseFiles(callContext, desktop.FileDialogOptions{
		Title:   "Importar coleções e ambientes do Postman ou do Insomnia",
		Filters: []desktop.FileFilter{importFilesFilter, allFilesFilter},
	})
	if err != nil {
		return nil, err
	}
	if len(paths) == 0 {
		return emptyImportResult(), nil
	}

	combined := &vulpesFunctions.ImportedData{}
	failures := []string{}
	for _, path := range paths {
		imported, err := readImportFile(path)
		if err != nil {
			failures = append(failures, err.Error())
			continue
		}
		mergeImport(combined, imported, filepath.Base(path), len(paths) > 1)
	}
	if len(combined.Collections) == 0 && len(combined.Environments) == 0 {
		return nil, errors.New(strings.Join(failures, "\n"))
	}
	combined.Warnings = append(failures, combined.Warnings...)
	return handlerStruct.persistImport(userID, combined)
}

func (handlerStruct *VulpesHandlerStruct) ImportFromText(token string, content string) (*vulpesDtos.ImportResultDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(content) == "" {
		return nil, errors.New("cole o conteúdo exportado do Postman ou do Insomnia (JSON ou YAML)")
	}
	if len(content) > maxImportFileBytes {
		return nil, fmt.Errorf("o conteúdo ultrapassa o limite de %d MB", maxImportFileBytes>>20)
	}
	imported, err := vulpesFunctions.ParseImportFile([]byte(content), "O conteúdo colado")
	if err != nil {
		return nil, err
	}
	return handlerStruct.persistImport(userID, imported)
}

func readImportFile(path string) (*vulpesFunctions.ImportedData, error) {
	name := filepath.Base(path)
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", name, err)
	}
	if info.Size() > maxImportFileBytes {
		return nil, fmt.Errorf("%s ultrapassa o limite de %d MB", name, maxImportFileBytes>>20)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", name, err)
	}
	return vulpesFunctions.ParseImportFile(content, name)
}

func mergeImport(combined *vulpesFunctions.ImportedData, imported *vulpesFunctions.ImportedData, sourceName string, prefixWarnings bool) {
	combined.Collections = append(combined.Collections, imported.Collections...)
	combined.Environments = append(combined.Environments, imported.Environments...)
	for _, warning := range imported.Warnings {
		if prefixWarnings {
			warning = sourceName + ": " + warning
		}
		combined.Warnings = append(combined.Warnings, warning)
	}
}

func emptyImportResult() *vulpesDtos.ImportResultDto {
	return &vulpesDtos.ImportResultDto{
		Warnings:     []string{},
		Collections:  []vulpesDtos.CollectionDto{},
		Environments: []vulpesDtos.EnvironmentDto{},
	}
}

func (handlerStruct *VulpesHandlerStruct) persistImport(userID uint, imported *vulpesFunctions.ImportedData) (*vulpesDtos.ImportResultDto, error) {
	result := emptyImportResult()
	result.Warnings = append(result.Warnings, imported.Warnings...)

	err := handlerStruct.database().Transaction(func(transaction *gorm.DB) error {
		for _, collection := range imported.Collections {
			name, err := validateName(collection.Name, "coleção")
			if err != nil {
				return err
			}
			created, err := handlerStruct.createCollection(transaction, userID, name, collection.Content)
			if err != nil {
				return err
			}
			result.Collections = append(result.Collections, *created)
		}
		for _, environment := range imported.Environments {
			created, err := handlerStruct.createEnvironment(transaction, userID, environment)
			if err != nil {
				return err
			}
			result.Environments = append(result.Environments, *created)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (handlerStruct *VulpesHandlerStruct) ExportCollection(callContext context.Context, token string, collectionID uint, format string) (*vulpesDtos.ExportResultDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	collection, content, err := loadCollection(handlerStruct.database(), userID, collectionID)
	if err != nil {
		return nil, err
	}

	var exported []byte
	var warnings []string
	var defaultFilename string
	switch format {
	case vulpesDtos.ExportFormatPostman:
		defaultFilename = collection.Name + ".postman_collection.json"
		exported, err = vulpesFunctions.ExportPostmanCollection(collection.Name, content)
	case vulpesDtos.ExportFormatInsomnia:
		defaultFilename = collection.Name + ".insomnia.json"
		exported, warnings, err = vulpesFunctions.ExportInsomniaCollection(collection.Name, content)
	default:
		return nil, errUnknownExportFormat
	}
	if err != nil {
		return nil, err
	}
	return saveExport(callContext, "Exportar coleção", defaultFilename, exported, warnings)
}

func (handlerStruct *VulpesHandlerStruct) ExportEnvironment(callContext context.Context, token string, environmentID uint, format string) (*vulpesDtos.ExportResultDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	environment, variables, err := loadEnvironment(handlerStruct.database(), userID, environmentID)
	if err != nil {
		return nil, err
	}

	var exported []byte
	var warnings []string
	var defaultFilename string
	switch format {
	case vulpesDtos.ExportFormatPostman:
		defaultFilename = environment.Name + ".postman_environment.json"
		exported, err = vulpesFunctions.ExportPostmanEnvironment(environment.Name, variables)
	case vulpesDtos.ExportFormatInsomnia:
		defaultFilename = environment.Name + ".insomnia_environment.json"
		exported, warnings, err = vulpesFunctions.ExportInsomniaEnvironment(environment.Name, variables)
	default:
		return nil, errUnknownExportFormat
	}
	if err != nil {
		return nil, err
	}
	return saveExport(callContext, "Exportar ambiente", defaultFilename, exported, warnings)
}

func saveExport(callContext context.Context, title string, defaultFilename string, content []byte, warnings []string) (*vulpesDtos.ExportResultDto, error) {
	path, err := desktop.ChooseSaveLocation(callContext, desktop.FileDialogOptions{
		Title:           title,
		Filters:         []desktop.FileFilter{jsonFilesFilter, allFilesFilter},
		DefaultFilename: invalidFileChars.Replace(defaultFilename),
	})
	if err != nil {
		return nil, err
	}
	if warnings == nil {
		warnings = []string{}
	}
	if path == "" {
		return &vulpesDtos.ExportResultDto{Warnings: warnings}, nil
	}
	if filepath.Ext(path) == "" {
		path += ".json"
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		return nil, err
	}
	return &vulpesDtos.ExportResultDto{Path: path, Warnings: warnings}, nil
}
