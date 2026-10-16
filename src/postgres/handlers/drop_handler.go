package postgresHandlers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	postgresDtos "docker-manager-go/src/postgres/dtos"
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

func (handlerStruct *PostgresClientHandlerStruct) maintenanceDatabase(userID uint, connectionID uint, target string) (string, error) {
	connection, err := handlerStruct.postgres.findConnection(userID, connectionID)
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

func (handlerStruct *PostgresClientHandlerStruct) buildDropSql(ctx context.Context, userID uint, connectionID uint, database string, input postgresDtos.DropObjectInputDto) (string, *poolEntry, error) {
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
		entry, err := handlerStruct.getPoolForUser(userID, connectionID, maintenance)
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
		entry, err := handlerStruct.getPoolForUser(userID, connectionID, database)
		if err != nil {
			return "", nil, err
		}
		return "DROP SCHEMA " + quoteIdentifier(name) + cascadeClause(input.Cascade) + ";", entry, nil

	case dropKindRelation:
		entry, err := handlerStruct.getPoolForUser(userID, connectionID, database)
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

func (handlerStruct *PostgresClientHandlerStruct) PreviewDropObject(token string, connectionId uint, database string, input postgresDtos.DropObjectInputDto) (string, error) {
	userID, err := handlerStruct.postgres.authenticate(token)
	if err != nil {
		return "", err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	sql, _, err := handlerStruct.buildDropSql(ctx, userID, connectionId, database, input)
	return sql, err
}

func (handlerStruct *PostgresClientHandlerStruct) DropObject(token string, connectionId uint, database string, input postgresDtos.DropObjectInputDto) error {
	userID, err := handlerStruct.postgres.authenticate(token)
	if err != nil {
		return err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	sql, entry, err := handlerStruct.buildDropSql(ctx, userID, connectionId, database, input)
	if err != nil {
		return err
	}

	name := strings.TrimSpace(input.Name)
	if input.Kind == dropKindDatabase {
		targetKey := poolKey(userID, connectionId, name)
		handlerStruct.closeResourcesAndWait(func(key string, session *querySession) bool {
			if session != nil {
				return session.userID == userID && session.connectionID == connectionId && session.database == name
			}
			return key == targetKey
		})
	}

	if _, err := entry.pool.Exec(ctx, sql); err != nil {
		return errors.New(describeError(err))
	}

	switch input.Kind {
	case dropKindDatabase:
		_ = handlerStruct.postgres.deleteDiagramLayoutsIn(userID, connectionId, name, "")
	case dropKindSchema:
		_ = handlerStruct.postgres.deleteDiagramLayoutsIn(userID, connectionId, database, name)
	}
	return nil
}
