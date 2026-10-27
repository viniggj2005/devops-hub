package vulpesHandlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	auth "docker-manager-go/src/auth/functions"
	"docker-manager-go/src/models"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const (
	maxNameLength      = 200
	maxCollectionBytes = 32 << 20
)

var (
	errCollectionNotFound  = errors.New("coleção não encontrada")
	errEnvironmentNotFound = errors.New("ambiente não encontrado")
	errMoveIntoItself      = errors.New("não é possível mover uma pasta para dentro dela mesma")
)

type VulpesHandlerStruct struct {
	DataBase *gorm.DB
	Session  *auth.ManagerStruct
	context  context.Context
}

func NewVulpesHandler(dataBase *gorm.DB, sessionManager *auth.ManagerStruct) *VulpesHandlerStruct {
	return &VulpesHandlerStruct{DataBase: dataBase, Session: sessionManager}
}

func (handlerStruct *VulpesHandlerStruct) ServiceStartup(context context.Context, _ application.ServiceOptions) error {
	handlerStruct.context = context
	return nil
}

func (handlerStruct *VulpesHandlerStruct) authenticate(token string) (uint, error) {
	session, err := handlerStruct.Session.Validate(token)
	if err != nil {
		return 0, err
	}
	return session.UserID, nil
}

func (handlerStruct *VulpesHandlerStruct) databaseContext() context.Context {
	if handlerStruct.context != nil {
		return handlerStruct.context
	}
	return context.Background()
}

func (handlerStruct *VulpesHandlerStruct) database() *gorm.DB {
	return handlerStruct.DataBase.WithContext(handlerStruct.databaseContext())
}

func validateName(name string, subject string) (string, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", fmt.Errorf("informe o nome do %s", subject)
	}
	if utf8.RuneCountInString(trimmed) > maxNameLength {
		return "", fmt.Errorf("o nome do %s pode ter no máximo %d caracteres", subject, maxNameLength)
	}
	return trimmed, nil
}

func loadCollection(dataBase *gorm.DB, userID uint, collectionID uint) (*models.VulpesCollectionModel, vulpesDtos.CollectionContentDto, error) {
	var collection models.VulpesCollectionModel
	if err := dataBase.Where("id = ? AND user_id = ?", collectionID, userID).First(&collection).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, vulpesDtos.CollectionContentDto{}, errCollectionNotFound
		}
		return nil, vulpesDtos.CollectionContentDto{}, err
	}
	content, err := decodeContent(collection.Content.Plaintext)
	if err != nil {
		return nil, vulpesDtos.CollectionContentDto{}, err
	}
	return &collection, content, nil
}

func decodeContent(encoded string) (vulpesDtos.CollectionContentDto, error) {
	var content vulpesDtos.CollectionContentDto
	if strings.TrimSpace(encoded) != "" {
		if err := json.Unmarshal([]byte(encoded), &content); err != nil {
			return content, fmt.Errorf("o conteúdo da coleção está corrompido: %w", err)
		}
	}
	vulpesFunctions.NormalizeContent(&content)
	return content, nil
}

func encodeContent(content *vulpesDtos.CollectionContentDto) (string, error) {
	vulpesFunctions.NormalizeContent(content)
	encoded, err := json.Marshal(content)
	if err != nil {
		return "", err
	}
	if len(encoded) > maxCollectionBytes {
		return "", fmt.Errorf("a coleção ultrapassou o limite de %d MB", maxCollectionBytes>>20)
	}
	return string(encoded), nil
}

func storeCollection(dataBase *gorm.DB, collection *models.VulpesCollectionModel, content *vulpesDtos.CollectionContentDto) error {
	encoded, err := encodeContent(content)
	if err != nil {
		return err
	}
	collection.Content.Plaintext = encoded
	return dataBase.Save(collection).Error
}

