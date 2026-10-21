import { Box, Loader2, Search } from 'lucide-react';
import ContainerCard from './components/cards/ContainerCard';
import TerminalModal from './components/modals/TerminalModal';
import { FmtName } from '../../shared/functions/TreatmentFunction';
import { ContainerItem } from '../../../interfaces/ContainerInterfaces';
import { useDockerClient } from '../../../contexts/DockerClientContext';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { getContainers, renameContainer, startContainer, stopContainer, toggleContainerState } from './services/ContainersService';

export interface ContainersListFetchRef {
  refresh: () => Promise<void>;
}

type StatusFilter = 'all' | 'running' | 'paused' | 'stopped';

const ContainersListView = forwardRef<ContainersListFetchRef>((_, ref) => {
  const timerRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [logsModalId, setLogsModalId] = useState<string | null>(null);
  const [menuModalId, setMenuModalId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [terminalModalId, setTerminalModalId] = useState<string | null>(null);
  const [containers, setContainers] = useState<ContainerItem[] | null>(null);
  const [editNameModalId, setEditNameModalId] = useState<string | null>(null);
  const { connecting, dockerClientId, loading: credentialsLoading } = useDockerClient();

  const fetchContainers = useCallback(async () => {
    if (dockerClientId == null) {
      setContainers(null);
      return;
    }
    const containersList = await getContainers(dockerClientId);
    setContainers(containersList);
  }, [dockerClientId]);

  useImperativeHandle(ref, () => ({
    refresh: fetchContainers,
  }));

  const handleRename = async (name: string, id: string) => {
    if (dockerClientId == null) return;
    await renameContainer(dockerClientId, id, name);
    await fetchContainers();
    setEditNameModalId(null);
  };

  const changeContainerStage = async (id: string, state: string) => {
    if (dockerClientId == null) return;
    await toggleContainerState(dockerClientId, id, state);
    await fetchContainers();
  };

  useEffect(() => {
    if (dockerClientId == null) {
      setContainers(null);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    fetchContainers();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(fetchContainers, 3000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [fetchContainers, dockerClientId]);

  const handleStart = async (id: string) => {
    if (dockerClientId == null) return;
    await startContainer(dockerClientId, id);
    await fetchContainers();
  };

  const handleStop = async (id: string) => {
    if (dockerClientId == null) return;
    await stopContainer(dockerClientId, id);
    await fetchContainers();
  };

  const counts = useMemo(() => {
    const list = containers ?? [];
    return {
      all: list.length,
      running: list.filter((item) => item.State === 'running').length,
      paused: list.filter((item) => item.State === 'paused').length,
      stopped: list.filter((item) => item.State !== 'running' && item.State !== 'paused').length,
    };
  }, [containers]);

  const filteredContainers = useMemo(() => {
    if (!containers) return [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return containers.filter((container) => {
      if (statusFilter === 'running' && container.State !== 'running') return false;
      if (statusFilter === 'paused' && container.State !== 'paused') return false;
      if (statusFilter === 'stopped' && (container.State === 'running' || container.State === 'paused')) return false;

      if (!normalizedSearch) return true;
      const formattedName = FmtName(container.Names).toLowerCase();
      const image = (container.Image || '').toLowerCase();
      const shortId = (container.Id || '').toLowerCase();
      const portsText = (container.Ports || [])
        .map((port) => `${port.PublicPort ?? ''}:${port.PrivatePort ?? ''}`)
        .join(' ');

      return (
        formattedName.includes(normalizedSearch) ||
        image.includes(normalizedSearch) ||
        shortId.includes(normalizedSearch) ||
        portsText.includes(normalizedSearch)
      );
    });
  }, [containers, searchQuery, statusFilter]);

  const selectedContainerForTerminal = containers?.find((container) => container.Id === terminalModalId);

  if (credentialsLoading || connecting) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 p-10 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          Conectando ao daemon Docker...
        </p>
      </div>
    );
  }

  if (dockerClientId == null) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-2">
        <Box className="w-8 h-8 text-gray-400 dark:text-zinc-500 mx-auto" />
        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
          Nenhuma credencial Docker selecionada
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Selecione uma credencial na barra superior para listar e administrar os containers.
        </p>
      </div>
    );
  }

  const filterTabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'running', label: 'Em execução', count: counts.running },
    { id: 'paused', label: 'Pausados', count: counts.paused },
    { id: 'stopped', label: 'Parados', count: counts.stopped },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filtrar por nome, imagem, ID ou porta..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/5 self-start md:self-auto overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200/70 dark:bg-white/10 text-gray-700 dark:text-zinc-300">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {containers === null ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 p-10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
            Carregando containers...
          </span>
        </div>
      ) : filteredContainers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-1.5">
          <Box className="w-7 h-7 text-gray-400 dark:text-zinc-500 mx-auto" />
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            Nenhum container encontrado
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {searchQuery || statusFilter !== 'all'
              ? 'Ajuste os filtros de busca ou estado para visualizar outros containers.'
              : 'Crie um novo container para começar a operar neste host.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredContainers.map((container) => {
            const name = FmtName(container.Names);
            const isSeeing = logsModalId === container.Id;
            const isOpened = menuModalId === container.Id;
            const isEditing = editNameModalId === container.Id;

            return (
              <ContainerCard
                key={container.Id}
                name={name}
                isSeeing={isSeeing}
                isOpened={isOpened}
                container={container}
                isEditing={isEditing}
                onRename={handleRename}
                onStart={handleStart}
                onStop={handleStop}
                onTogglePause={changeContainerStage}
                onCloseLogs={() => setLogsModalId(null)}
                onCloseMenu={() => setMenuModalId(null)}
                onCloseEdit={() => setEditNameModalId(null)}
                onOpenLogs={() => setLogsModalId(container.Id)}
                onOpenMenu={() => setMenuModalId(container.Id)}
                onOpenEdit={() => setEditNameModalId(container.Id)}
                onOpenTerminal={() => setTerminalModalId(container.Id)}
                onDeleted={async () => {
                  await fetchContainers();
                  setMenuModalId(null);
                }}
              />
            );
          })}
        </div>
      )}

      {terminalModalId && selectedContainerForTerminal && (
        <TerminalModal
          id={terminalModalId}
          name={FmtName(selectedContainerForTerminal.Names)}
          onClose={() => setTerminalModalId(null)}
        />
      )}

      <footer className="pt-2 text-[11px] text-gray-400 dark:text-zinc-500 flex items-center justify-between">
        <span>Sincronização automática a cada 3s</span>
        <span>{counts.all} container(s) no host</span>
      </footer>
    </div>
  );
});

export default ContainersListView;
