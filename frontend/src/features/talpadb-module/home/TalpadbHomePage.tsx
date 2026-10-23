import toast from 'react-hot-toast';
import React, { useMemo, useState } from 'react';
import { useTalpadbStore } from '../TalpadbStore';
import ConnectionCard from './components/ConnectionCard';
import { useAuth } from '../../../contexts/AuthContext';
import { tabIcons } from '../workspace/constants/TabIcons';
import { TalpadbServices } from '../services/TalpadbServices';
import ConnectionFormModal from './components/ConnectionFormModal';
import { engineInfo, engineOf } from '../functions/DatabaseEngines';
import { serverNodeId, useExplorerStore } from '../workspace/explorer/ExplorerStore';
import { useConfirmToast } from '../../shared/components/toasts/ConfirmToast';
import { Database, LayoutPanelLeft, Plus, Search, Server, X } from 'lucide-react';
import { connectionLabel, errorMessage, formatDuration } from '../functions/TreatmentFunctions';
import type { DatabaseEngine, TalpadbConnection } from '../../../interfaces/TalpadbInterfaces';

const engineFilters: { value: 'all' | DatabaseEngine; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'oracle', label: 'Oracle' },
];

const TalpadbHomePage: React.FC = () => {
  const { token } = useAuth();
  const confirmToast = useConfirmToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const connected = useExplorerStore((state) => state.connected);
  const [editing, setEditing] = useState<TalpadbConnection | null>(null);
  const [engineFilter, setEngineFilter] = useState<'all' | DatabaseEngine>('all');
  const {
    tabs,
    openTab,
    setView,
    connections,
    setActiveTab,
    openQueryTab,
    loadConnections,
    connectionsLoaded,
    closeConnectionTabs,
  } = useTalpadbStore();

  const reload = async () => {
    if (!token) return;
    const list = await loadConnections(token);
    useExplorerStore.getState().syncServers(list);
  };

  const handleSaved = async (saved: TalpadbConnection) => {
    useExplorerStore.getState().resetServer(saved.id);
    TalpadbServices.invalidateCompletion(saved.id);
    await reload();
  };

  const handleConnect = (connection: TalpadbConnection) => {
    if (!token) return;
    const id = serverNodeId(connection.id);
    setView('workspace');
    useExplorerStore.getState().select(id);
    useExplorerStore.getState().expand(token, id);
  };

  const handleDashboard = (connection: TalpadbConnection) => {
    openTab({
      type: 'dashboard',
      title: 'Dashboard',
      connectionId: connection.id,
      database: connection.database,
      key: `dashboard:${connection.id}`,
      connectionName: connectionLabel(connection),
    });
  };

  const handleTest = async (connection: TalpadbConnection) => {
    if (!token) return;
    setTestingId(connection.id);
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
    } finally {
      setTestingId(null);
    }
  };

  const handleRemove = (connection: TalpadbConnection) => {
    const label = connectionLabel(connection);
    confirmToast({
      id: `talpadb-connection-${connection.id}`,
      title: `Conexão ${label} deletada!`,
      message: `Deseja deletar a conexão: ${label}?`,
      onConfirm: async () => {
        await TalpadbServices.deleteConnection(token ?? '', connection.id);
        closeConnectionTabs(connection.id);
        await reload();
      },
    });
  };

  const filteredConnections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return connections.filter((connection) => {
      const engine = engineOf(connection);
      if (engineFilter !== 'all' && engine !== engineFilter) return false;
      if (!normalizedSearch) return true;
      return (
        connectionLabel(connection).toLowerCase().includes(normalizedSearch) ||
        connection.host.toLowerCase().includes(normalizedSearch) ||
        connection.database.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [connections, engineFilter, search]);

  const connectedCount = useMemo(
    () => connections.filter((connection) => connected[connection.id]).length,
    [connections, connected]
  );

  return (
    <div className="space-y-6 pb-16">
      <section className="bg-white dark:bg-zinc-900/40 border border-gray-200 dark:border-white/5 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 text-cyan-500 rounded-xl shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Servidores Cadastrados
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  {connections.length} {connections.length === 1 ? 'servidor' : 'servidores'}
                </span>
                {connectedCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {connectedCount} {connectedCount === 1 ? 'conectado' : 'conectados'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Gerencie credenciais, teste a latência ou abra conexões direto no Workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setView('workspace')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <LayoutPanelLeft className="w-4 h-4 text-cyan-500" />
              Ir ao Workspace
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Conexão
            </button>
          </div>
        </div>

        {tabs.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 shrink-0 mr-1">
              Abas abertas:
            </span>
            {tabs.map((tab) => {
              const { icon: Icon, className } = tabIcons[tab.type];
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setView('workspace');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-cyan-500/10 text-xs font-medium text-gray-700 dark:text-zinc-300 shrink-0 transition-colors"
                >
                  <Icon className={`w-3.5 h-3.5 ${className}`} />
                  <span className="truncate max-w-[140px]">{tab.title}</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                    ({tab.connectionName})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-zinc-900/40 border border-gray-200 dark:border-white/5 rounded-2xl p-6 space-y-5">
        {connections.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, host ou banco..."
                className="w-full h-9 pl-9 pr-8 rounded-xl text-xs outline-none border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:border-cyan-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5 self-start">
              {engineFilters.map((filterItem) => (
                <button
                  key={filterItem.value}
                  onClick={() => setEngineFilter(filterItem.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    engineFilter === filterItem.value
                      ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {filterItem.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {connectionsLoaded && connections.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-12 rounded-2xl border border-dashed border-gray-300 dark:border-white/10">
            <Database className="w-10 h-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Nenhuma conexão cadastrada ainda.
            </p>
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="mt-1 px-5 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Cadastrar primeira conexão
            </button>
          </div>
        ) : filteredConnections.length === 0 ? (
          <p className="py-10 text-center text-xs text-gray-400">
            Nenhum servidor corresponde ao filtro selecionado.
          </p>
        ) : (
          <div>
            {filteredConnections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                testing={testingId === connection.id}
                onConnect={handleConnect}
                onQuery={(item) => openQueryTab({ connectionId: item.id })}
                onDashboard={handleDashboard}
                onTest={handleTest}
                onEdit={(item) => {
                  setEditing(item);
                  setModalOpen(true);
                }}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </section>

      <ConnectionFormModal
        open={modalOpen}
        connection={editing}
        onSaved={handleSaved}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default TalpadbHomePage;
