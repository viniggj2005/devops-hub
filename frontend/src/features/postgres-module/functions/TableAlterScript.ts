import { generateId, qualifiedName, quoteIdent } from './TreatmentFunctions';
import type {
  ColumnDraft,
  TableDraft,
  TableDetails,
  ConstraintDraft,
} from '../../../interfaces/PostgresInterfaces';

const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

const commentLiteral = (value: string) => (value.trim() ? quoteLiteral(value.trim()) : 'NULL');

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

export function createColumnDraft(): ColumnDraft {
  return { id: generateId(), name: '', comment: '', dropped: false, notNull: false, original: null, dataType: 'text', defaultValue: '' };
}

function alterColumnStatements(table: string, column: ColumnDraft): string[] {
  const original = column.original;
  if (!original) return [];
  if (column.dropped) return [`ALTER TABLE ${table} DROP COLUMN ${original.quotedName};`];

  const statements: string[] = [];
  const newName = column.name.trim();
  let columnName = original.quotedName;
  if (newName !== original.name) {
    statements.push(`ALTER TABLE ${table} RENAME COLUMN ${original.quotedName} TO ${quoteIdent(newName)};`);
    columnName = quoteIdent(newName);
  }

  const dataType = column.dataType.trim();
  if (dataType !== original.dataType) {
    statements.push(`ALTER TABLE ${table} ALTER COLUMN ${columnName} TYPE ${dataType} USING ${columnName}::${dataType};`);
  }
  if (column.notNull !== original.notNull) {
    statements.push(`ALTER TABLE ${table} ALTER COLUMN ${columnName} ${column.notNull ? 'SET' : 'DROP'} NOT NULL;`);
  }

  const defaultValue = column.defaultValue.trim();
  if (!original.identity && !original.generated && defaultValue !== (original.defaultValue ?? '')) {
    statements.push(
      defaultValue
        ? `ALTER TABLE ${table} ALTER COLUMN ${columnName} SET DEFAULT ${defaultValue};`
        : `ALTER TABLE ${table} ALTER COLUMN ${columnName} DROP DEFAULT;`
    );
  }
  if (column.comment.trim() !== (original.comment ?? '')) {
    statements.push(`COMMENT ON COLUMN ${table}.${columnName} IS ${commentLiteral(column.comment)};`);
  }
  return statements;
}

function addColumnStatements(table: string, column: ColumnDraft): string[] {
  if (column.original || column.dropped) return [];
  const columnName = quoteIdent(column.name.trim());
  const defaultValue = column.defaultValue.trim();
  const definition = [
    `ALTER TABLE ${table} ADD COLUMN ${columnName} ${column.dataType.trim()}`,
    column.notNull && 'NOT NULL',
    defaultValue && `DEFAULT ${defaultValue}`,
  ]
    .filter(Boolean)
    .join(' ');
  const statements = [`${definition};`];
  if (column.comment.trim()) {
    statements.push(`COMMENT ON COLUMN ${table}.${columnName} IS ${commentLiteral(column.comment)};`);
  }
  return statements;
}

export function buildAlterScript(details: TableDetails, draft: TableDraft): string {
  const table = qualifiedName(details.schema, details.name);
  const statements: string[] = [];

  for (const constraintName of draft.droppedConstraints) {
    statements.push(`ALTER TABLE ${table} DROP CONSTRAINT ${constraintName};`);
  }
  for (const indexName of draft.droppedIndexes) {
    statements.push(`DROP INDEX ${quoteIdent(details.schema)}.${indexName};`);
  }

  for (const column of draft.columns) statements.push(...alterColumnStatements(table, column));
  for (const column of draft.columns) statements.push(...addColumnStatements(table, column));

  for (const constraint of draft.newConstraints) {
    const name = constraint.name.trim();
    statements.push(`ALTER TABLE ${table} ADD ${name ? `CONSTRAINT ${quoteIdent(name)} ` : ''}${constraintClause(constraint)};`);
  }
  for (const index of draft.newIndexes) {
    const name = index.name.trim();
    statements.push(
      `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${name ? `${quoteIdent(name)} ` : ''}ON ${table} USING ${index.method} (${index.columns.trim()});`
    );
  }

  if (draft.comment.trim() !== (details.comment ?? '')) {
    statements.push(`COMMENT ON TABLE ${table} IS ${commentLiteral(draft.comment)};`);
  }
  const newName = draft.name.trim();
  if (newName && newName !== details.name) {
    statements.push(`ALTER TABLE ${table} RENAME TO ${quoteIdent(newName)};`);
  }

  return statements.join('\n');
}
