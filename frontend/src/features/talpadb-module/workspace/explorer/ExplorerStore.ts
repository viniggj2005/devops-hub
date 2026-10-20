import { create } from 'zustand';
import { useTalpadbStore } from '../../TalpadbStore';
import { TalpadbServices } from '../../services/TalpadbServices';
import { engineInfo, engineOf, fileName } from '../../functions/DatabaseEngines';
import { FormatBytes } from '../../../shared/functions/TreatmentFunction';
import { connectionLabel, errorMessage, formatNumber } from '../../functions/TreatmentFunctions';
import type {
  FunctionInfo,
  ExplorerNode,
  RelationInfo,
  DatabaseEngine,
  TalpadbConnection,
  ExplorerNodeKind,
  ExplorerGroupKind,
  ExplorerStoreState,
} from '../../../../interfaces/TalpadbInterfaces';

interface LoadResult {
  nodes: ExplorerNode[];
  children: Record<string, string[]>;
}

const segment = (prefix: string, value: string | number) =>
  `${prefix}:${encodeURIComponent(String(value))}`;

export const serverNodeId = (connectionId: number) => segment('s', connectionId);

const relationDetail = (relation: RelationInfo) => {
  if (relation.kind === 'p') return 'particionada';
  if (relation.kind === 'f') return 'estrangeira';
  return undefined;
};

const programKinds: Record<string, string> = { p: 'procedure', k: 'package' };

const functionLabel = (routine: FunctionInfo, engine: DatabaseEngine) =>
  engine === 'postgres' ? `${routine.name}(${routine.arguments})` : routine.name;

const serverDetail = (connection: TalpadbConnection) => {
  const engine = engineOf(connection);
  if (engine === 'sqlite') return fileName(connection.host);
  if (engine === 'oracle') return `${connection.host}:${connection.port}/${connection.database}`;
  return `${connection.host}:${connection.port}`;
};

const connectionEngine = (connectionId: number) =>
  engineOf(useTalpadbStore.getState().connections.find((connection) => connection.id === connectionId));

async function loadChildren(token: string, node: ExplorerNode): Promise<LoadResult> {
  const result: LoadResult = { nodes: [], children: { [node.id]: [] } };
  const add = (child: ExplorerNode) => {
    result.nodes.push(child);
    (result.children[child.parentId as string] ??= []).push(child.id);
  };
  const base = { connectionId: node.connectionId, database: node.database, schema: node.schema };
  const engine = connectionEngine(node.connectionId);

  switch (node.kind) {
    case 'server': {
      const databases = await TalpadbServices.listDatabases(token, node.connectionId);
      for (const database of databases) {
        add({
          id: `${node.id}/${segment('d', database.name)}`,
          parentId: node.id,
          kind: 'database',
          label: database.name,
          detail: database.sizeBytes !== null ? FormatBytes(database.sizeBytes) : undefined,
          expandable: database.allowConnect,
          disabled: !database.allowConnect,
          connectionId: node.connectionId,
          database: database.name,
        });
      }
      break;
    }
    case 'database': {
      const schemas = await TalpadbServices.listSchemas(
        token,
        node.connectionId,
        node.database as string
      );
      for (const schema of schemas) {
        add({
          id: `${node.id}/${segment('n', schema.name)}`,
          parentId: node.id,
          kind: 'schema',
          label: schema.name,
          expandable: true,
          ...base,
          schema: schema.name,
        });
      }
      break;
    }
    case 'schema': {
      const objects = await TalpadbServices.listSchemaObjects(
        token,
        node.connectionId,
        node.database as string,
        node.schema as string
      );
      const groups: {
        kind: ExplorerGroupKind;
        label: string;
        itemKind: ExplorerNodeKind;
        relations?: RelationInfo[];
      }[] = [
        { kind: 'tables', label: 'Tabelas', itemKind: 'table', relations: objects.tables },
        { kind: 'views', label: 'Views', itemKind: 'view', relations: objects.views },
        {
          kind: 'matviews',
          label: 'Views materializadas',
          itemKind: 'matview',
          relations: objects.materializedViews,
        },
        { kind: 'functions', label: engine === 'oracle' ? 'Funções e pacotes' : 'Funções', itemKind: 'function' },
        {
          kind: 'sequences',
          label: 'Sequências',
          itemKind: 'sequence',
          relations: objects.sequences,
        },
      ];

      const visibleGroups = engineInfo(engine).explorerGroups;
      for (const group of groups.filter((item) => visibleGroups.includes(item.kind))) {
        const groupId = `${node.id}/${segment('g', group.kind)}`;
        const count =
          group.kind === 'functions' ? objects.functions.length : (group.relations?.length ?? 0);
        add({
          id: groupId,
          parentId: node.id,
          kind: 'group',
          label: group.label,
          detail: formatNumber(count),
          expandable: count > 0,
          groupKind: group.kind,
          ...base,
        });
        result.children[groupId] = [];

        if (group.kind === 'functions') {
          for (const routine of objects.functions) {
            add({
              id: `${groupId}/${segment('f', routine.oid)}`,
              parentId: groupId,
              kind: 'function',
              label: functionLabel(routine, engine),
              detail: programKinds[routine.kind] ?? routine.resultType,
              expandable: false,
              ...base,
              name: routine.name,
              oid: routine.oid,
            });
          }
          continue;
        }

        for (const relation of group.relations ?? []) {
          add({
            id: `${groupId}/${segment('r', relation.name)}`,
            parentId: groupId,
            kind: group.itemKind,
            label: relation.name,
            detail: relationDetail(relation),
            expandable: group.itemKind !== 'sequence',
            ...base,
            name: relation.name,
            relationKind: relation.kind,
          });
        }
      }
      break;
    }
    case 'table':
    case 'view':
    case 'matview': {
      const columns = await TalpadbServices.listColumns(
        token,
        node.connectionId,
        node.database as string,
        node.schema as string,
        node.name as string
      );
      for (const column of columns) {
        add({
          id: `${node.id}/${segment('c', column.name)}`,
          parentId: node.id,
          kind: 'column',
          label: column.name,
          detail: column.dataType,
          expandable: false,
          ...base,
          name: node.name,
          column,
        });
      }
      break;
    }
  }
  return result;
}

