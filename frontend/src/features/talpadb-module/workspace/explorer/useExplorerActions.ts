import toast from 'react-hot-toast';
import { useExplorerStore } from './ExplorerStore';
import { useTalpadbStore } from '../../TalpadbStore';
import { useAuth } from '../../../../contexts/AuthContext';
import type { ContextMenuItem } from '../components/ContextMenu';
import { TalpadbServices } from '../../services/TalpadbServices';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import { engineInfo, engineOf } from '../../functions/DatabaseEngines';
import type { DropObjectType, DropTarget } from './DropObjectModal';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import type {
  ColumnInfo,
  ExplorerNode,
  DdlObjectKind,
  TalpadbConnection,
} from '../../../../interfaces/TalpadbInterfaces';
import {
  Eye,
  Zap,
  Copy,
  Hash,
  Rows3,
  Unplug,
  Pencil,
  Trash2,
  Network,
  Activity,
  FileCode2,
  RefreshCw,
  FilePlus2,
  ScrollText,
  DatabaseZap,
  TableProperties,
} from 'lucide-react';
import {
  quoteIdent,
  errorMessage,
  formatNumber,
  qualifiedName,
  formatDuration,
  connectionLabel,
  buildViewDataSql,
  buildSelectScript,
  buildInsertScript,
} from '../../functions/TreatmentFunctions';

const ddlKinds: Partial<Record<ExplorerNode['kind'], DdlObjectKind>> = {
  view: 'view',
  table: 'table',
  schema: 'schema',
  matview: 'matview',
  sequence: 'sequence',
  function: 'function',
};

interface ExplorerActionsOptions {
  onReloadConnections: () => Promise<void>;
  onDropObject: (target: DropTarget) => void;
  onCreateDatabase: (connectionId: number) => void;
  onEditConnection: (connection: TalpadbConnection) => void;
}

