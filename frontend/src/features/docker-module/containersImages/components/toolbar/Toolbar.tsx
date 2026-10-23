import React from 'react';
import toast from 'react-hot-toast';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ToolbarProps } from '../../../../../interfaces/ContainerImagesInterfaces';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';
import { Blocks, LayoutGrid, Search, TextAlignJustify, Trash2 } from 'lucide-react';
import { PruneImages } from '../../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';

const Toolbar: React.FC<ToolbarProps> = ({
  view,
  query,
  setView,
  setQuery,
  onDeleted,
  onBuildImage,
  disabled = false,
}) => {
  const confirmToast = useConfirmToast();
  const { selectedCredentialId } = useDockerClient();

  const handlePrune = () => {
    if (disabled || selectedCredentialId == null) return;
    confirmToast({
      id: 'prune-images',
      title: 'Limpar imagens sem uso?',
      message: 'Deseja remover todas as imagens não utilizadas (dangling) deste host?',
      onConfirm: async () => {
        await PruneImages(selectedCredentialId);
        toast.success('As imagens sem uso foram removidas.');
        onDeleted?.();
      },
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome, tag, ID ou label..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={onBuildImage}
          disabled={disabled}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Blocks className="h-3.5 w-3.5" />
          <span>Construir Imagem</span>
        </button>

        <button
          type="button"
          onClick={handlePrune}
          disabled={disabled}
          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-gray-700 dark:text-zinc-300 transition-all flex items-center gap-1.5 cursor-pointer"
          title="Remover imagens não utilizadas"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Limpar sem uso</span>
        </button>

        <div className="flex items-center p-1 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={() => !disabled && setView('grid')}
            disabled={disabled}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              view === 'grid'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
            title="Visualização em grade"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => !disabled && setView('table')}
            disabled={disabled}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              view === 'table'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
            title="Visualização em lista"
          >
            <TextAlignJustify className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
