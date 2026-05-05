import { Plus, RefreshCcw } from 'lucide-react';
import React, { useRef, useState } from 'react';
import ContainersListView, { ContainersListFetchRef } from '../../features/docker-module/containers/ContainersList';
import { CreateContainerModal } from '../../features/docker-module/containers/components/modals/CreateContainerModal';


const ContainersPage: React.FC = () => {
  const containerListRef = useRef<ContainersListFetchRef>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleRefresh = () => {
    containerListRef.current?.refresh();
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Containers Docker
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Monitore e administre seus contêineres em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-200"
            title="Atualizar"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-md hover:shadow-lg hover:from-blue-500 hover:to-blue-600 transition-all flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Container</span>
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
