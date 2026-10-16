import iziToast from 'izitoast';
import React, { useMemo, useState } from 'react';
import ContextMenu from '../components/ContextMenu';
import { usePostgresStore } from '../../PostgresStore';
import CreateDatabaseModal from './CreateDatabaseModal';
import { useExplorerActions } from './useExplorerActions';
import { useAuth } from '../../../../contexts/AuthContext';
import { serverNodeId, useExplorerStore } from './ExplorerStore';
import type { ContextMenuItem } from '../components/ContextMenu';
import DropObjectModal, { type DropTarget } from './DropObjectModal';
import ConnectionFormModal from '../../home/components/ConnectionFormModal';
import { connectionLabel, errorMessage } from '../../functions/TreatmentFunctions';
import type { ExplorerNode, PostgresConnection } from '../../../../interfaces/PostgresInterfaces';
import {
  X,
  Eye,
  Plus,
  Link2,
  Layers,
  Search,
  Server,
  Folder,
  Table2,
  Loader2,
  ScanEye,
  Columns3,
  Database,
  KeyRound,
  RefreshCw,
  FolderOpen,
  ListOrdered,
  CircleAlert,
  ChevronRight,
  PanelLeftClose,
  SquareFunction,
  ChevronsDownUp,
} from 'lucide-react';

const CONTAINER_KINDS = new Set(['server', 'database', 'schema', 'group']);

