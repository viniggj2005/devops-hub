import type { SplitDropZone, SplitLayout } from './SplitInterfaces';

export type DatabaseEngine = 'postgres' | 'sqlite' | 'oracle';

export interface TalpadbConnection {
  id: number;
  alias: string;
  engine: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode: string;
  hasPassword: boolean;
}

export interface TalpadbConnectionInput {
  alias?: string;
  engine?: DatabaseEngine;
  host: string;
  port?: number;
  database?: string;
  username: string;
  password?: string;
  sslMode?: string;
  clearPassword?: boolean;
}

export interface ConnectionTestResult {
  serverVersion: string;
  latencyMs: number;
}

export interface DatabaseInfo {
  name: string;
  owner: string;
  encoding: string;
  sizeBytes: number | null;
  allowConnect: boolean;
  comment: string | null;
}

export interface DatabaseOptions {
  roles: string[];
  templates: string[];
  currentUser: string;
  defaultCtype: string;
  defaultCollate: string;
  defaultEncoding: string;
}

export interface CreateDatabaseInput {
  name: string;
  owner: string;
  ctype: string;
  comment: string;
  collate: string;
  template: string;
  encoding: string;
  connectionLimit: number;
}

export type DropObjectKind = 'database' | 'schema' | 'relation';

export interface DropObjectInput {
  name: string;
  force: boolean;
  schema: string;
  cascade: boolean;
  kind: DropObjectKind;
}

