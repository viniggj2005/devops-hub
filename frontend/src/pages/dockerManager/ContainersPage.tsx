import { Plus, RefreshCcw } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useDockerClient } from '../../contexts/DockerClientContext';
import ContainersListView, { ContainersListFetchRef } from '../../features/docker-module/containers/ContainersList';
import { CreateContainerModal } from '../../features/docker-module/containers/components/modals/CreateContainerModal';

const ContainersPage: React.FC = () => {
  const { connecting, dockerClientId } = useDockerClient();
  const containerListRef = useRef<ContainersListFetchRef>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleRefresh = () => {
    containerListRef.current?.refresh();
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-white/5">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Containers Docker
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Monitore e administre seus contêineres em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!dockerClientId || connecting}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl hover:border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-200 cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!dockerClientId || connecting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Container</span>
          </button>
        </div>
      </div>

      <ContainersListView ref={containerListRef} />

      <CreateContainerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
};

export default ContainersPage;
