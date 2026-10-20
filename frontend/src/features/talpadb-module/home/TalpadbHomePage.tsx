import iziToast from 'izitoast';
import React, { useState } from 'react';
import { useTalpadbStore } from '../TalpadbStore';
import ConnectionCard from './components/ConnectionCard';
import { useAuth } from '../../../contexts/AuthContext';
import ConnectionFormModal from './components/ConnectionFormModal';
import { TalpadbServices } from '../services/TalpadbServices';
import { Database, LayoutPanelLeft, Plus, Server, Zap } from 'lucide-react';
import { serverNodeId, useExplorerStore } from '../workspace/explorer/ExplorerStore';
import type { TalpadbConnection } from '../../../interfaces/TalpadbInterfaces';
import { useConfirmToast } from '../../shared/components/toasts/ConfirmToast';
import { engineInfo, engineOf } from '../functions/DatabaseEngines';
import { connectionLabel, errorMessage, formatDuration } from '../functions/TreatmentFunctions';

const TalpadbHomePage: React.FC = () => {
  const { token } = useAuth();
  const confirmToast = useConfirmToast();
  const {
    connections,
    connectionsLoaded,
    loadConnections,
    setView,
    openQueryTab,
    openTab,
    closeConnectionTabs,
  } = useTalpadbStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<TalpadbConnection | null>(null);

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
      key: `dashboard:${connection.id}`,
      type: 'dashboard',
      title: 'Dashboard',
      connectionId: connection.id,
      connectionName: connectionLabel(connection),
      database: connection.database,
    });
  };

  const handleTest = async (connection: TalpadbConnection) => {
    if (!token) return;
    setTestingId(connection.id);
    try {
      const result = await TalpadbServices.testConnection(token, connection.id, {
        engine: connection.engine,
        alias: connection.alias,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        sslMode: connection.sslMode,
      });
      iziToast.success({
        title: 'Conexão OK',
        message: `${engineInfo(engineOf(connection)).label} ${result.serverVersion} · ${formatDuration(result.latencyMs)}`,
        position: 'bottomRight',
      });
    } catch (error) {
      iziToast.error({
        title: 'Falha na conexão',
        message: errorMessage(error),
        position: 'bottomRight',
      });
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

  return (
    <div className="space-y-12 pb-20">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600/10 via-blue-600/5 to-transparent border border-cyan-500/10 p-8 md:p-12">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider mb-6">
            <Zap className="w-3 h-3" />
            PostgreSQL · SQLite · Oracle
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">
            Explore e consulte seus{' '}
            <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              bancos de dados
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 mb-8 leading-relaxed">
            Navegue por bancos, schemas e tabelas, execute queries com autocomplete e acompanhe a
            atividade do servidor em tempo real — tudo em uma única interface.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-cyan-500/25 hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nova Conexão
            </button>
            <button
              onClick={() => setView('workspace')}
              className="px-8 py-4 rounded-2xl font-bold border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 text-gray-700 dark:text-white hover:scale-105 transition-all flex items-center gap-2"
            >
              <LayoutPanelLeft className="w-5 h-5" />
              Abrir Workspace
            </button>
          </div>
        </div>
        <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-10 dark:opacity-20 hidden lg:block">
          <Database className="w-96 h-96 text-cyan-600" />
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900/30 border border-gray-200 dark:border-white/5 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-cyan-500/10 text-cyan-500 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Meus Servidores</h2>
            <p className="text-gray-500 dark:text-zinc-400">
              Conecte-se para explorar os objetos ou abra uma query direto no banco padrão.
            </p>
          </div>
        </div>

        {connectionsLoaded && connections.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-12 rounded-2xl border border-dashed border-gray-300 dark:border-white/10">
            <Database className="w-10 h-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-gray-500 dark:text-zinc-400">
              Nenhuma conexão cadastrada ainda.
            </p>
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-semibold hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Cadastrar primeira conexão
            </button>
          </div>
        ) : (
          <div>
            {connections.map((connection) => (
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
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default TalpadbHomePage;