export interface DiagramColumn {
  name: string;
  notNull: boolean;
  isUnique: boolean;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface DiagramTable {
  name: string;
  kind: string;
  schema: string;
  comment: string | null;
  columns: DiagramColumn[];
}

export interface DiagramRelation {
  name: string;
  sourceTable: string;
  targetTable: string;
  sourceSchema: string;
  targetSchema: string;
  sourceColumns: string[];
  targetColumns: string[];
}

export type DiagramLineStyle = 'curved' | 'straight' | 'orthogonal';

export interface DiagramPoint {
  x: number;
  y: number;
}

export type DiagramAnchorSide = 'left' | 'right' | 'top' | 'bottom';

export interface DiagramEdgeAnchor {
  side: DiagramAnchorSide;
  offset: number | null;
}

export interface DiagramEdgeAnchors {
  source?: DiagramEdgeAnchor;
  target?: DiagramEdgeAnchor;
}

export interface SavedDiagramLayout {
  keysOnly: boolean;
  lineStyle: DiagramLineStyle;
  edges: Record<string, DiagramPoint[]>;
  positions: Record<string, DiagramPoint>;
  anchors: Record<string, DiagramEdgeAnchors>;
}

export interface DatabaseDiagram {
  truncated: boolean;
  tables: DiagramTable[];
  relations: DiagramRelation[];
}

export interface SchemaInfo {
  name: string;
  owner: string;
  comment: string | null;
}

export interface RelationInfo {
  name: string;
  kind: string;
  estimatedRows: number;
  comment: string | null;
}

export interface FunctionInfo {
  oid: number;
  name: string;
  arguments: string;
  resultType: string;
  kind: string;
}

export interface SchemaObjects {
  tables: RelationInfo[];
  views: RelationInfo[];
  materializedViews: RelationInfo[];
  sequences: RelationInfo[];
  functions: FunctionInfo[];
}

export interface ColumnInfo {
  position: number;
  name: string;
  quotedName: string;
  dataType: string;
  notNull: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  identity: string;
  generated: string;
  collation: string | null;
  comment: string | null;
}

export interface IndexInfo {
  name: string;
  quotedName: string;
  definition: string;
  isUnique: boolean;
  isPrimary: boolean;
  sizeBytes: number;
  constraintBacked: boolean;
}

export interface ConstraintInfo {
  name: string;
  quotedName: string;
  type: string;
  definition: string;
  isLocal: boolean;
}

export interface TriggerInfo {
  name: string;
  definition: string;
  enabled: boolean;
}

export interface TableDetails {
  schema: string;
  name: string;
  kind: string;
  owner: string;
  estimatedRows: number;
  totalSizeBytes: number;
  tableSizeBytes: number;
  indexSizeBytes: number;
  comment: string | null;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  triggers: TriggerInfo[];
  ddl: string;
}

export interface ColumnDraft {
  id: string;
  name: string;
  comment: string;
  dropped: boolean;
  notNull: boolean;
  dataType: string;
  defaultValue: string;
  original: ColumnInfo | null;
}

export interface IndexDraft {
  id: string;
  name: string;
  method: string;
  unique: boolean;
  columns: string;
}

export type ConstraintDraftType = 'p' | 'u' | 'c' | 'f';

export interface ConstraintDraft {
  id: string;
  name: string;
  columns: string;
  expression: string;
  references: string;
  type: ConstraintDraftType;
}

export interface TableDraft {
  name: string;
  comment: string;
  columns: ColumnDraft[];
  newIndexes: IndexDraft[];
  droppedIndexes: string[];
  droppedConstraints: string[];
  newConstraints: ConstraintDraft[];
}

export type DdlObjectKind = 'table' | 'view' | 'matview' | 'sequence' | 'function' | 'schema';

export interface ObjectReference {
  kind: DdlObjectKind;
  schema: string;
  name: string;
  oid: number;
}

export interface CompletionTable {
  schema: string;
  name: string;
  columns: string[];
}

export interface QuerySession {
  engine: DatabaseEngine;
  sessionId: string;
  database: string;
  serverVersion: string;
  backendPid: number;
}

export interface QueryColumn {
  name: string;
  dataType: string;
  typeOid: number;
}

export type QueryCell = string | null;

export interface EditableTable {
  name: string;
  schema: string;
  tableOid: number;
  keyColumns: number[];
  columnNumbers: number[];
}

export interface QueryResultSet {
  columns: QueryColumn[];
  rows: QueryCell[][];
  rowCount: number;
  truncated: boolean;
  commandTag: string;
  rowsAffected: number;
  editable: EditableTable | null;
}

export interface CellValue {
  column: number;
  value: QueryCell;
}

export interface RowChange {
  key: CellValue[];
  values: CellValue[];
}

export interface TableChanges {
  tableOid: number;
  updates: RowChange[];
  deletes: RowChange[];
  inserts: RowChange[];
}

export interface TableSaveResult {
  updated: number;
  deleted: number;
  inserted: number;
  committed: boolean;
  txStatus: TxStatus;
}

export interface QueryMessage {
  severity: string;
  code: string;
  message: string;
  detail: string;
  hint: string;
  where: string;
  position: number;
}

export type TxStatus = 'idle' | 'transaction' | 'failed' | 'closed' | 'unknown';

export interface QueryExecution {
  resultSets: QueryResultSet[];
  notices: QueryMessage[];
  error: QueryMessage | null;
  durationMs: number;
  txStatus: TxStatus;
  reconnected: boolean;
}

export interface SqlFile {
  path: string;
  name: string;
  content: string;
}

export interface DatabaseStat {
  name: string;
  sizeBytes: number | null;
  connections: number;
  xactCommit: number;
  xactRollback: number;
  blocksRead: number;
  blocksHit: number;
  tupReturned: number;
  tupFetched: number;
  tupInserted: number;
  tupUpdated: number;
  tupDeleted: number;
}

export interface ServerSession {
  pid: number;
  user: string | null;
  database: string | null;
  applicationName: string;
  clientAddress: string | null;
  state: string | null;
  waitEvent: string | null;
  backendType: string | null;
  backendSeconds: number | null;
  transactionSeconds: number | null;
  querySeconds: number | null;
  query: string | null;
  isCurrent: boolean;
}

export interface ServerDashboard {
  version: string;
  serverVersion: string;
  startTime: string;
  uptimeSeconds: number;
  maxConnections: number;
  currentUser: string;
  isSuperuser: boolean;
  inRecovery: boolean;
  sampledAt: number;
  databases: DatabaseStat[];
  sessions: ServerSession[];
}

export type TalpadbView = 'home' | 'workspace';

export type WorkspaceTabType = 'query' | 'table' | 'diagram' | 'dashboard';

export interface WorkspaceTab {
  id: string;
  key?: string;
  type: WorkspaceTabType;
  title: string;
  connectionId: number;
  connectionName: string;
  database: string;
  schema?: string;
  objectName?: string;
  initialSql?: string;
  autoRun?: boolean;
}

export type OpenWorkspaceTabInput = Omit<WorkspaceTab, 'id'>;

export interface OpenQueryTabInput {
  connectionId: number;
  database?: string;
  sql?: string;
  autoRun?: boolean;
  title?: string;
}

export interface WorkspaceGroup {
  id: string;
  layout: SplitLayout;
  paneIds: string[];
  focusedPaneId: string;
}

export interface TalpadbStoreState {
  view: TalpadbView;
  queryCounter: number;
  tabs: WorkspaceTab[];
  groups: WorkspaceGroup[];
  connectionsLoaded: boolean;
  activeTabId: string | null;
  activeGroupId: string | null;
  draggingGroupId: string | null;
  connections: TalpadbConnection[];
  tabTxStatus: Record<string, TxStatus>;
  reset: () => void;
  closeTab: (id: string) => void;
  detachPane: (id: string) => void;
  setActiveTab: (id: string) => void;
  closeGroup: (groupId: string) => void;
  setView: (view: TalpadbView) => void;
  setActiveGroup: (groupId: string) => void;
  renameTab: (id: string, title: string) => void;
  updateTab: (id: string, changes: Partial<OpenWorkspaceTabInput>) => void;
  openTab: (input: OpenWorkspaceTabInput) => void;
  openQueryTab: (input: OpenQueryTabInput) => void;
  setDraggingGroup: (groupId: string | null) => void;
  closeConnectionTabs: (connectionId: number) => void;
  closeMatchingTabs: (matches: (tab: WorkspaceTab) => boolean) => void;
  setTabTxStatus: (id: string, status: TxStatus) => void;
  loadConnections: (token: string) => Promise<TalpadbConnection[]>;
  mergeGroupInto: (sourceGroupId: string, targetGroupId: string, dropZone: SplitDropZone) => void;
}

export type ExplorerNodeKind =
  | 'server'
  | 'database'
  | 'schema'
  | 'group'
  | 'table'
  | 'view'
  | 'matview'
  | 'function'
  | 'sequence'
  | 'column';

export type ExplorerGroupKind = 'tables' | 'views' | 'matviews' | 'functions' | 'sequences';

export interface ExplorerNode {
  id: string;
  parentId: string | null;
  kind: ExplorerNodeKind;
  label: string;
  detail?: string;
  expandable: boolean;
  disabled?: boolean;
  connectionId: number;
  database?: string;
  schema?: string;
  name?: string;
  oid?: number;
  groupKind?: ExplorerGroupKind;
  relationKind?: string;
  column?: ColumnInfo;
}

export interface ExplorerStoreState {
  rootIds: string[];
  nodes: Record<string, ExplorerNode>;
  children: Record<string, string[]>;
  expanded: Record<string, boolean>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  connected: Record<number, boolean>;
  selectedId: string | null;
  syncServers: (connections: TalpadbConnection[]) => void;
  toggle: (token: string, id: string) => Promise<void>;
  expand: (token: string, id: string) => Promise<void>;
  refresh: (token: string, id: string) => Promise<void>;
  collapseAll: () => void;
  select: (id: string | null) => void;
  resetServer: (connectionId: number) => void;
  reset: () => void;
}

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: number;
  durationMs: number;
  success: boolean;
  summary: string;
}

export type RunMode = 'run' | 'explain' | 'explain-analyze';