export function useExplorerActions({
  onDropObject,
  onEditConnection,
  onCreateDatabase,
  onReloadConnections,
}: ExplorerActionsOptions) {
  const { token } = useAuth();
  const confirmToast = useConfirmToast();
  const { openTab, connections, openQueryTab, closeConnectionTabs } = useTalpadbStore();

  const showError = (error: unknown) => toast.error(errorMessage(error));

  const findConnection = (connectionId: number) =>
    connections.find((item) => item.id === connectionId);

  const nameOf = (connectionId: number) => connectionLabel(findConnection(connectionId));

  const engineFor = (node: ExplorerNode) => engineOf(findConnection(node.connectionId));

  const newQuery = (node: ExplorerNode) =>
    openQueryTab({ connectionId: node.connectionId, database: node.database });

  const viewData = (node: ExplorerNode) =>
    openQueryTab({
      autoRun: true,
      title: node.name,
      database: node.database,
      connectionId: node.connectionId,
      sql: buildViewDataSql(node.schema as string, node.name as string, engineFor(node)),
    });

  const openProperties = (node: ExplorerNode) =>
    openTab({
      type: 'table',
      schema: node.schema,
      objectName: node.name,
      title: node.name as string,
      connectionId: node.connectionId,
      database: node.database as string,
      connectionName: nameOf(node.connectionId),
      key: `table:${node.connectionId}:${node.database}:${node.schema}:${node.name}`,
    });

  const openDiagram = (node: ExplorerNode) =>
    openTab({
      type: 'diagram',
      schema: node.schema,
      connectionId: node.connectionId,
      database: node.database as string,
      connectionName: nameOf(node.connectionId),
      key: `diagram:${node.connectionId}:${node.database}:${node.schema ?? '*'}`,
      title: node.schema ? `Diagrama ${node.schema}` : `Diagrama ${node.database}`,
    });

  const openDashboard = (node: ExplorerNode) => {
    const connection = findConnection(node.connectionId);
    openTab({
      type: 'dashboard',
      title: 'Dashboard',
      connectionId: node.connectionId,
      key: `dashboard:${node.connectionId}`,
      connectionName: nameOf(node.connectionId),
      database: connection?.database ?? 'postgres',
    });
  };

  const testServerConnection = async (node: ExplorerNode) => {
    const connection = findConnection(node.connectionId);
    if (!token || !connection) return;
    try {
      const result = await TalpadbServices.testConnection(token, connection.id, {
        host: connection.host,
        port: connection.port,
        alias: connection.alias,
        engine: connection.engine,
        sslMode: connection.sslMode,
        database: connection.database,
        username: connection.username,
      });
      toast.success(
        `Conexão OK: ${engineInfo(engineOf(connection)).label} ${result.serverVersion} · ${formatDuration(result.latencyMs)}`
      );
    } catch (error) {
      toast.error(`Falha na conexão: ${errorMessage(error)}`);
    }
  };

  const removeServerConnection = (node: ExplorerNode) => {
    const connection = findConnection(node.connectionId);
    if (!connection) return;
    const label = connectionLabel(connection);
    confirmToast({
      id: `talpadb-connection-${connection.id}`,
      title: `Conexão ${label} deletada!`,
      message: `Deseja deletar a conexão: ${label}?`,
      onConfirm: async () => {
        await TalpadbServices.deleteConnection(token ?? '', connection.id);
        closeConnectionTabs(connection.id);
        await onReloadConnections();
      },
    });
  };

  const scriptCreate = async (node: ExplorerNode) => {
    const kind = ddlKinds[node.kind];
    if (!token || !kind || !node.database) return;
    try {
      const ddl = await TalpadbServices.getObjectDdl(token, node.connectionId, node.database, {
        kind,
        oid: node.oid ?? 0,
        schema: node.schema ?? '',
        name: (node.kind === 'schema' ? node.schema : node.name) ?? '',
      });
      openQueryTab({
        sql: ddl,
        database: node.database,
        connectionId: node.connectionId,
        title: `${node.kind === 'schema' ? node.schema : node.name} (DDL)`,
      });
    } catch (error) {
      showError(error);
    }
  };

  const loadColumns = async (node: ExplorerNode): Promise<ColumnInfo[]> => {
    const { children, nodes } = useExplorerStore.getState();
    const loaded = (children[node.id] ?? [])
      .map((childId) => nodes[childId]?.column)
      .filter(Boolean) as ColumnInfo[];
    if (loaded.length) return loaded;
    return TalpadbServices.listColumns(
      token ?? '',
      node.connectionId,
      node.database as string,
      node.schema as string,
      node.name as string
    );
  };

  const script = async (node: ExplorerNode, builder: typeof buildSelectScript, suffix: string) => {
    try {
      const columns = await loadColumns(node);
      openQueryTab({
        database: node.database,
        connectionId: node.connectionId,
        title: `${node.name} (${suffix})`,
        sql: builder(node.schema as string, node.name as string, columns, engineFor(node)),
      });
    } catch (error) {
      showError(error);
    }
  };

  const countRows = async (node: ExplorerNode) => {
    if (!token) return;
    const name = qualifiedName(node.schema as string, node.name as string, engineFor(node));
    try {
      const count = await TalpadbServices.countRows(
        token,
        node.connectionId,
        node.database as string,
        node.schema as string,
        node.name as string
      );
      toast.success(`${name}: ${formatNumber(count)} ${count === 1 ? 'linha' : 'linhas'}`);
    } catch (error) {
      showError(error);
    }
  };

  const copyName = (node: ExplorerNode) => {
    const engine = engineFor(node);
    if (node.kind === 'column') return copyToClipboard(quoteIdent(node.label, engine), 'Nome copiado');
    if (node.kind === 'schema')
      return copyToClipboard(quoteIdent(node.schema as string, engine), 'Nome copiado');
    if (node.kind === 'database') return copyToClipboard(node.label, 'Nome copiado');
    if (node.schema && node.name)
      return copyToClipboard(qualifiedName(node.schema, node.name, engine), 'Nome copiado');
    return copyToClipboard(node.label, 'Nome copiado');
  };

  const disconnect = async (node: ExplorerNode) => {
    if (!token) return;
    try {
      await TalpadbServices.disconnectServer(token, node.connectionId);
      useExplorerStore.getState().resetServer(node.connectionId);
      toast(`Desconectado: ${node.label}`);
    } catch (error) {
      showError(error);
    }
  };

  const refresh = (node: ExplorerNode) =>
    token && useExplorerStore.getState().refresh(token, node.id);

  const refreshMaterializedViewSql = (node: ExplorerNode) => {
    const engine = engineFor(node);
    const name = qualifiedName(node.schema as string, node.name as string, engine);
    if (engine === 'oracle') return `BEGIN
  DBMS_MVIEW.REFRESH('${name.replace(/'/g, "''")}');
END;`;
    return `REFRESH MATERIALIZED VIEW ${name};`;
  };

  const menuItems = (node: ExplorerNode): ContextMenuItem[] => {
    const info = engineInfo(engineFor(node));
    const copy: ContextMenuItem = {
      icon: Copy,
      label: 'Copiar nome',
      onClick: () => copyName(node),
    };
    const refreshItem: ContextMenuItem = {
      icon: RefreshCw,
      label: 'Atualizar',
      onClick: () => refresh(node),
    };
    const separator: ContextMenuItem = { separator: true };
    const createDatabase: ContextMenuItem = {
      icon: DatabaseZap,
      label: 'Criar banco de dados…',
      onClick: () => onCreateDatabase(node.connectionId),
    };
    const diagram: ContextMenuItem = { label: 'Diagrama ER', icon: Network, onClick: () => openDiagram(node) };
    const dropItem = (type: DropObjectType, name: string): ContextMenuItem => ({
      icon: Trash2,
      danger: true,
      label: 'Excluir…',
      onClick: () =>
        onDropObject({
          type,
          name,
          schema: node.schema ?? '',
          database: node.database ?? '',
          parentNodeId: node.parentId,
          connectionId: node.connectionId,
        }),
    });

    const dashboardItems: ContextMenuItem[] = info.supportsDashboard
      ? [{ label: 'Dashboard', icon: Activity, onClick: () => openDashboard(node) }]
      : [];
    const createDatabaseItems = info.supportsCreateDatabase ? [createDatabase] : [];
    const dropDatabaseItems = info.supportsDropDatabase ? [separator, dropItem('database', node.database ?? node.label)] : [];
    const dropSchemaItems = info.supportsDropSchema ? [separator, dropItem('schema', node.schema ?? node.label)] : [];

    switch (node.kind) {
      case 'server': {
        const connection = findConnection(node.connectionId);
        return [
          { label: 'Nova query', icon: FileCode2, onClick: () => newQuery(node) },
          ...dashboardItems,
          ...createDatabaseItems,
          separator,
          { label: 'Testar conexão', icon: Zap, onClick: () => testServerConnection(node) },
          ...(connection
            ? [
                {
                  icon: Pencil,
                  label: 'Editar conexão…',
                  onClick: () => onEditConnection(connection),
                },
              ]
            : []),
          refreshItem,
          separator,
          {
            icon: Unplug,
            label: 'Desconectar',
            disabled: !useExplorerStore.getState().connected[node.connectionId],
            onClick: () => disconnect(node),
          },
          {
            icon: Trash2,
            danger: true,
            label: 'Excluir conexão…',
            onClick: () => removeServerConnection(node),
          },
        ];
      }
      case 'database':
        return [
          { label: 'Nova query', icon: FileCode2, onClick: () => newQuery(node) },
          diagram,
          ...createDatabaseItems,
          separator,
          refreshItem,
          copy,
          ...dropDatabaseItems,
        ];
      case 'schema':
        return [
          { label: 'Nova query', icon: FileCode2, onClick: () => newQuery(node) },
          diagram,
          { label: 'Script CREATE', icon: ScrollText, onClick: () => scriptCreate(node) },
          separator,
          refreshItem,
          copy,
          ...dropSchemaItems,
        ];
      case 'group':
        return [refreshItem];
      case 'table':
      case 'view':
      case 'matview':
        return [
          { label: 'Ver dados (1000 linhas)', icon: Rows3, onClick: () => viewData(node) },
          ...(node.kind === 'table'
            ? [{ label: 'Contar linhas', icon: Hash, onClick: () => countRows(node) }]
            : []),
          { label: 'Propriedades', icon: TableProperties, onClick: () => openProperties(node) },
          separator,
          { label: 'Script CREATE', icon: ScrollText, onClick: () => scriptCreate(node) },
          {
            icon: Eye,
            label: 'Script SELECT',
            onClick: () => script(node, buildSelectScript, 'SELECT'),
          },
          ...(node.kind === 'table'
            ? [
                {
                  icon: FilePlus2,
                  label: 'Script INSERT',
                  onClick: () => script(node, buildInsertScript, 'INSERT'),
                },
              ]
            : []),
          ...(node.kind === 'matview'
            ? [
                {
                  icon: RefreshCw,
                  label: 'Script REFRESH',
                  onClick: () =>
                    openQueryTab({
                      database: node.database,
                      connectionId: node.connectionId,
                      title: `${node.name} (REFRESH)`,
                      sql: refreshMaterializedViewSql(node),
                    }),
                },
              ]
            : []),
          separator,
          refreshItem,
          copy,
          separator,
          dropItem(node.kind, node.name ?? node.label),
        ];
      case 'function':
      case 'sequence':
        return [
          { label: 'Script CREATE', icon: ScrollText, onClick: () => scriptCreate(node) },
          separator,
          copy,
        ];
      case 'column':
        return [copy];
    }
    return [];
  };

  const defaultAction = (node: ExplorerNode) => {
    if (node.kind === 'table' || node.kind === 'view' || node.kind === 'matview') viewData(node);
    if (node.kind === 'function' || node.kind === 'sequence') scriptCreate(node);
  };

  return { menuItems, defaultAction, newQuery };
}
