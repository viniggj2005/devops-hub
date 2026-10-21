import { VolumeItem } from '../../interfaces/VolumeInterfaces';
import { useDockerClient } from '../../contexts/DockerClientContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HardDrive, Loader2, Plus, RefreshCcw, Search } from 'lucide-react';
import VolumeCard from '../../features/docker-module/volumes/components/cards/VolumeCard';
import { VolumeService } from '../../features/docker-module/volumes/services/VolumeService';
import CreateVolumeModal from '../../features/docker-module/volumes/components/modals/CreateVolumeModal';

const VolumesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<VolumeItem[]>([]);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const { connecting, dockerClientId, loading: credentialsLoading } = useDockerClient();

  const fetchVolumes = useCallback(async () => {
    if (!dockerClientId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await VolumeService.listVolumes(dockerClientId);

      const volumesList = response?.Volumes ?? [];
      const warningsList = response?.Warnings ?? [];

      setVolumes(Array.isArray(volumesList) ? volumesList : []);
      setWarnings(Array.isArray(warningsList) ? warningsList.filter(Boolean) : []);
    } catch (fetchError) {
      console.error('Erro ao carregar volumes Docker:', fetchError);
      setError('Erro ao carregar volumes Docker.');
      setVolumes([]);
    } finally {
      setLoading(false);
    }
  }, [dockerClientId]);

  useEffect(() => {
    if (!dockerClientId || credentialsLoading || connecting) return;
    fetchVolumes();
  }, [dockerClientId, credentialsLoading, connecting, fetchVolumes]);

  const handleDeleted = (name: string) => {
    setVolumes((previous) => previous.filter((volume) => volume.Name !== name));
  };

  const filteredVolumes = useMemo(() => {
    const safeList = Array.isArray(volumes) ? volumes : [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return safeList;

    return safeList.filter((volume) => {
      const name = (volume.Name || '').toLowerCase();
      const driver = (volume.Driver || '').toLowerCase();
      const mountpoint = (volume.Mountpoint || '').toLowerCase();
      return (
        name.includes(normalizedQuery) ||
        driver.includes(normalizedQuery) ||
        mountpoint.includes(normalizedQuery)
      );
    });
  }, [volumes, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-white/5">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Volumes Docker
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Visualize, inspecione, crie e remova volumes de armazenamento persistente.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchVolumes}
            disabled={!dockerClientId || connecting || loading}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl hover:border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-200 cursor-pointer"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenCreateModal(true)}
            disabled={!dockerClientId || connecting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo Volume</span>
          </button>
        </div>
      </div>

      {credentialsLoading || connecting ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 p-10 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            Conectando ao cliente Docker...
          </p>
        </div>
      ) : !dockerClientId ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-2">
          <HardDrive className="w-8 h-8 text-gray-400 dark:text-zinc-500 mx-auto" />
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            Nenhuma credencial Docker selecionada
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Selecione uma credencial na barra superior para gerenciar os volumes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filtrar volumes por nome, driver ou mountpoint..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-semibold mb-1">Avisos do Docker:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 p-10 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                Carregando volumes...
              </span>
            </div>
          ) : filteredVolumes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-1.5">
              <HardDrive className="w-7 h-7 text-gray-400 dark:text-zinc-500 mx-auto" />
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                Nenhum volume encontrado
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {searchQuery
                  ? 'Nenhum volume corresponde à busca informada.'
                  : 'Crie um novo volume para persistir dados dos seus containers.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredVolumes.map((volume) => (
                <VolumeCard
                  key={volume.Name}
                  clientId={dockerClientId}
                  onDeleted={handleDeleted}
                  {...volume}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateVolumeModal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        onCreated={fetchVolumes}
      />
    </div>
  );
};

export default VolumesPage;
