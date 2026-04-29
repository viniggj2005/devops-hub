import React from 'react';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ToolbarProps } from '../../../../../interfaces/ContainerImagesInterfaces';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';
import { Blocks, LayoutGrid, Search, TextAlignJustify, Trash2 } from 'lucide-react';
import { PruneImages } from '../../../../../../wailsjs/go/dockerHandlers/DockerSdkHandlerStruct';

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
  const handleDelete = () => {
    if (disabled || selectedCredentialId == null) return;
    confirmToast({
      title: `Imagens sem uso deletadas!`,
      message: `Deseja deletar as imagens sem uso ?`,
      onConfirm: async () => {
        await PruneImages(selectedCredentialId);
        onDeleted?.();
      },
    });
  };
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex-1 max-w-md relative">
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar por nome, tag, ID ou label"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full pl-10 pr-4 py-2 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBuildImage}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:opacity-90 disabled:opacity-50 text-sm transition-colors whitespace-nowrap"
        >
          <p className='flex items-center gap-2'><Blocks className='h-5 w-5' />
            Construir Imagem</p>
        </button>

        <button
          onClick={() => !disabled && setView('grid')}
          disabled={disabled}
          className={`p-2 rounded-lg transition-colors ${view === 'grid'
            ? 'bg-blue-100 dark:bg-blue-600 text-white cursor-not-allowed'
            : 'hover:bg-gray-100 text-gray-600'
            }`}
          title="Grade"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
        <button
          onClick={() => !disabled && setView('table')}
          disabled={disabled}
          className={`p-2 rounded-lg transition-colors ${view === 'table'
            ? 'bg-blue-100 dark:bg-blue-600 text-white cursor-not-allowed'
            : 'hover:bg-gray-100 text-gray-600'
            }`}
          title="Tabela"
        >
          <TextAlignJustify className="h-5 w-5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={disabled}
          className={`p-2  hover:scale-90 rounded-lg items-center justify-center text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"`}
          title="Tabela"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