func toCollectionDto(collection *models.VulpesCollectionModel, content vulpesDtos.CollectionContentDto) vulpesDtos.CollectionDto {
	return vulpesDtos.CollectionDto{
		ID:          collection.ID,
		Name:        collection.Name,
		Auth:        content.Auth,
		Items:       content.Items,
		Cookies:     content.Cookies,
		Scripts:     content.Scripts,
		Variables:   content.Variables,
		Description: content.Description,
	}
}

func (handlerStruct *VulpesHandlerStruct) mutateCollection(userID uint, collectionID uint, mutate func(content *vulpesDtos.CollectionContentDto) error) (*vulpesDtos.CollectionDto, error) {
	var result vulpesDtos.CollectionDto
	err := handlerStruct.database().Transaction(func(transaction *gorm.DB) error {
		collection, content, err := loadCollection(transaction, userID, collectionID)
		if err != nil {
			return err
		}
		if err := mutate(&content); err != nil {
			return err
		}
		if err := storeCollection(transaction, collection, &content); err != nil {
			return err
		}
		result = toCollectionDto(collection, content)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (handlerStruct *VulpesHandlerStruct) FindAllCollections(token string) ([]vulpesDtos.CollectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	var collections []models.VulpesCollectionModel
	if err := handlerStruct.database().Where("user_id = ?", userID).Order("lower(name), id").Find(&collections).Error; err != nil {
		return nil, err
	}

	result := make([]vulpesDtos.CollectionDto, 0, len(collections))
	for index := range collections {
		content, err := decodeContent(collections[index].Content.Plaintext)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", collections[index].Name, err)
		}
		result = append(result, toCollectionDto(&collections[index], content))
	}
	return result, nil
}

func (handlerStruct *VulpesHandlerStruct) CreateCollection(token string, input vulpesDtos.CollectionInputDto) (*vulpesDtos.CollectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	name, err := validateName(input.Name, "coleção")
	if err != nil {
		return nil, err
	}

	content := vulpesDtos.CollectionContentDto{Auth: input.Auth, Variables: input.Variables, Description: input.Description}
	return handlerStruct.createCollection(handlerStruct.database(), userID, name, content)
}

func (handlerStruct *VulpesHandlerStruct) createCollection(dataBase *gorm.DB, userID uint, name string, content vulpesDtos.CollectionContentDto) (*vulpesDtos.CollectionDto, error) {
	encoded, err := encodeContent(&content)
	if err != nil {
		return nil, err
	}
	collection := models.VulpesCollectionModel{Name: name, UserID: userID}
	collection.Content.Plaintext = encoded
	if err := dataBase.Create(&collection).Error; err != nil {
		return nil, fmt.Errorf("erro ao criar coleção: %w", err)
	}
	result := toCollectionDto(&collection, content)
	return &result, nil
}

func (handlerStruct *VulpesHandlerStruct) UpdateCollection(token string, collectionID uint, input vulpesDtos.CollectionInputDto) (*vulpesDtos.CollectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	name, err := validateName(input.Name, "coleção")
	if err != nil {
		return nil, err
	}

	var result vulpesDtos.CollectionDto
	err = handlerStruct.database().Transaction(func(transaction *gorm.DB) error {
		collection, content, err := loadCollection(transaction, userID, collectionID)
		if err != nil {
			return err
		}
		collection.Name = name
		content.Auth = input.Auth
		content.Variables = input.Variables
		content.Description = input.Description
		if err := storeCollection(transaction, collection, &content); err != nil {
			return err
		}
		result = toCollectionDto(collection, content)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (handlerStruct *VulpesHandlerStruct) DeleteCollection(token string, collectionID uint) error {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return err
	}
	result := handlerStruct.database().Where("id = ? AND user_id = ?", collectionID, userID).Delete(&models.VulpesCollectionModel{})
	if result.Error != nil {
		return fmt.Errorf("erro ao excluir coleção: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errCollectionNotFound
	}
	return nil
}

func (handlerStruct *VulpesHandlerStruct) SaveCollectionCookies(token string, collectionID uint, cookies []vulpesDtos.CookieDto) (*vulpesDtos.CollectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	if err := vulpesFunctions.ValidateCookies(cookies); err != nil {
		return nil, err
	}
	return handlerStruct.mutateCollection(userID, collectionID, func(content *vulpesDtos.CollectionContentDto) error {
		content.Cookies = cookies
		return nil
	})
}

func (handlerStruct *VulpesHandlerStruct) CreateItem(token string, collectionID uint, parentID string, item vulpesDtos.CollectionItemDto) (*vulpesDtos.ItemMutationResultDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	vulpesFunctions.NormalizeItem(&item)
	collection, err := handlerStruct.mutateCollection(userID, collectionID, func(content *vulpesDtos.CollectionContentDto) error {
		vulpesFunctions.EnsureUniqueIDs(&item, vulpesFunctions.CollectItemIDs(content.Items, map[string]bool{}))
		items, err := vulpesFunctions.InsertItem(content.Items, parentID, -1, item)
		if err != nil {
			return err
		}
		content.Items = items
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &vulpesDtos.ItemMutationResultDto{ItemID: item.ID, Collection: *collection}, nil
}

func (handlerStruct *VulpesHandlerStruct) SaveItem(token string, collectionID uint, item vulpesDtos.CollectionItemDto) (*vulpesDtos.CollectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	return handlerStruct.mutateCollection(userID, collectionID, func(content *vulpesDtos.CollectionContentDto) error {
		existing := vulpesFunctions.FindItem(content.Items, item.ID)
		if existing == nil {
			return vulpesFunctions.ErrItemNotFound
		}
		item.Kind = existing.Kind
		item.Scripts = existing.Scripts
		item.Children = existing.Children
		vulpesFunctions.NormalizeItem(&item)
		*existing = item
		return nil
	})
}

func (handlerStruct *VulpesHandlerStruct) DeleteItem(token string, collectionID uint, itemID string) (*vulpesDtos.CollectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	return handlerStruct.mutateCollection(userID, collectionID, func(content *vulpesDtos.CollectionContentDto) error {
		items, removed := vulpesFunctions.RemoveItem(content.Items, itemID)
		if removed == nil {
			return vulpesFunctions.ErrItemNotFound
		}
		content.Items = items
		return nil
	})
}

func (handlerStruct *VulpesHandlerStruct) DuplicateItem(token string, collectionID uint, itemID string) (*vulpesDtos.ItemMutationResultDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	var duplicateID string
	collection, err := handlerStruct.mutateCollection(userID, collectionID, func(content *vulpesDtos.CollectionContentDto) error {
		original := vulpesFunctions.FindItem(content.Items, itemID)
		parentID, position, found := vulpesFunctions.ItemLocation(content.Items, itemID)
		if original == nil || !found {
			return vulpesFunctions.ErrItemNotFound
		}
		duplicate, err := vulpesFunctions.CloneItem(*original)
		if err != nil {
			return err
		}
		vulpesFunctions.AssignFreshIDs(&duplicate)
		duplicate.Name = original.Name + " (cópia)"
		duplicateID = duplicate.ID

		items, err := vulpesFunctions.InsertItem(content.Items, parentID, position+1, duplicate)
		if err != nil {
			return err
		}
		content.Items = items
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &vulpesDtos.ItemMutationResultDto{ItemID: duplicateID, Collection: *collection}, nil
}

func (handlerStruct *VulpesHandlerStruct) MoveItem(token string, input vulpesDtos.MoveItemInputDto) ([]vulpesDtos.CollectionDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	if input.TargetCollectionID == 0 {
		input.TargetCollectionID = input.CollectionID
	}
	sameCollection := input.TargetCollectionID == input.CollectionID

	var updated []vulpesDtos.CollectionDto
	err = handlerStruct.database().Transaction(func(transaction *gorm.DB) error {
		source, sourceContent, err := loadCollection(transaction, userID, input.CollectionID)
		if err != nil {
			return err
		}
		target, targetContent := source, &sourceContent
		if !sameCollection {
			var loadedContent vulpesDtos.CollectionContentDto
			if target, loadedContent, err = loadCollection(transaction, userID, input.TargetCollectionID); err != nil {
				return err
			}
			targetContent = &loadedContent
		}

		originalParentID, originalPosition, found := vulpesFunctions.ItemLocation(sourceContent.Items, input.ItemID)
		if !found {
			return vulpesFunctions.ErrItemNotFound
		}
		remaining, removed := vulpesFunctions.RemoveItem(sourceContent.Items, input.ItemID)
		if input.TargetParentID != "" && vulpesFunctions.ContainsItem(*removed, input.TargetParentID) {
			return errMoveIntoItself
		}
		sourceContent.Items = remaining

		targetIndex := input.TargetIndex
		if sameCollection && originalParentID == input.TargetParentID && originalPosition < targetIndex {
			targetIndex--
		}
		if !sameCollection {
			vulpesFunctions.EnsureUniqueIDs(removed, vulpesFunctions.CollectItemIDs(targetContent.Items, map[string]bool{}))
		}
		if targetContent.Items, err = vulpesFunctions.InsertItem(targetContent.Items, input.TargetParentID, targetIndex, *removed); err != nil {
			return err
		}

		if err := storeCollection(transaction, source, &sourceContent); err != nil {
			return err
		}
		updated = append(updated, toCollectionDto(source, sourceContent))
		if !sameCollection {
			if err := storeCollection(transaction, target, targetContent); err != nil {
				return err
			}
			updated = append(updated, toCollectionDto(target, *targetContent))
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func loadEnvironment(dataBase *gorm.DB, userID uint, environmentID uint) (*models.VulpesEnvironmentModel, []vulpesDtos.VariableDto, error) {
	var environment models.VulpesEnvironmentModel
	if err := dataBase.Where("id = ? AND user_id = ?", environmentID, userID).First(&environment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errEnvironmentNotFound
		}
		return nil, nil, err
	}
	variables, err := decodeVariables(environment.Variables.Plaintext)
	if err != nil {
		return nil, nil, err
	}
	return &environment, variables, nil
}

func decodeVariables(encoded string) ([]vulpesDtos.VariableDto, error) {
	var variables []vulpesDtos.VariableDto
	if strings.TrimSpace(encoded) != "" {
		if err := json.Unmarshal([]byte(encoded), &variables); err != nil {
			return nil, fmt.Errorf("as variáveis do ambiente estão corrompidas: %w", err)
		}
	}
	return vulpesFunctions.NormalizeVariables(variables), nil
}

func toEnvironmentDto(environment *models.VulpesEnvironmentModel, variables []vulpesDtos.VariableDto) vulpesDtos.EnvironmentDto {
	return vulpesDtos.EnvironmentDto{ID: environment.ID, Name: environment.Name, Variables: variables}
}

func (handlerStruct *VulpesHandlerStruct) FindAllEnvironments(token string) ([]vulpesDtos.EnvironmentDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}

	var environments []models.VulpesEnvironmentModel
	if err := handlerStruct.database().Where("user_id = ?", userID).Order("lower(name), id").Find(&environments).Error; err != nil {
		return nil, err
	}

	result := make([]vulpesDtos.EnvironmentDto, 0, len(environments))
	for index := range environments {
		variables, err := decodeVariables(environments[index].Variables.Plaintext)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", environments[index].Name, err)
		}
		result = append(result, toEnvironmentDto(&environments[index], variables))
	}
	return result, nil
}

func (handlerStruct *VulpesHandlerStruct) CreateEnvironment(token string, input vulpesDtos.EnvironmentInputDto) (*vulpesDtos.EnvironmentDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	return handlerStruct.createEnvironment(handlerStruct.database(), userID, input)
}

func (handlerStruct *VulpesHandlerStruct) createEnvironment(dataBase *gorm.DB, userID uint, input vulpesDtos.EnvironmentInputDto) (*vulpesDtos.EnvironmentDto, error) {
	name, err := validateName(input.Name, "ambiente")
	if err != nil {
		return nil, err
	}
	variables := vulpesFunctions.NormalizeVariables(input.Variables)
	encoded, err := json.Marshal(variables)
	if err != nil {
		return nil, err
	}

	environment := models.VulpesEnvironmentModel{Name: name, UserID: userID}
	environment.Variables.Plaintext = string(encoded)
	if err := dataBase.Create(&environment).Error; err != nil {
		return nil, fmt.Errorf("erro ao criar ambiente: %w", err)
	}
	result := toEnvironmentDto(&environment, variables)
	return &result, nil
}

func (handlerStruct *VulpesHandlerStruct) UpdateEnvironment(token string, environmentID uint, input vulpesDtos.EnvironmentInputDto) (*vulpesDtos.EnvironmentDto, error) {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return nil, err
	}
	name, err := validateName(input.Name, "ambiente")
	if err != nil {
		return nil, err
	}

	environment, _, err := loadEnvironment(handlerStruct.database(), userID, environmentID)
	if err != nil {
		return nil, err
	}
	variables := vulpesFunctions.NormalizeVariables(input.Variables)
	encoded, err := json.Marshal(variables)
	if err != nil {
		return nil, err
	}
	environment.Name = name
	environment.Variables.Plaintext = string(encoded)
	if err := handlerStruct.database().Save(environment).Error; err != nil {
		return nil, fmt.Errorf("erro ao atualizar ambiente: %w", err)
	}
	result := toEnvironmentDto(environment, variables)
	return &result, nil
}

func (handlerStruct *VulpesHandlerStruct) DeleteEnvironment(token string, environmentID uint) error {
	userID, err := handlerStruct.authenticate(token)
	if err != nil {
		return err
	}
	result := handlerStruct.database().Where("id = ? AND user_id = ?", environmentID, userID).Delete(&models.VulpesEnvironmentModel{})
	if result.Error != nil {
		return fmt.Errorf("erro ao excluir ambiente: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errEnvironmentNotFound
	}
	return nil
}

func (handlerStruct *VulpesHandlerStruct) storeReceivedCookies(userID uint, collectionID uint, changes []vulpesDtos.CookieDto) (*[]vulpesDtos.CookieDto, error) {
	collection, err := handlerStruct.mutateCollection(userID, collectionID, func(content *vulpesDtos.CollectionContentDto) error {
		content.Cookies = vulpesFunctions.ApplyCookieChanges(content.Cookies, changes, time.Now())
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &collection.Cookies, nil
}

func (handlerStruct *VulpesHandlerStruct) loadExecutionScope(userID uint, scope vulpesDtos.ExecutionScopeDto) (*vulpesFunctions.VariableResolver, *vulpesDtos.CollectionContentDto, error) {
	var content *vulpesDtos.CollectionContentDto
	var collectionVariables, environmentVariables []vulpesDtos.VariableDto

	if scope.CollectionID != 0 {
		_, loadedContent, err := loadCollection(handlerStruct.database(), userID, scope.CollectionID)
		if err != nil {
			return nil, nil, err
		}
		content = &loadedContent
		collectionVariables = loadedContent.Variables
	}
	if scope.EnvironmentID != 0 {
		_, variables, err := loadEnvironment(handlerStruct.database(), userID, scope.EnvironmentID)
		if err != nil {
			return nil, nil, err
		}
		environmentVariables = variables
	}
	return vulpesFunctions.NewVariableResolver(collectionVariables, environmentVariables), content, nil
}
