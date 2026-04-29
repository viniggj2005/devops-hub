package authFunctions

func MustAuth(manager *ManagerStruct, token string) error {
	_, err := manager.Validate(token)
	return err
}
