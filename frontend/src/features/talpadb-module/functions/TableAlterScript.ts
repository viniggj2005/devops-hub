import { engineInfo } from './DatabaseEngines';
import { generateId, newIdentifier, qualifiedName, quoteIdent } from './TreatmentFunctions';
import type {
  IndexDraft,
  ColumnDraft,
  TableDraft,
  TableDetails,
  DatabaseEngine,
  ConstraintDraft,
} from '../../../interfaces/TalpadbInterfaces';

const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

const commentLiteral = (value: string, engine: DatabaseEngine) =>
  value.trim() ? quoteLiteral(value.trim()) : engine === 'oracle' ? "''" : 'NULL';

const constraintClause = (constraint: ConstraintDraft) => {
  const columns = `(${constraint.columns.trim()})`;
  switch (constraint.type) {
    case 'p':
      return `PRIMARY KEY ${columns}`;
    case 'u':
      return `UNIQUE ${columns}`;
    case 'c':
      return `CHECK (${constraint.expression.trim()})`;
    case 'f':
      return `FOREIGN KEY ${columns} REFERENCES ${constraint.references.trim()}`;
  }
};

export const isConstraintDraftComplete = (constraint: ConstraintDraft) =>
  constraint.type === 'c'
    ? constraint.expression.trim() !== ''
    : constraint.columns.trim() !== '' && (constraint.type !== 'f' || constraint.references.trim() !== '');

export const isColumnDraftComplete = (column: ColumnDraft) =>
  column.dropped || (column.name.trim() !== '' && column.dataType.trim() !== '');

export function columnStatus(column: ColumnDraft): 'new' | 'dropped' | 'modified' | 'unchanged' {
  const original = column.original;
  if (!original) return 'new';
  if (column.dropped) return 'dropped';
  const modified =
    column.name.trim() !== original.name ||
    column.notNull !== original.notNull ||
    column.dataType.trim() !== original.dataType ||
    column.comment.trim() !== (original.comment ?? '') ||
    column.defaultValue.trim() !== (original.defaultValue ?? '');
  return modified ? 'modified' : 'unchanged';
}

export function createTableDraft(details: TableDetails): TableDraft {
  return {
    name: details.name,
    newIndexes: [],
    droppedIndexes: [],
    newConstraints: [],
    droppedConstraints: [],
    comment: details.comment ?? '',
    columns: details.columns.map((column) => ({
      id: generateId(),
      dropped: false,
      original: column,
      name: column.name,
      notNull: column.notNull,
      dataType: column.dataType,
      comment: column.comment ?? '',
      defaultValue: column.defaultValue ?? '',
    })),
  };
}

export function createColumnDraft(engine: DatabaseEngine = 'postgres'): ColumnDraft {
  const dataType = { postgres: 'text', sqlite: 'TEXT', oracle: 'VARCHAR2(255)' }[engine];
  return { id: generateId(), name: '', comment: '', dropped: false, notNull: false, original: null, dataType, defaultValue: '' };
}

function generatedIndexName(details: TableDetails, index: IndexDraft, engine: DatabaseEngine): string {
  const columns = index.columns.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const name = `idx_${details.name}_${columns}`.slice(0, engine === 'oracle' ? 30 : 63);
  return engine === 'oracle' ? name.toUpperCase() : name;
}

function alterColumnStatements(table: string, column: ColumnDraft, engine: DatabaseEngine): string[] {
  const original = column.original;
  if (!original) return [];
  if (column.dropped) return [`ALTER TABLE ${table} DROP COLUMN ${original.quotedName};`];

  const statements: string[] = [];
  const newName = column.name.trim();
  let columnName = original.quotedName;
  if (newName !== original.name) {
    columnName = newIdentifier(newName, engine);
    statements.push(`ALTER TABLE ${table} RENAME COLUMN ${original.quotedName} TO ${columnName};`);
  }
  if (!engineInfo(engine).supportsColumnChanges) return statements;

  const dataType = column.dataType.trim();
  const defaultValue = column.defaultValue.trim();
  const defaultChanged = !original.identity && !original.generated && defaultValue !== (original.defaultValue ?? '');

  if (engine === 'oracle') {
    if (dataType !== original.dataType) statements.push(`ALTER TABLE ${table} MODIFY (${columnName} ${dataType});`);
    if (defaultChanged) statements.push(`ALTER TABLE ${table} MODIFY (${columnName} DEFAULT ${defaultValue || 'NULL'});`);
    if (column.notNull !== original.notNull) {
      statements.push(`ALTER TABLE ${table} MODIFY (${columnName} ${column.notNull ? 'NOT NULL' : 'NULL'});`);
    }
  } else {
    if (dataType !== original.dataType) {
      statements.push(`ALTER TABLE ${table} ALTER COLUMN ${columnName} TYPE ${dataType} USING ${columnName}::${dataType};`);
    }
    if (column.notNull !== original.notNull) {
      statements.push(`ALTER TABLE ${table} ALTER COLUMN ${columnName} ${column.notNull ? 'SET' : 'DROP'} NOT NULL;`);
    }
    if (defaultChanged) {
      statements.push(
        defaultValue
          ? `ALTER TABLE ${table} ALTER COLUMN ${columnName} SET DEFAULT ${defaultValue};`
          : `ALTER TABLE ${table} ALTER COLUMN ${columnName} DROP DEFAULT;`
      );
    }
  }
  if (column.comment.trim() !== (original.comment ?? '')) {
    statements.push(`COMMENT ON COLUMN ${table}.${columnName} IS ${commentLiteral(column.comment, engine)};`);
  }
  return statements;
}

