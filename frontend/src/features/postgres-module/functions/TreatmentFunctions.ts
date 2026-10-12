import type { SQLNamespace } from '@codemirror/lang-sql';
import type {
  QueryCell,
  ColumnInfo,
  CompletionTable,
  QueryExecution,
  QueryResultSet,
  PostgresConnection,
} from '../../../interfaces/PostgresInterfaces';

// Palavras-chave que o PostgreSQL não aceita como identificador sem aspas (mesma regra do quote_ident).
const RESERVED_WORDS = new Set(
  (
    'all analyse analyze and any array as asc asymmetric both case cast check collate column constraint create ' +
    'current_catalog current_date current_role current_time current_timestamp current_user default deferrable desc ' +
    'distinct do else end except false fetch for foreign from grant group having in initially intersect into lateral ' +
    'leading limit localtime localtimestamp not null offset on only or order placing primary references returning ' +
    'select session_user some symmetric system_user table then to trailing true union unique user using variadic when ' +
    'where window with authorization binary collation concurrently cross current_schema freeze full ilike inner is ' +
    'isnull join left like natural notnull outer overlaps right similar tablesample verbose between bigint bit boolean ' +
    'char character coalesce dec decimal exists extract float greatest grouping inout int integer interval json least ' +
    'national nchar none normalize nullif numeric out overlay position precision real row setof smallint substring ' +
    'time timestamp treat trim values varchar xmlattributes xmlconcat xmlelement xmlexists xmlforest xmlnamespaces ' +
    'xmlparse xmlpi xmlroot xmlserialize xmltable'
  ).split(' ')
);

const NUMERIC_TYPES = new Set([
  'int2',
  'int4',
  'int8',
  'float4',
  'float8',
  'numeric',
  'oid',
  'money',
]);

export function quoteIdent(name: string): string {
  if (/^[a-z_][a-z0-9_$]*$/.test(name) && !RESERVED_WORDS.has(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

export function qualifiedName(schema: string, name: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(name)}`;
}

export function connectionLabel(connection?: PostgresConnection | null): string {
  if (!connection) return 'Servidor';
  return connection.alias || `${connection.username}@${connection.host}`;
}

export function errorMessage(error: unknown): string {
  if (!error) return 'Erro desconhecido';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isNumericType(dataType: string): boolean {
  return NUMERIC_TYPES.has(dataType);
}

export function displayCell(value: QueryCell, dataType: string): string {
  if (value === null) return 'NULL';
  if (dataType === 'bool') {
    if (value === 't') return 'true';
    if (value === 'f') return 'false';
  }
  return value;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1) return '< 1 ms';
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(2)} s`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `${minutes} min ${seconds} s`;
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return '—';
  if (seconds < 1) return '< 1 s';
  if (seconds < 60) return `${Math.floor(seconds)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.floor(seconds % 60)} s`;
  if (seconds < 86_400)
    return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
  return `${Math.floor(seconds / 86_400)} d ${Math.floor((seconds % 86_400) / 3600)} h`;
}

export function errorLocation(sql: string, position: number): { line: number; column: number } {
  const before = sql.slice(0, Math.max(0, position - 1));
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function summarizeExecution(execution: QueryExecution): string {
  if (execution.error) return execution.error.message;
  const lastWithRows = [...execution.resultSets]
    .reverse()
    .find((resultSet) => resultSet.columns.length > 0);
  if (lastWithRows) {
    return `${formatNumber(lastWithRows.rowCount)} ${lastWithRows.rowCount === 1 ? 'linha' : 'linhas'}`;
  }
  const last = execution.resultSets[execution.resultSets.length - 1];
  return last?.commandTag || 'Nenhum comando executado';
}

function uniqueColumnNames(resultSet: QueryResultSet): string[] {
  const seen = new Map<string, number>();
  return resultSet.columns.map((column) => {
    const count = (seen.get(column.name) ?? 0) + 1;
    seen.set(column.name, count);
    return count === 1 ? column.name : `${column.name}_${count}`;
  });
}

function csvField(value: QueryCell): string {
  if (value === null) return '';
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function resultToCsv(resultSet: QueryResultSet): string {
  const lines = [resultSet.columns.map((column) => csvField(column.name)).join(',')];
  for (const row of resultSet.rows) lines.push(row.map(csvField).join(','));
  // BOM para o Excel reconhecer UTF-8 (acentos).
  return '﻿' + lines.join('\r\n');
}

function jsonValue(value: QueryCell, dataType: string): unknown {
  if (value === null) return null;
  if (dataType === 'bool') return value === 't';
  if (
    dataType === 'int2' ||
    dataType === 'int4' ||
    dataType === 'float4' ||
    dataType === 'float8'
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (dataType === 'json' || dataType === 'jsonb') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function resultToJson(resultSet: QueryResultSet): string {
  const names = uniqueColumnNames(resultSet);
  const objects = resultSet.rows.map((row) =>
    Object.fromEntries(
      row.map((cell, index) => [names[index], jsonValue(cell, resultSet.columns[index].dataType)])
    )
  );
  return JSON.stringify(objects, null, 2);
}

export function rowsToTsv(
  resultSet: QueryResultSet,
  rows: QueryCell[][],
  includeHeader = true
): string {
  const clean = (value: QueryCell) =>
    value === null ? '' : value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  const lines = rows.map((row) => row.map(clean).join('\t'));
  if (includeHeader) lines.unshift(resultSet.columns.map((column) => column.name).join('\t'));
  return lines.join('\n');
}

export function buildViewDataSql(schema: string, name: string, limit = 1000): string {
  return `SELECT * FROM ${qualifiedName(schema, name)}\nLIMIT ${limit};`;
}

export function buildSelectScript(schema: string, name: string, columns: ColumnInfo[]): string {
  const list = columns.length ? columns.map((column) => column.quotedName).join(', ') : '*';
  return `SELECT ${list}\n\tFROM ${qualifiedName(schema, name)};`;
}

export function buildInsertScript(schema: string, name: string, columns: ColumnInfo[]): string {
  const writable = columns.filter((column) => column.identity !== 'a' && !column.generated);
  const names = writable.map((column) => column.quotedName).join(', ');
  const placeholders = writable.map(() => '?').join(', ');
  return `INSERT INTO ${qualifiedName(schema, name)}(\n\t${names})\n\tVALUES (${placeholders});`;
}

// Monta o namespace usado pelo autocomplete do editor: { schema: { tabela: [colunas] } }.
export function buildCompletionNamespace(tables: CompletionTable[]): SQLNamespace {
  const namespace: Record<string, Record<string, string[]>> = {};
  for (const table of tables) {
    (namespace[table.schema] ??= {})[table.name] = table.columns;
  }
  return namespace;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
