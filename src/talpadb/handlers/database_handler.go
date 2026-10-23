package talpadbHandlers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
	talpadbFunctions "docker-manager-go/src/talpadb/functions"
)

const databaseRolesSql = `
SELECT r.rolname FROM pg_catalog.pg_roles r
WHERE r.rolname !~ '^pg_'
ORDER BY r.rolname`

const databaseTemplatesSql = `
SELECT d.datname FROM pg_catalog.pg_database d
WHERE d.datistemplate OR d.datallowconn
ORDER BY d.datistemplate DESC, d.datname`

const databaseDefaultsSql = `
SELECT current_user, pg_catalog.pg_encoding_to_char(d.encoding), d.datcollate, d.datctype
FROM pg_catalog.pg_database d
WHERE d.datname = 'template1'`

func quoteIdentifier(name string) string {
	return pgx.Identifier{name}.Sanitize()
}

func buildCreateDatabaseSql(input talpadbDtos.CreateDatabaseInputDto) (string, string, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return "", "", errors.New("informe o nome do banco")
	}
	if input.ConnectionLimit < -1 {
		return "", "", errors.New("o limite de conexÃµes deve ser -1 (ilimitado) ou maior")
	}

	options := []string{}
	if owner := strings.TrimSpace(input.Owner); owner != "" {
		options = append(options, "OWNER = "+quoteIdentifier(owner))
	}
	if template := strings.TrimSpace(input.Template); template != "" {
		options = append(options, "TEMPLATE = "+quoteIdentifier(template))
	}
	if encoding := strings.TrimSpace(input.Encoding); encoding != "" {
		options = append(options, "ENCODING = "+talpadbFunctions.QuoteLiteral(encoding))
	}
	if collate := strings.TrimSpace(input.Collate); collate != "" {
		options = append(options, "LC_COLLATE = "+talpadbFunctions.QuoteLiteral(collate))
	}
	if ctype := strings.TrimSpace(input.Ctype); ctype != "" {
		options = append(options, "LC_CTYPE = "+talpadbFunctions.QuoteLiteral(ctype))
	}
	if input.ConnectionLimit != -1 {
		options = append(options, fmt.Sprintf("CONNECTION LIMIT = %d", input.ConnectionLimit))
	}

	createSql := "CREATE DATABASE " + quoteIdentifier(name)
	if len(options) > 0 {
		createSql += "\n    WITH " + strings.Join(options, "\n         ")
	}
	createSql += ";"

	commentSql := ""
	if comment := strings.TrimSpace(input.Comment); comment != "" {
		commentSql = fmt.Sprintf("COMMENT ON DATABASE %s IS %s;", quoteIdentifier(name), talpadbFunctions.QuoteLiteral(comment))
	}
	return createSql, commentSql, nil
}

func (handlerStruct *TalpadbClientHandlerStruct) GetDatabaseOptions(callContext context.Context, token string, connectionId uint) (*talpadbDtos.DatabaseOptionsDto, error) {
	entry, err := handlerStruct.getPool(callContext, token, connectionId, "")
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	options := &talpadbDtos.DatabaseOptionsDto{}
	if err := entry.pool.QueryRow(ctx, databaseDefaultsSql).Scan(
		&options.CurrentUser,
		&options.DefaultEncoding,
		&options.DefaultCollate,
		&options.DefaultCtype,
	); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	roles, err := entry.pool.Query(ctx, databaseRolesSql)
	if err != nil {
		return nil, err
	}
	if options.Roles, err = pgx.CollectRows(roles, pgx.RowTo[string]); err != nil {
		return nil, err
	}

	templates, err := entry.pool.Query(ctx, databaseTemplatesSql)
	if err != nil {
		return nil, err
	}
	if options.Templates, err = pgx.CollectRows(templates, pgx.RowTo[string]); err != nil {
		return nil, err
	}
	return options, nil
}

func (handlerStruct *TalpadbClientHandlerStruct) PreviewCreateDatabase(input talpadbDtos.CreateDatabaseInputDto) (string, error) {
	createSql, commentSql, err := buildCreateDatabaseSql(input)
	if err != nil {
		return "", err
	}
	if commentSql == "" {
		return createSql, nil
	}
	return createSql + "\n\n" + commentSql, nil
}

func (handlerStruct *TalpadbClientHandlerStruct) CreateDatabase(callContext context.Context, token string, connectionId uint, input talpadbDtos.CreateDatabaseInputDto) error {
	createSql, commentSql, err := buildCreateDatabaseSql(input)
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
			return fmt.Errorf("o banco foi criado, mas o comentÃ¡rio nÃ£o foi salvo: %s", describeError(err))
		}
	}
	return nil
}
