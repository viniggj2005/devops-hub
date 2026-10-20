import { talpadbDtos } from '../../../../wailsjs/go/models';
import * as ConnectionsApi from '../../../../wailsjs/go/talpadbHandlers/TalpadbHandlerStruct';
import * as ClientApi from '../../../../wailsjs/go/talpadbHandlers/TalpadbClientHandlerStruct';
import type {
  ColumnInfo,
  SqlFile,
  TableChanges,
  TableSaveResult,
  DropObjectInput,
  DatabaseOptions,
  DatabaseDiagram,
  SavedDiagramLayout,
  CreateDatabaseInput,
  SchemaInfo,
  DatabaseInfo,
  TableDetails,
  QuerySession,
  SchemaObjects,
  QueryExecution,
  ServerDashboard,
  ObjectReference,
  CompletionTable,
  TalpadbConnection,
  ConnectionTestResult,
  TalpadbConnectionInput,
} from '../../../interfaces/TalpadbInterfaces';

export const SESSION_NOT_FOUND_MESSAGE = 'sessão de consulta não encontrada';

const completionCache = new Map<
  string,
  { loadedAt: number; promise: Promise<CompletionTable[]> }
>();
const COMPLETION_CACHE_TTL = 2 * 60 * 1000;

export const TalpadbServices = {
  async findAllConnections(token: string): Promise<TalpadbConnection[]> {
    const list = await ConnectionsApi.FindAllConnections(token);
    return Array.isArray(list) ? (list as TalpadbConnection[]) : [];
  },

  async createConnection(
    token: string,
    body: TalpadbConnectionInput
  ): Promise<TalpadbConnection> {
    return (await ConnectionsApi.CreateConnection(token, body)) as TalpadbConnection;
  },

  async updateConnection(
    token: string,
    id: number,
    body: TalpadbConnectionInput
  ): Promise<TalpadbConnection> {
    return (await ConnectionsApi.UpdateConnection(token, id, body)) as TalpadbConnection;
  },

  async deleteConnection(token: string, id: number): Promise<void> {
    return ConnectionsApi.DeleteConnection(token, id);
  },

  async testConnection(
    token: string,
    id: number,
    body: TalpadbConnectionInput
  ): Promise<ConnectionTestResult> {
    return (await ClientApi.TestConnection(token, id, body)) as ConnectionTestResult;
  },

  async chooseSqliteFile(token: string): Promise<string> {
    return ClientApi.ChooseSqliteFile(token);
  },

  async disconnectServer(token: string, connectionId: number): Promise<void> {
    return ClientApi.DisconnectServer(token, connectionId);
  },

  async disconnectAll(token: string): Promise<void> {
    completionCache.clear();
    return ClientApi.DisconnectAll(token);
  },

  async listDatabases(token: string, connectionId: number): Promise<DatabaseInfo[]> {
    return ((await ClientApi.ListDatabases(token, connectionId)) ?? []) as DatabaseInfo[];
  },

  async listSchemas(token: string, connectionId: number, database: string): Promise<SchemaInfo[]> {
    return ((await ClientApi.ListSchemas(token, connectionId, database)) ?? []) as SchemaInfo[];
  },

  async listSchemaObjects(
    token: string,
    connectionId: number,
    database: string,
    schema: string
  ): Promise<SchemaObjects> {
    return (await ClientApi.ListSchemaObjects(
      token,
      connectionId,
      database,
      schema
    )) as SchemaObjects;
  },

  async listColumns(
    token: string,
    connectionId: number,
    database: string,
    schema: string,
    relation: string
  ): Promise<ColumnInfo[]> {
    return ((await ClientApi.ListColumns(token, connectionId, database, schema, relation)) ??
      []) as ColumnInfo[];
  },

  async getTableDetails(
    token: string,
    connectionId: number,
    database: string,
    schema: string,
    relation: string
  ): Promise<TableDetails> {
    return (await ClientApi.GetTableDetails(
      token,
      connectionId,
      database,
      schema,
      relation
    )) as TableDetails;
  },

  async getObjectDdl(
    token: string,
    connectionId: number,
    database: string,
    object: ObjectReference
  ): Promise<string> {
    return ClientApi.GetObjectDdl(token, connectionId, database, object);
  },

  async getDatabaseOptions(token: string, connectionId: number): Promise<DatabaseOptions> {
    return (await ClientApi.GetDatabaseOptions(token, connectionId)) as DatabaseOptions;
  },

  async previewCreateDatabase(input: CreateDatabaseInput): Promise<string> {
    return ClientApi.PreviewCreateDatabase(input);
  },

  async createDatabase(token: string, connectionId: number, input: CreateDatabaseInput): Promise<void> {
    return ClientApi.CreateDatabase(token, connectionId, input);
  },

  async previewDropObject(token: string, connectionId: number, database: string, input: DropObjectInput): Promise<string> {
    return ClientApi.PreviewDropObject(token, connectionId, database, input);
  },

  async dropObject(token: string, connectionId: number, database: string, input: DropObjectInput): Promise<void> {
    return ClientApi.DropObject(token, connectionId, database, input);
  },

  async getDatabaseDiagram(
    token: string,
    connectionId: number,
    database: string,
    schema: string
  ): Promise<DatabaseDiagram> {
    return (await ClientApi.GetDatabaseDiagram(token, connectionId, database, schema)) as DatabaseDiagram;
  },

  async getDiagramLayout(token: string, connectionId: number, database: string, schema: string): Promise<string> {
    return ConnectionsApi.GetDiagramLayout(token, connectionId, database, schema);
  },

  async saveDiagramLayout(
    token: string,
    connectionId: number,
    database: string,
    schema: string,
    layout: SavedDiagramLayout
  ): Promise<void> {
    return ConnectionsApi.SaveDiagramLayout(token, connectionId, database, schema, JSON.stringify(layout));
  },

  async countRows(
    token: string,
    connectionId: number,
    database: string,
    schema: string,
    relation: string
  ): Promise<number> {
    return ClientApi.CountRows(token, connectionId, database, schema, relation);
  },

  getCompletionSchema(
    token: string,
    connectionId: number,
    database: string
  ): Promise<CompletionTable[]> {
    const key = `${connectionId}/${database}`;
    const cached = completionCache.get(key);
    if (cached && Date.now() - cached.loadedAt < COMPLETION_CACHE_TTL) return cached.promise;

    const promise = ClientApi.GetCompletionSchema(token, connectionId, database).then(
      (tables) => (tables ?? []) as CompletionTable[]
    );
    promise.catch(() => completionCache.delete(key));
    completionCache.set(key, { loadedAt: Date.now(), promise });
    return promise;
  },

  invalidateCompletion(connectionId: number, database?: string) {
    for (const key of completionCache.keys()) {
      if (
        key === `${connectionId}/${database}` ||
        (!database && key.startsWith(`${connectionId}/`))
      ) {
        completionCache.delete(key);
      }
    }
  },

  async openQuerySession(
    token: string,
    connectionId: number,
    database: string
  ): Promise<QuerySession> {
    return (await ClientApi.OpenQuerySession(token, connectionId, database)) as QuerySession;
  },

  async closeQuerySession(token: string, sessionId: string): Promise<void> {
    return ClientApi.CloseQuerySession(token, sessionId);
  },

  async executeQuery(
    token: string,
    sessionId: string,
    sql: string,
    maxRows: number
  ): Promise<QueryExecution> {
    return (await ClientApi.ExecuteQuery(
      token,
      sessionId,
      sql,
      maxRows
    )) as unknown as QueryExecution;
  },

  async cancelQuery(token: string, sessionId: string): Promise<void> {
    return ClientApi.CancelQuery(token, sessionId);
  },

  async saveTableChanges(token: string, sessionId: string, changes: TableChanges): Promise<TableSaveResult> {
    const payload = talpadbDtos.TableChangesDto.createFrom(changes);
    return (await ClientApi.SaveTableChanges(token, sessionId, payload)) as unknown as TableSaveResult;
  },

  async getServerDashboard(
    token: string,
    connectionId: number,
    includeSizes: boolean
  ): Promise<ServerDashboard> {
    return (await ClientApi.GetServerDashboard(
      token,
      connectionId,
      includeSizes
    )) as unknown as ServerDashboard;
  },

  async cancelBackend(token: string, connectionId: number, pid: number): Promise<boolean> {
    return ClientApi.CancelBackend(token, connectionId, pid);
  },

  async terminateBackend(token: string, connectionId: number, pid: number): Promise<boolean> {
    return ClientApi.TerminateBackend(token, connectionId, pid);
  },

  async openSqlFile(token: string): Promise<SqlFile | null> {
    return ((await ClientApi.OpenSqlFile(token)) ?? null) as SqlFile | null;
  },

  async saveTextFile(token: string, defaultFilename: string, content: string): Promise<string> {
    return ClientApi.SaveTextFile(token, defaultFilename, content);
  },
};