function addColumnStatements(table: string, column: ColumnDraft, engine: DatabaseEngine): string[] {
  if (column.original || column.dropped) return [];
  const columnName = newIdentifier(column.name.trim(), engine);
  const defaultValue = column.defaultValue.trim();
  const dataType = column.dataType.trim();

  if (engine === 'oracle') {
    const definition = [columnName, dataType, defaultValue && `DEFAULT ${defaultValue}`, column.notNull && 'NOT NULL']
      .filter(Boolean)
      .join(' ');
    const statements = [`ALTER TABLE ${table} ADD (${definition});`];
    if (column.comment.trim()) {
      statements.push(`COMMENT ON COLUMN ${table}.${columnName} IS ${commentLiteral(column.comment, engine)};`);
    }
    return statements;
  }

  const definition = [
    `ALTER TABLE ${table} ADD COLUMN ${columnName} ${dataType}`,
    column.notNull && 'NOT NULL',
    defaultValue && `DEFAULT ${defaultValue}`,
  ]
    .filter(Boolean)
    .join(' ');
  const statements = [`${definition};`];
  if (engine === 'postgres' && column.comment.trim()) {
    statements.push(`COMMENT ON COLUMN ${table}.${columnName} IS ${commentLiteral(column.comment, engine)};`);
  }
  return statements;
}

function createIndexStatement(details: TableDetails, index: IndexDraft, table: string, engine: DatabaseEngine): string {
  const unique = index.unique ? 'UNIQUE ' : '';
  const columns = index.columns.trim();
  const name = index.name.trim();
  if (engine === 'postgres') {
    return `CREATE ${unique}INDEX ${name ? `${quoteIdent(name)} ` : ''}ON ${table} USING ${index.method} (${columns});`;
  }
  const indexName = newIdentifier(name || generatedIndexName(details, index, engine), engine);
  const schema = quoteIdent(details.schema, engine);
  if (engine === 'sqlite') {
    return `CREATE ${unique}INDEX ${schema}.${indexName} ON ${quoteIdent(details.name, engine)} (${columns});`;
  }
  return `CREATE ${unique}INDEX ${schema}.${indexName} ON ${table} (${columns});`;
}

export function buildAlterScript(details: TableDetails, draft: TableDraft, engine: DatabaseEngine = 'postgres'): string {
  const info = engineInfo(engine);
  const table = qualifiedName(details.schema, details.name, engine);
  const statements: string[] = [];

  if (info.supportsConstraintChanges) {
    for (const constraintName of draft.droppedConstraints) {
      statements.push(`ALTER TABLE ${table} DROP CONSTRAINT ${constraintName};`);
    }
  }
  for (const indexName of draft.droppedIndexes) {
    statements.push(`DROP INDEX ${quoteIdent(details.schema, engine)}.${indexName};`);
  }

  for (const column of draft.columns) statements.push(...alterColumnStatements(table, column, engine));
  for (const column of draft.columns) statements.push(...addColumnStatements(table, column, engine));

  if (info.supportsConstraintChanges) {
    for (const constraint of draft.newConstraints) {
      const name = constraint.name.trim();
      statements.push(`ALTER TABLE ${table} ADD ${name ? `CONSTRAINT ${newIdentifier(name, engine)} ` : ''}${constraintClause(constraint)};`);
    }
  }
  for (const index of draft.newIndexes) statements.push(createIndexStatement(details, index, table, engine));

  if (engine !== 'sqlite' && draft.comment.trim() !== (details.comment ?? '')) {
    statements.push(`COMMENT ON TABLE ${table} IS ${commentLiteral(draft.comment, engine)};`);
  }
  const newName = draft.name.trim();
  if (newName && newName !== details.name) {
    statements.push(`ALTER TABLE ${table} RENAME TO ${newIdentifier(newName, engine)};`);
  }

  return statements.join('\n');
}
