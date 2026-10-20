package talpadbHandlers

import (
	"context"
	"docker-manager-go/src/desktop"
	"errors"
	"fmt"
	"strings"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
)

const (
	dropKindSchema   = "schema"
	dropKindDatabase = "database"
	dropKindRelation = "relation"
)

var relationDropKeywords = map[string]string{
	"r": "TABLE",
	"p": "TABLE",
	"v": "VIEW",
	"f": "FOREIGN TABLE",
	"m": "MATERIALIZED VIEW",
}

func cascadeClause(cascade bool) string {
	if cascade {
		return " CASCADE"
	}
	return ""
}

func (handlerStruct *TalpadbClientHandlerStruct) maintenanceDatabase(userID uint, connectionID uint, target string) (string, error) {
	connection, err := handlerStruct.talpadb.findConnection(userID, connectionID)
	if err != nil {
		return "", err
	}
	for _, candidate := range []string{connection.Database, "postgres", "template1"} {
		if candidate != "" && candidate != target {
			return candidate, nil
		}
	}
	return "", errors.New("não há outro banco disponível para executar a exclusão")
}

func (handlerStruct *TalpadbClientHandlerStruct) buildDropSql(ctx context.Context, windowName string, userID uint, connectionID uint, database string, input talpadbDtos.DropObjectInputDto) (string, *poolEntry, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return "", nil, errors.New("informe o objeto a excluir")
	}

	switch input.Kind {
	case dropKindDatabase:
		maintenance, err := handlerStruct.maintenanceDatabase(userID, connectionID, name)
		if err != nil {
			return "", nil, err
		}
		entry, err := handlerStruct.getPoolForUser(windowName, userID, connectionID, maintenance)
		if err != nil {
			return "", nil, err
		}
		sql := "DROP DATABASE " + quoteIdentifier(name)
		if input.Force {
			if entry.versionNumber < 130000 {
				return "", nil, errors.New("a opção FORCE exige PostgreSQL 13 ou superior")
			}
			sql += " WITH (FORCE)"
		}
		return sql + ";", entry, nil

	case dropKindSchema:
		entry, err := handlerStruct.getPoolForUser(windowName, userID, connectionID, database)
		if err != nil {
			return "", nil, err
		}
		return "DROP SCHEMA " + quoteIdentifier(name) + cascadeClause(input.Cascade) + ";", entry, nil

	case dropKindRelation:
		entry, err := handlerStruct.getPoolForUser(windowName, userID, connectionID, database)
		if err != nil {
			return "", nil, err
		}
		_, kind, err := relationOid(ctx, entry, input.Schema, name)
		if err != nil {
			return "", nil, err
		}
		keyword, supported := relationDropKeywords[kind]
		if !supported {
			return "", nil, fmt.Errorf("%s.%s não é uma tabela ou view", input.Schema, name)
		}
		qualified := quoteIdentifier(input.Schema) + "." + quoteIdentifier(name)
		return "DROP " + keyword + " " + qualified + cascadeClause(input.Cascade) + ";", entry, nil
	}
	return "", nil, fmt.Errorf("tipo de objeto desconhecido: %s", input.Kind)
}

func (handlerStruct *TalpadbClientHandlerStruct) PreviewDropObject(callContext context.Context, token string, connectionId uint, database string, input talpadbDtos.DropObjectInputDto) (string, error) {
	if statement, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (string, error) {
		return entry.engine.DropStatement(ctx, entry.db, input)
	}); handled {
		return statement, err
	}

	userID, err := handlerStruct.talpadb.authenticate(token)
	if err != nil {
		return "", err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	sql, _, err := handlerStruct.buildDropSql(ctx, desktop.CallingWindowName(callContext), userID, connectionId, database, input)
	return sql, err
}

func (handlerStruct *TalpadbClientHandlerStruct) DropObject(callContext context.Context, token string, connectionId uint, database string, input talpadbDtos.DropObjectInputDto) error {
	if _, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (bool, error) {
		statement, err := entry.engine.DropStatement(ctx, entry.db, input)
		if err != nil {
			return false, err
		}
		_, err = entry.db.ExecContext(ctx, strings.TrimSuffix(statement, ";"))
		return err == nil, err
	}); handled {
		return err
	}

	userID, err := handlerStruct.talpadb.authenticate(token)
	if err != nil {
		return err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	sql, entry, err := handlerStruct.buildDropSql(ctx, desktop.CallingWindowName(callContext), userID, connectionId, database, input)
	if err != nil {
		return err
	}

	name := strings.TrimSpace(input.Name)
	if input.Kind == dropKindDatabase {
		handlerStruct.closeResourcesAndWait(func(identity poolIdentity) bool {
			return identity.userID == userID && identity.connectionID == connectionId && identity.database == name
		})
	}

	if _, err := entry.pool.Exec(ctx, sql); err != nil {
		return errors.New(describeError(err))
	}

	switch input.Kind {
	case dropKindDatabase:
		_ = handlerStruct.talpadb.deleteDiagramLayoutsIn(userID, connectionId, name, "")
	case dropKindSchema:
		_ = handlerStruct.talpadb.deleteDiagramLayoutsIn(userID, connectionId, database, name)
	}
	return nil
}
