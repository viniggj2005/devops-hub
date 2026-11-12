import type { Dictionary } from '../../i18n/Languages';
import { MySQL, PLSQL, PostgreSQL, SQLite, type SQLDialect } from '@codemirror/lang-sql';
import type {
  RunMode,
  DatabaseEngine,
  ExplorerGroupKind,
  TalpadbConnection,
} from '../../../interfaces/TalpadbInterfaces';

export interface EngineInfo {
  label: string;
  dialect: SQLDialect;
  badgeClass: string;
  sslModes: { value: string; descriptionKey: keyof Dictionary['talpadb']['sslModes'] }[];
  columnTypes: string[];
  defaultPort: number;
  defaultSslMode: string;
  defaultDatabase: string;
  defaultUsername: string;
  explorerGroups: ExplorerGroupKind[];
  supportsDashboard: boolean;
  supportsDropSchema: boolean;
  supportsIndexMethods: boolean;
  supportsDropDatabase: boolean;
  supportsColumnChanges: boolean;
  supportsExplainAnalyze: boolean;
  supportsCreateDatabase: boolean;
  supportsConstraintChanges: boolean;
  supportsAtomicAlter: boolean;
}

export const DATABASE_ENGINES: Record<DatabaseEngine, EngineInfo> = {
  postgres: {
    label: 'PostgreSQL',
    dialect: PostgreSQL,
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    sslModes: [
      { value: 'disable', descriptionKey: 'disable' },
      { value: 'prefer', descriptionKey: 'prefer' },
      { value: 'require', descriptionKey: 'require' },
      { value: 'verify-full', descriptionKey: 'verifyFull' },
    ],
    columnTypes: [
      'text', 'uuid', 'date', 'json', 'jsonb', 'bytea', 'serial', 'bigint', 'integer', 'boolean', 'smallint',
      'bigserial', 'timestamp', 'timestamptz', 'numeric(12,2)', 'varchar(255)', 'double precision',
    ],
    defaultPort: 5432,
    defaultSslMode: 'prefer',
    defaultDatabase: 'postgres',
    defaultUsername: 'postgres',
    explorerGroups: ['tables', 'views', 'matviews', 'functions', 'sequences'],
    supportsDashboard: true,
    supportsDropSchema: true,
    supportsIndexMethods: true,
    supportsDropDatabase: true,
    supportsColumnChanges: true,
    supportsExplainAnalyze: true,
    supportsCreateDatabase: true,
    supportsConstraintChanges: true,
    supportsAtomicAlter: true,
  },
  mysql: {
    label: 'MySQL',
    dialect: MySQL,
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    sslModes: [
      { value: 'disable', descriptionKey: 'disable' },
      { value: 'prefer', descriptionKey: 'prefer' },
      { value: 'require', descriptionKey: 'requireNoVerify' },
      { value: 'verify-full', descriptionKey: 'verifyFull' },
    ],
    columnTypes: [
      'VARCHAR(255)', 'TEXT', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT(1)', 'DECIMAL(12,2)',
      'DOUBLE', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'JSON', 'BLOB', 'CHAR(36)',
    ],
    defaultPort: 3306,
    defaultSslMode: 'prefer',
    defaultDatabase: '',
    defaultUsername: 'root',
    explorerGroups: ['tables', 'views', 'functions'],
    supportsDashboard: false,
    supportsDropSchema: true,
    supportsIndexMethods: false,
    supportsDropDatabase: false,
    supportsColumnChanges: true,
    supportsExplainAnalyze: true,
    supportsCreateDatabase: false,
    supportsConstraintChanges: true,
    supportsAtomicAlter: false,
  },
  sqlite: {
    label: 'SQLite',
    dialect: SQLite,
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    sslModes: [],
    columnTypes: ['INTEGER', 'TEXT', 'REAL', 'NUMERIC', 'BLOB', 'BOOLEAN', 'DATE', 'DATETIME'],
    defaultPort: 0,
    defaultSslMode: 'disable',
    defaultDatabase: 'main',
    defaultUsername: '',
    explorerGroups: ['tables', 'views'],
    supportsDashboard: false,
    supportsDropSchema: false,
    supportsIndexMethods: false,
    supportsDropDatabase: false,
    supportsColumnChanges: false,
    supportsExplainAnalyze: false,
    supportsCreateDatabase: false,
    supportsConstraintChanges: false,
    supportsAtomicAlter: true,
  },
  oracle: {
    label: 'Oracle',
    dialect: PLSQL,
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    sslModes: [
      { value: 'disable', descriptionKey: 'disable' },
      { value: 'require', descriptionKey: 'requireNoVerify' },
      { value: 'verify-full', descriptionKey: 'verifyFull' },
    ],
    columnTypes: [
      'VARCHAR2(255)', 'NVARCHAR2(255)', 'CHAR(1)', 'NUMBER', 'NUMBER(10)', 'NUMBER(12,2)', 'INTEGER', 'DATE',
      'TIMESTAMP', 'CLOB', 'BLOB', 'RAW(16)', 'BINARY_DOUBLE',
    ],
    defaultPort: 1521,
    defaultSslMode: 'disable',
    defaultDatabase: '',
    defaultUsername: '',
    explorerGroups: ['tables', 'views', 'matviews', 'functions', 'sequences'],
    supportsDashboard: false,
    supportsDropSchema: false,
    supportsIndexMethods: false,
    supportsDropDatabase: false,
    supportsColumnChanges: true,
    supportsExplainAnalyze: false,
    supportsCreateDatabase: false,
    supportsConstraintChanges: true,
    supportsAtomicAlter: false,
  },
};

