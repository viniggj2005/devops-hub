import iziToast from 'izitoast';
import { useExplorerStore } from './ExplorerStore';
import { usePostgresStore } from '../../PostgresStore';
import type { ContextMenuItem } from '../components/ContextMenu';
import { useAuth } from '../../../../contexts/AuthContext';
import { PostgresServices } from '../../services/PostgresServices';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import type {
  ColumnInfo,
  DdlObjectKind,
  ExplorerNode,
} from '../../../../interfaces/PostgresInterfaces';
import {
  Eye,
  Copy,
  Hash,
  Rows3,
  Unplug,
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
  connectionLabel,
  buildViewDataSql,
  buildSelectScript,
  buildInsertScript,
} from '../../functions/TreatmentFunctions';

const ddlKinds: Partial<Record<ExplorerNode['kind'], DdlObjectKind>> = {
  table: 'table',
  view: 'view',
  matview: 'matview',
  sequence: 'sequence',
  function: 'function',
  schema: 'schema',
};

interface ExplorerActionsOptions {
  onCreateDatabase: (connectionId: number) => void;
}

export function useExplorerActions({ onCreateDatabase }: ExplorerActionsOptions) {
  const { token } = useAuth();
  const { connections, openQueryTab, openTab } = usePostgresStore();

  const showError = (error: unknown) =>
    iziToast.error({ title: 'Erro', message: errorMessage(error), position: 'bottomRight' });

  const nameOf = (connectionId: number) =>
    connectionLabel(connections.find((item) => item.id === connectionId));

  const newQuery = (node: ExplorerNode) =>
    openQueryTab({ connectionId: node.connectionId, database: node.database });

  const viewData = (node: ExplorerNode) =>
    openQueryTab({
      connectionId: node.connectionId,
      database: node.database,
      sql: buildViewDataSql(node.schema as string, node.name as string),
      autoRun: true,
      title: node.name,
    });

  const openProperties = (node: ExplorerNode) =>
    openTab({
      key: `table:${node.connectionId}:${node.database}:${node.schema}:${node.name}`,
      type: 'table',
      title: node.name as string,
      connectionId: node.connectionId,
      connectionName: nameOf(node.connectionId),
      database: node.database as string,
      schema: node.schema,
      objectName: node.name,
    });

  const openDiagram = (node: ExplorerNode) =>
    openTab({
      key: `diagram:${node.connectionId}:${node.database}:${node.schema ?? '*'}`,
      type: 'diagram',
      title: node.schema ? `Diagrama ${node.schema}` : `Diagrama ${node.database}`,
      connectionId: node.connectionId,
      connectionName: nameOf(node.connectionId),
      database: node.database as string,
      schema: node.schema,
    });

  const openDashboard = (node: ExplorerNode) => {
    const connection = connections.find((item) => item.id === node.connectionId);
    openTab({
      key: `dashboard:${node.connectionId}`,
      type: 'dashboard',
      title: 'Dashboard',
      connectionId: node.connectionId,
      connectionName: nameOf(node.connectionId),
      database: connection?.database ?? 'postgres',
    });
  };

  const scriptCreate = async (node: ExplorerNode) => {
    const kind = ddlKinds[node.kind];
    if (!token || !kind || !node.database) return;
    try {
      const ddl = await PostgresServices.getObjectDdl(token, node.connectionId, node.database, {
        kind,
        schema: node.schema ?? '',
        name: (node.kind === 'schema' ? node.schema : node.name) ?? '',
        oid: node.oid ?? 0,
      });
      openQueryTab({
        connectionId: node.connectionId,
        database: node.database,
        sql: ddl,
        title: `${node.kind === 'schema' ? node.schema : node.name} (DDL)`,
      });
    } catch (error) {
      showError(error);
    }
  };

  const loadColumns = async (node: ExplorerNode): Promise<ColumnInfo[]> => {
    const { children, nodes } = useExplorerStore.getState();
    const loaded = (children[node.id] ?? [])
      .map((id) => nodes[id]?.column)
      .filter(Boolean) as ColumnInfo[];
    if (loaded.length) return loaded;
    return PostgresServices.listColumns(
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
        connectionId: node.connectionId,
        database: node.database,
        sql: builder(node.schema as string, node.name as string, columns),
        title: `${node.name} (${suffix})`,
      });
    } catch (error) {
      showError(error);
    }
  };

  const countRows = async (node: ExplorerNode) => {
    if (!token) return;
    const name = qualifiedName(node.schema as string, node.name as string);
    try {
      const count = await PostgresServices.countRows(
        token,
        node.connectionId,
        node.database as string,
        node.schema as string,
        node.name as string
      );
      iziToast.success({
        title: name,
        message: `${formatNumber(count)} ${count === 1 ? 'linha' : 'linhas'}`,
        position: 'bottomRight',
      });
    } catch (error) {
      showError(error);
    }
  };

  const copyName = (node: ExplorerNode) => {
    if (node.kind === 'column') return copyToClipboard(quoteIdent(node.label), 'Nome copiado');
    if (node.kind === 'schema')
      return copyToClipboard(quoteIdent(node.schema as string), 'Nome copiado');
    if (node.kind === 'database') return copyToClipboard(node.label, 'Nome copiado');
    if (node.schema && node.name)
      return copyToClipboard(qualifiedName(node.schema, node.name), 'Nome copiado');
    return copyToClipboard(node.label, 'Nome copiado');
  };

  const disconnect = async (node: ExplorerNode) => {
    if (!token) return;
    try {
      await PostgresServices.disconnectServer(token, node.connectionId);
      useExplorerStore.getState().resetServer(node.connectionId);
      iziToast.info({ title: 'Desconectado', message: node.label, position: 'bottomRight' });
    } catch (error) {
      showError(error);
    }
  };

  const refresh = (node: ExplorerNode) =>
    token && useExplorerStore.getState().refresh(token, node.id);

  const menuItems = (node: ExplorerNode): ContextMenuItem[] => {
    const copy: ContextMenuItem = {
      label: 'Copiar nome',
      icon: Copy,
      onClick: () => copyName(node),
    };
    const refreshItem: ContextMenuItem = {
      label: 'Atualizar',
      icon: RefreshCw,
      onClick: () => refresh(node),
    };
    const separator: ContextMenuItem = { separator: true };
    const createDatabase: ContextMenuItem = {
      label: 'Criar banco de dados…',
      icon: DatabaseZap,
      onClick: () => onCreateDatabase(node.connectionId),
    };
    const diagram: ContextMenuItem = { label: 'Diagrama ER', icon: Network, onClick: () => openDiagram(node) };

    switch (node.kind) {
      case 'server':
        return [
          { label: 'Nova query', icon: FileCode2, onClick: () => newQuery(node) },
          { label: 'Dashboard', icon: Activity, onClick: () => openDashboard(node) },
          createDatabase,
          separator,
          refreshItem,
          {
            label: 'Desconectar',
            icon: Unplug,
            danger: true,
            disabled: !useExplorerStore.getState().connected[node.connectionId],
            onClick: () => disconnect(node),
          },
        ];
      case 'database':
        return [
          { label: 'Nova query', icon: FileCode2, onClick: () => newQuery(node) },
          diagram,
          createDatabase,
          separator,
          refreshItem,
          copy,
        ];
      case 'schema':
        return [
          { label: 'Nova query', icon: FileCode2, onClick: () => newQuery(node) },
          diagram,
          { label: 'Script CREATE', icon: ScrollText, onClick: () => scriptCreate(node) },
          separator,
          refreshItem,
          copy,
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
            label: 'Script SELECT',
            icon: Eye,
            onClick: () => script(node, buildSelectScript, 'SELECT'),
          },
          ...(node.kind === 'table'
            ? [
                {
                  label: 'Script INSERT',
                  icon: FilePlus2,
                  onClick: () => script(node, buildInsertScript, 'INSERT'),
                },
              ]
            : []),
          ...(node.kind === 'matview'
            ? [
                {
                  label: 'Script REFRESH',
                  icon: RefreshCw,
                  onClick: () =>
                    openQueryTab({
                      connectionId: node.connectionId,
                      database: node.database,
                      sql: `REFRESH MATERIALIZED VIEW ${qualifiedName(node.schema as string, node.name as string)};`,
                      title: `${node.name} (REFRESH)`,
                    }),
                },
              ]
            : []),
          separator,
          refreshItem,
          copy,
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
