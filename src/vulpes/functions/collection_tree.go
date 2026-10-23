package vulpesFunctions

import (
	"encoding/json"
	"errors"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

var (
	ErrItemNotFound    = errors.New("item não encontrado na coleção")
	ErrParentNotFound  = errors.New("pasta de destino não encontrada")
	ErrParentNotFolder = errors.New("o destino precisa ser uma pasta")
)

func FindItem(items []vulpesDtos.CollectionItemDto, itemID string) *vulpesDtos.CollectionItemDto {
	for index := range items {
		if items[index].ID == itemID {
			return &items[index]
		}
		if found := FindItem(items[index].Children, itemID); found != nil {
			return found
		}
	}
	return nil
}

func ItemAncestors(items []vulpesDtos.CollectionItemDto, itemID string) ([]*vulpesDtos.CollectionItemDto, bool) {
	for index := range items {
		if items[index].ID == itemID {
			return []*vulpesDtos.CollectionItemDto{}, true
		}
		if ancestors, found := ItemAncestors(items[index].Children, itemID); found {
			return append([]*vulpesDtos.CollectionItemDto{&items[index]}, ancestors...), true
		}
	}
	return nil, false
}

func ItemLocation(items []vulpesDtos.CollectionItemDto, itemID string) (string, int, bool) {
	for index := range items {
		if items[index].ID == itemID {
			return "", index, true
		}
	}
	for index := range items {
		parentID, position, found := ItemLocation(items[index].Children, itemID)
		if !found {
			continue
		}
		if parentID == "" {
			parentID = items[index].ID
		}
		return parentID, position, true
	}
	return "", -1, false
}

func InsertItem(items []vulpesDtos.CollectionItemDto, parentID string, index int, item vulpesDtos.CollectionItemDto) ([]vulpesDtos.CollectionItemDto, error) {
	if parentID == "" {
		return insertAt(items, index, item), nil
	}
	parent := FindItem(items, parentID)
	if parent == nil {
		return nil, ErrParentNotFound
	}
	if parent.Kind != vulpesDtos.ItemKindFolder {
		return nil, ErrParentNotFolder
	}
	parent.Children = insertAt(parent.Children, index, item)
	return items, nil
}

func RemoveItem(items []vulpesDtos.CollectionItemDto, itemID string) ([]vulpesDtos.CollectionItemDto, *vulpesDtos.CollectionItemDto) {
	for index := range items {
		if items[index].ID == itemID {
			removed := items[index]
			remaining := append(append([]vulpesDtos.CollectionItemDto{}, items[:index]...), items[index+1:]...)
			return remaining, &removed
		}
		if children, removed := RemoveItem(items[index].Children, itemID); removed != nil {
			items[index].Children = children
			return items, removed
		}
	}
	return items, nil
}

func ContainsItem(item vulpesDtos.CollectionItemDto, itemID string) bool {
	if item.ID == itemID {
		return true
	}
	return FindItem(item.Children, itemID) != nil
}

func CloneItem(item vulpesDtos.CollectionItemDto) (vulpesDtos.CollectionItemDto, error) {
	encoded, err := json.Marshal(item)
	if err != nil {
		return vulpesDtos.CollectionItemDto{}, err
	}
	var clone vulpesDtos.CollectionItemDto
	if err := json.Unmarshal(encoded, &clone); err != nil {
		return vulpesDtos.CollectionItemDto{}, err
	}
	return clone, nil
}

func AssignFreshIDs(item *vulpesDtos.CollectionItemDto) {
	item.ID = NewItemID()
	for index := range item.Children {
		AssignFreshIDs(&item.Children[index])
	}
}

func EnsureUniqueIDs(item *vulpesDtos.CollectionItemDto, usedIDs map[string]bool) {
	if item.ID == "" || usedIDs[item.ID] {
		item.ID = NewItemID()
	}
	usedIDs[item.ID] = true
	for index := range item.Children {
		EnsureUniqueIDs(&item.Children[index], usedIDs)
	}
}

func CollectItemIDs(items []vulpesDtos.CollectionItemDto, usedIDs map[string]bool) map[string]bool {
	for _, item := range items {
		usedIDs[item.ID] = true
		CollectItemIDs(item.Children, usedIDs)
	}
	return usedIDs
}

func insertAt(items []vulpesDtos.CollectionItemDto, index int, item vulpesDtos.CollectionItemDto) []vulpesDtos.CollectionItemDto {
	if index < 0 || index >= len(items) {
		return append(items, item)
	}
	inserted := make([]vulpesDtos.CollectionItemDto, 0, len(items)+1)
	inserted = append(inserted, items[:index]...)
	inserted = append(inserted, item)
	return append(inserted, items[index:]...)
}