export const ENGINE_OPTIONS = Object.keys(DATABASE_ENGINES) as DatabaseEngine[];

export const engineOf = (connection?: Pick<TalpadbConnection, 'engine'> | null): DatabaseEngine =>
  connection?.engine ?? 'postgres';

export const engineInfo = (engine: DatabaseEngine): EngineInfo => DATABASE_ENGINES[engine];

export function connectionAddress(connection: TalpadbConnection): string {
  const engine = engineOf(connection);
  if (engine === 'sqlite') return connection.host;
  const suffix = connection.database ? `/${connection.database}` : '';
  return `${connection.username}@${connection.host}:${connection.port}${suffix}`;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export function defaultSchemaFor(engine: DatabaseEngine, connection?: TalpadbConnection | null): string {
  if (engine === 'sqlite') return 'main';
  if (engine === 'mysql') return connection?.database ?? '';
  if (engine === 'oracle') return (connection?.username ?? '').toUpperCase();
  return 'public';
}

const withoutTrailingSemicolon = (text: string) => text.trim().replace(/;+\s*$/, '');

export function buildExplainSql(engine: DatabaseEngine, mode: RunMode, text: string): { sql: string; prefixLength: number } {
  if (mode === 'run') return { sql: text, prefixLength: 0 };
  if (engine === 'sqlite') {
    const prefix = 'EXPLAIN QUERY PLAN ';
    return { sql: prefix + text, prefixLength: prefix.length };
  }
  if (engine === 'mysql') {
    const prefix = mode === 'explain' ? 'EXPLAIN ' : 'EXPLAIN ANALYZE ';
    return { sql: prefix + text, prefixLength: prefix.length };
  }
  if (engine === 'oracle') {
    const prefix = 'EXPLAIN PLAN FOR ';
    return {
      sql: `${prefix}${withoutTrailingSemicolon(text)};\nSELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY());`,
      prefixLength: prefix.length,
    };
  }
  const prefix = mode === 'explain' ? 'EXPLAIN ' : 'EXPLAIN (ANALYZE, BUFFERS) ';
  return { sql: prefix + text, prefixLength: prefix.length };
}