const NodeIcon: React.FC<{ node: ExplorerNode; expanded: boolean; connected: boolean }> = ({
  node,
  expanded,
  connected,
}) => {
  const className = 'w-4 h-4 flex-shrink-0';
  switch (node.kind) {
    case 'server':
      return (
        <span className="relative flex-shrink-0">
          <Server className={`${className} text-cyan-600 dark:text-cyan-400`} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
              connected ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'
            }`}
          />
        </span>
      );
    case 'database':
      return <Database className={`${className} text-amber-500`} />;
    case 'schema':
      return <Layers className={`${className} text-violet-500`} />;
    case 'group':
      return expanded ? (
        <FolderOpen className={`${className} text-yellow-500`} />
      ) : (
        <Folder className={`${className} text-yellow-500`} />
      );
    case 'table':
      return <Table2 className={`${className} text-blue-500`} />;
    case 'view':
      return <Eye className={`${className} text-emerald-500`} />;
    case 'matview':
      return <ScanEye className={`${className} text-teal-500`} />;
    case 'function':
      return <SquareFunction className={`${className} text-pink-500`} />;
    case 'sequence':
      return <ListOrdered className={`${className} text-orange-500`} />;
    case 'column':
      if (node.column?.isPrimaryKey) return <KeyRound className={`${className} text-amber-500`} />;
      if (node.column?.isForeignKey) return <Link2 className={`${className} text-sky-500`} />;
      return <Columns3 className={`${className} text-gray-400`} />;
  }
  return null;
};

function computeFilter(
  term: string,
  rootIds: string[],
  nodes: Record<string, ExplorerNode>,
  children: Record<string, string[]>
) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  const visible = new Set<string>();
  const forceExpanded = new Set<string>();

  // Mostra o que casa com o filtro, seus ancestrais (abertos) e seus descendentes (conforme expansão normal).
  const visit = (id: string, ancestorMatched: boolean): boolean => {
    const node = nodes[id];
    if (!node) return false;
    const selfMatch = node.kind !== 'group' && node.label.toLowerCase().includes(normalized);
    let descendantMatch = false;
    for (const childId of children[id] ?? []) {
      if (visit(childId, ancestorMatched || selfMatch)) descendantMatch = true;
    }
    if (selfMatch || descendantMatch || ancestorMatched) visible.add(id);
    if (descendantMatch) forceExpanded.add(id);
    return selfMatch || descendantMatch;
  };
  rootIds.forEach((id) => visit(id, false));
  return { visible, forceExpanded };
}

const ObjectExplorer: React.FC<{ onCollapse: () => void }> = ({ onCollapse }) => {
  const { token } = useAuth();
  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const connections = usePostgresStore((state) => state.connections);
  const loadConnections = usePostgresStore((state) => state.loadConnections);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [createDatabaseFor, setCreateDatabaseFor] = useState<number | null>(null);
  const actions = useExplorerActions({ onDropObject: setDropTarget, onCreateDatabase: setCreateDatabaseFor });
  const { rootIds, nodes, children, expanded, loading, errors, connected, selectedId } =
    useExplorerStore();
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    node: ExplorerNode;
    items: ContextMenuItem[];
  } | null>(null);

  const filtered = useMemo(
    () => computeFilter(filter, rootIds, nodes, children),
    [filter, rootIds, nodes, children]
  );

  const reloadConnections = async () => {
    if (!token) return;
    try {
      const list = await loadConnections(token);
      useExplorerStore.getState().syncServers(list);
    } catch (error) {
      iziToast.error({ title: 'Erro', message: errorMessage(error), position: 'bottomRight' });
    }
  };

  const handleClick = (node: ExplorerNode) => {
    useExplorerStore.getState().select(node.id);
    if (CONTAINER_KINDS.has(node.kind) && token) useExplorerStore.getState().toggle(token, node.id);
  };

  const handleContextMenu = (event: React.MouseEvent, node: ExplorerNode) => {
    event.preventDefault();
    useExplorerStore.getState().select(node.id);
    setMenu({ x: event.clientX, y: event.clientY, node, items: actions.menuItems(node) });
  };

  const renderNode = (id: string, depth: number): React.ReactNode => {
    const node = nodes[id];
    if (!node || (filtered && !filtered.visible.has(id))) return null;

    const isExpanded = Boolean(expanded[id] || filtered?.forceExpanded.has(id));
    const isLoading = Boolean(loading[id]);
    const nodeChildren = children[id];
    const indent = 8 + depth * 14;

    return (
      <React.Fragment key={id}>
        <div
          role="treeitem"
          aria-expanded={node.expandable ? isExpanded : undefined}
          title={node.detail ? `${node.label} — ${node.detail}` : node.label}
          style={{ paddingLeft: indent }}
          onClick={() => handleClick(node)}
          onDoubleClick={() => actions.defaultAction(node)}
          onContextMenu={(event) => handleContextMenu(event, node)}
          className={`group flex items-center gap-1.5 h-7 pr-2 rounded-lg cursor-pointer select-none text-[13px] transition-colors ${
            selectedId === id
              ? 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
              : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5'
          } ${node.disabled ? 'opacity-50' : ''}`}
        >
          <span
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400"
            onClick={(event) => {
              if (!node.expandable || !token) return;
              event.stopPropagation();
              useExplorerStore.getState().select(node.id);
              useExplorerStore.getState().toggle(token, node.id);
            }}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
            ) : node.expandable ? (
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            ) : null}
          </span>
          <NodeIcon
            node={node}
            expanded={isExpanded}
            connected={Boolean(connected[node.connectionId])}
          />
          <span className={`truncate ${node.kind === 'server' ? 'font-semibold' : ''}`}>
            {node.label}
          </span>
          {node.detail && (
            <span className="ml-auto pl-2 text-[11px] text-gray-400 dark:text-zinc-500 truncate flex-shrink-0 max-w-[45%]">
              {node.detail}
            </span>
          )}
        </div>

        {isExpanded && (
          <>
            {errors[id] && (
              <div
                style={{ paddingLeft: indent + 22 }}
                className="flex items-start gap-1.5 pr-2 py-1 text-[12px] text-rose-600 dark:text-rose-400"
              >
                <CircleAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="break-words min-w-0">{errors[id]}</span>
                <button
                  onClick={() => token && useExplorerStore.getState().refresh(token, id)}
                  className="ml-auto flex-shrink-0 underline underline-offset-2 hover:text-rose-700"
                >
                  tentar de novo
                </button>
              </div>
            )}
            {nodeChildren?.map((childId) => renderNode(childId, depth + 1))}
            {nodeChildren &&
              nodeChildren.length === 0 &&
              !isLoading &&
              !errors[id] &&
              !filtered && (
                <div
                  style={{ paddingLeft: indent + 22 }}
                  className="h-6 flex items-center text-[12px] italic text-gray-400"
                >
                  vazio
                </div>
              )}
          </>
        )}
      </React.Fragment>
    );
  };

  const headerButton =
    'h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10 transition-colors';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-800/30 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">
            Explorador
          </h3>
          <div className="flex items-center gap-0.5">
            <button title="Nova conexão" onClick={() => setFormOpen(true)} className={headerButton}>
              <Plus className="w-4 h-4" />
            </button>
            <button
              title="Recarregar conexões"
              onClick={reloadConnections}
              className={headerButton}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              title="Recolher tudo"
              onClick={() => useExplorerStore.getState().collapseAll()}
              className={headerButton}
            >
              <ChevronsDownUp className="w-4 h-4" />
            </button>
            <button title="Recolher explorador (Ctrl+B)" onClick={onCollapse} className={headerButton}>
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrar objetos carregados…"
            className="w-full h-8 pl-8 pr-7 rounded-lg text-xs outline-none border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div role="tree" className="flex-1 min-h-0 overflow-auto p-2">
        {rootIds.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center px-4 py-10">
            <Database className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
            <p className="text-xs text-gray-400">Nenhuma conexão cadastrada.</p>
            <button
              onClick={() => setFormOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20 transition-colors"
            >
              Nova conexão
            </button>
          </div>
        ) : (
          <>
            {rootIds.map((id) => renderNode(id, 0))}
            {filtered && filtered.visible.size === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">
                Nada encontrado entre os objetos já carregados.
              </p>
            )}
          </>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={menu.node.label}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}

      <ConnectionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={async (saved: PostgresConnection) => {
          await reloadConnections();
          useExplorerStore.getState().select(serverNodeId(saved.id));
        }}
        connection={null}
      />

      <CreateDatabaseModal
        connectionId={createDatabaseFor}
        onClose={() => setCreateDatabaseFor(null)}
        connectionName={connectionLabel(connections.find((connection) => connection.id === createDatabaseFor))}
        onCreated={(connectionId) => token && useExplorerStore.getState().refresh(token, serverNodeId(connectionId))}
      />

      <DropObjectModal target={dropTarget} onClose={() => setDropTarget(null)} />
    </div>
  );
};

export default ObjectExplorer;
