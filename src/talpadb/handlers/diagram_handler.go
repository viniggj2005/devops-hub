package talpadbHandlers

import (
	"context"
	"fmt"

	talpadbDtos "docker-manager-go/src/talpadb/dtos"
)

const maxDiagramTables = 400

const diagramTablesSql = `
SELECT c.oid, n.nspname, c.relname, c.relkind::text, pg_catalog.obj_description(c.oid, 'pg_class')
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  AND ($1::text = '' OR n.nspname = $1::text) %s
ORDER BY n.nspname, c.relname
LIMIT %d`

const diagramColumnsSql = `
SELECT a.attrelid,
       a.attname,
       pg_catalog.format_type(a.atttypid, a.atttypmod),
       a.attnotnull,
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'p' AND a.attnum = ANY (con.conkey)),
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid = a.attrelid AND con.contype = 'f' AND a.attnum = ANY (con.conkey)),
       EXISTS (SELECT 1 FROM pg_catalog.pg_index i
               WHERE i.indrelid = a.attrelid AND i.indisunique AND NOT i.indisprimary
                 AND i.indnatts = 1 AND i.indkey[0] = a.attnum AND i.indpred IS NULL)
FROM pg_catalog.pg_attribute a
WHERE a.attrelid = ANY ($1::oid[]) AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attrelid, a.attnum`

const diagramRelationsSql = `
SELECT con.conname AS name,
       sn.nspname AS source_schema,
       sc.relname AS source_table,
       tn.nspname AS target_schema,
       tc.relname AS target_table,
       ARRAY(SELECT a.attname::text
             FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
             ORDER BY k.ord) AS source_columns,
       ARRAY(SELECT a.attname::text
             FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum
             ORDER BY k.ord) AS target_columns
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class sc ON sc.oid = con.conrelid
JOIN pg_catalog.pg_namespace sn ON sn.oid = sc.relnamespace
JOIN pg_catalog.pg_class tc ON tc.oid = con.confrelid
JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
WHERE con.contype = 'f' AND con.conrelid = ANY ($1::oid[]) AND con.confrelid = ANY ($1::oid[]) %s
ORDER BY sn.nspname, sc.relname, con.conname`

func (handlerStruct *TalpadbClientHandlerStruct) GetDatabaseDiagram(callContext context.Context, token string, connectionId uint, database string, schema string) (*talpadbDtos.DatabaseDiagramDto, error) {
	if diagram, handled, err := runGeneric(callContext, handlerStruct, token, connectionId, func(ctx context.Context, entry *genericEntry) (*talpadbDtos.DatabaseDiagramDto, error) {
		return entry.engine.Diagram(ctx, entry.db, schema)
	}); handled {
		return diagram, err
	}

	entry, err := handlerStruct.getPool(callContext, token, connectionId, database)
	if err != nil {
		return nil, err
	}
	ctx, cancel := handlerStruct.queryContext()
	defer cancel()

	partitionFilter := ""
	if entry.versionNumber >= 100000 {
		partitionFilter = "AND NOT c.relispartition"
	}
	inheritedFilter := ""
	if entry.versionNumber >= 110000 {
		inheritedFilter = "AND con.conparentid = 0"
	}

	tableRows, err := entry.pool.Query(ctx, fmt.Sprintf(diagramTablesSql, partitionFilter, maxDiagramTables+1), schema)
	if err != nil {
		return nil, err
	}
	diagram := &talpadbDtos.DatabaseDiagramDto{Tables: []talpadbDtos.DiagramTableDto{}, Relations: []talpadbDtos.DiagramRelationDto{}}
	oids := []uint32{}
	tableIndexByOid := map[uint32]int{}
	for tableRows.Next() {
		var oid uint32
		table := talpadbDtos.DiagramTableDto{Columns: []talpadbDtos.DiagramColumnDto{}}
		if err := tableRows.Scan(&oid, &table.Schema, &table.Name, &table.Kind, &table.Comment); err != nil {
			tableRows.Close()
			return nil, err
		}
		if len(diagram.Tables) == maxDiagramTables {
			diagram.Truncated = true
			continue
		}
		tableIndexByOid[oid] = len(diagram.Tables)
		oids = append(oids, oid)
		diagram.Tables = append(diagram.Tables, table)
	}
	tableRows.Close()
	if err := tableRows.Err(); err != nil {
		return nil, err
	}
	if len(oids) == 0 {
		return diagram, nil
	}

	columnRows, err := entry.pool.Query(ctx, diagramColumnsSql, oids)
	if err != nil {
		return nil, err
	}
	for columnRows.Next() {
		var oid uint32
		var column talpadbDtos.DiagramColumnDto
		if err := columnRows.Scan(&oid, &column.Name, &column.DataType, &column.NotNull, &column.IsPrimaryKey, &column.IsForeignKey, &column.IsUnique); err != nil {
			columnRows.Close()
			return nil, err
		}
		index := tableIndexByOid[oid]
		diagram.Tables[index].Columns = append(diagram.Tables[index].Columns, column)
	}
	columnRows.Close()
	if err := columnRows.Err(); err != nil {
		return nil, err
	}

	relations, err := collectRows[talpadbDtos.DiagramRelationDto](ctx, entry, fmt.Sprintf(diagramRelationsSql, inheritedFilter), oids)
	if err != nil {
		return nil, err
	}
	diagram.Relations = relations
	return diagram, nil
}
