package talpadbHandlers

import (
	"errors"
	"context"

	"docker-manager-go/src/appErrors"
	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbEngines "docker-manager-go/src/talpadb/engines"
)

func (handlerStruct *TalpadbClientHandlerStruct) GetDatabaseOptions(callContext context.Context, token string, connectionId uint) (*talpadbDtos.DatabaseOptionsDto, error) {
	entry, err := handlerStruct.getPool(callContext, token, connectionId, "")
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	return talpadbEngines.Postgres.DatabaseOptions(ctx, entry.pool)
}

func (handlerStruct *TalpadbClientHandlerStruct) PreviewCreateDatabase(input talpadbDtos.CreateDatabaseInputDto) (string, error) {
	createSql, commentSql, err := talpadbEngines.Postgres.BuildCreateDatabaseSql(input)
	if err != nil {
		return "", err
	}
	if commentSql == "" {
		return createSql, nil
	}
	return createSql + "\n\n" + commentSql, nil
}

func (handlerStruct *TalpadbClientHandlerStruct) CreateDatabase(callContext context.Context, token string, connectionId uint, input talpadbDtos.CreateDatabaseInputDto) error {
	createSql, commentSql, err := talpadbEngines.Postgres.BuildCreateDatabaseSql(input)
	if err != nil {
		return err
	}
	entry, err := handlerStruct.getPool(callContext, token, connectionId, "")
	if err != nil {
		return err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	if _, err := entry.pool.Exec(ctx, createSql); err != nil {
		return errors.New(describeError(err))
	}
	if commentSql != "" {
		if _, err := entry.pool.Exec(ctx, commentSql); err != nil {
			return appErrors.Wrap("talpadb.commentNotSaved", "o banco foi criado, mas o comentário não foi salvo", errors.New(describeError(err)))
		}
	}
	return nil
}