function collectDescendants(
  children: Record<string, string[]>,
  id: string,
  into: string[] = []
): string[] {
  for (const childId of children[id] ?? []) {
    into.push(childId);
    collectDescendants(children, childId, into);
  }
  return into;
}

function withoutKeys<T>(record: Record<string, T>, keys: string[]): Record<string, T> {
  if (!keys.length) return record;
  const copy = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

const initialState = {
  rootIds: [] as string[],
  nodes: {} as Record<string, ExplorerNode>,
  children: {} as Record<string, string[]>,
  expanded: {} as Record<string, boolean>,
  loading: {} as Record<string, boolean>,
  errors: {} as Record<string, string>,
  connected: {} as Record<number, boolean>,
  selectedId: null as string | null,
};

export const useExplorerStore = create<ExplorerStoreState>((set, get) => {
  const removeSubtrees = (state: ExplorerStoreState, ids: string[], keepRoots: boolean) => {
    const removed = ids.flatMap((id) => collectDescendants(state.children, id));
    if (!keepRoots) removed.push(...ids);
    return {
      nodes: withoutKeys(state.nodes, removed),
      children: withoutKeys(state.children, keepRoots ? [...removed, ...ids] : removed),
      expanded: withoutKeys(state.expanded, keepRoots ? [...removed, ...ids] : removed),
      loading: withoutKeys(state.loading, removed),
      errors: withoutKeys(state.errors, keepRoots ? [...removed, ...ids] : removed),
      selectedId: state.selectedId && removed.includes(state.selectedId) ? null : state.selectedId,
    };
  };

  const load = async (token: string, id: string) => {
    const node = get().nodes[id];
    if (!node || get().loading[id]) return;

    set((state) => ({
      loading: { ...state.loading, [id]: true },
      errors: withoutKeys(state.errors, [id]),
    }));
    try {
      const result = await loadChildren(token, node);
      set((state) => {
        if (!state.nodes[id]) return { loading: withoutKeys(state.loading, [id]) };
        const stale = collectDescendants(state.children, id);
        const nodes = withoutKeys(state.nodes, stale);
        for (const child of result.nodes) nodes[child.id] = child;
        // Ao atualizar, nós recriados com o mesmo id e já carregados (pastas do schema) continuam abertos.
        const reloaded = new Set(result.nodes.map((child) => child.id));
        const collapsed = stale.filter(
          (staleId) => !(reloaded.has(staleId) && result.children[staleId])
        );
        return {
          nodes,
          children: { ...withoutKeys(state.children, stale), ...result.children },
          expanded: withoutKeys(state.expanded, collapsed),
          errors: withoutKeys(state.errors, stale),
          loading: withoutKeys(state.loading, [id]),
          selectedId:
            state.selectedId && stale.includes(state.selectedId) && !reloaded.has(state.selectedId)
              ? null
              : state.selectedId,
          connected:
            node.kind === 'server'
              ? { ...state.connected, [node.connectionId]: true }
              : state.connected,
        };
      });
    } catch (error) {
      set((state) => ({
        loading: withoutKeys(state.loading, [id]),
        errors: { ...state.errors, [id]: errorMessage(error) },
        connected:
          node.kind === 'server'
            ? { ...state.connected, [node.connectionId]: false }
            : state.connected,
      }));
    }
  };

  return {
    ...initialState,

    syncServers: (connections) =>
      set((state) => {
        const rootIds = connections.map((connection) => serverNodeId(connection.id));
        const removedRoots = state.rootIds.filter((id) => !rootIds.includes(id));
        const cleaned = removeSubtrees(state, removedRoots, false);
        const nodes = { ...cleaned.nodes };
        for (const connection of connections) {
          const id = serverNodeId(connection.id);
          nodes[id] = {
            id,
            parentId: null,
            kind: 'server',
            label: connectionLabel(connection),
            detail: serverDetail(connection),
            expandable: true,
            connectionId: connection.id,
          };
        }
        return { ...cleaned, rootIds, nodes };
      }),

    toggle: async (token, id) => {
      if (get().expanded[id]) {
        set((state) => ({ expanded: { ...state.expanded, [id]: false } }));
        return;
      }
      await get().expand(token, id);
    },

    expand: async (token, id) => {
      const node = get().nodes[id];
      if (!node || !node.expandable) return;
      set((state) => ({ expanded: { ...state.expanded, [id]: true } }));
      if (!get().children[id] || get().errors[id]) await load(token, id);
    },

    refresh: async (token, id) => {
      const node = get().nodes[id];
      if (!node) return;
      const targetId = node.kind === 'group' ? (node.parentId as string) : id;
      const target = get().nodes[targetId];
      if (target?.database)
        TalpadbServices.invalidateCompletion(target.connectionId, target.database);
      set((state) => ({ expanded: { ...state.expanded, [targetId]: true } }));
      await load(token, targetId);
    },

    collapseAll: () => set({ expanded: {} }),

    select: (id) => set({ selectedId: id }),

    resetServer: (connectionId) =>
      set((state) => {
        const id = serverNodeId(connectionId);
        return {
          ...removeSubtrees(state, [id], true),
          connected: { ...state.connected, [connectionId]: false },
        };
      }),

    reset: () => set({ ...initialState }),
  };
});
