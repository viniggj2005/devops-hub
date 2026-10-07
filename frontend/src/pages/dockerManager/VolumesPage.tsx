import { Plus } from 'lucide-react';
import { VolumeItem } from '../../interfaces/VolumeInterfaces';
import { useDockerClient } from '../../contexts/DockerClientContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import VolumeCard from '../../features/docker-module/volumes/components/cards/VolumeCard';
import { VolumeService } from '../../features/docker-module/volumes/services/VolumeService';
import CreateVolumeModal from '../../features/docker-module/volumes/components/modals/CreateVolumeModal';


const VolumesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
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
    } catch (err) {
      console.error('Erro ao carregar volumes Docker:', err);
      setError('Erro ao carregar volumes Docker');
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
    setVolumes((prev) => prev.filter((volume) => volume.Name !== name));
  };

  const safeVolumes = useMemo(() => (Array.isArray(volumes) ? volumes : []), [volumes]);

  if (credentialsLoading || connecting) {
    return <div>Conectando ao cliente Docker...</div>;
  }

  if (!dockerClientId) {
    return <div>Nenhuma credencial Docker selecionada.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Volumes Docker</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Visualize, crie e remova volumes Docker.
        </p>
      </div>

      <button
        onClick={() => setOpenCreateModal(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[0.99] hover:bg-blue-700 hover:shadow-md sm:w-fit"
      >
        <Plus className="h-5 w-5" />
        Novo volume
      </button>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Avisos do Docker:</p>
          <ul className="list-disc pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && <div>Carregando volumes...</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {!loading && safeVolumes.length === 0 && !error && (
        <div className="text-sm text-gray-500">Nenhum volume encontrado.</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {safeVolumes.map((volume) => (
          <VolumeCard key={volume.Name} clientId={dockerClientId} onDeleted={handleDeleted} {...volume} />
        ))}
      </div>

      <CreateVolumeModal open={openCreateModal} onClose={() => setOpenCreateModal(false)} onCreated={fetchVolumes} />
    </div>
  );
};

export default VolumesPage;
