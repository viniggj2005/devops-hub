import Toolbar from './components/toolbar/Toolbar';
import ImageCard from './components/cards/ImageCard';
import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import ImageBuildModal from './components/modals/ImageBuildModal';
import { useDockerClient } from '../../../contexts/DockerClientContext';
import { ViewMode } from '../../../interfaces/ContainerImagesInterfaces';
import { ContainerImagesService } from './services/ContainerImagesService';
import { ParseNameAndTag } from '../../../features/shared/functions/TreatmentFunction';

const ListContainersImages: React.FC = () => {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [showBuildModal, setShowBuildModal] = useState(false);
  const { connecting, dockerClientId, loading: credentialsLoading } = useDockerClient();
  const { images, loading, fetchImages } = ContainerImagesService(dockerClientId);

  const filteredSorted = useMemo(() => {
    const lowerCaseQuery = query.trim().toLowerCase();
    let imagesArray = images.slice();

    if (lowerCaseQuery) {
      imagesArray = imagesArray.filter((image) => {
        const { name, tag } = ParseNameAndTag(image.RepoTags);
        const labels = image.Labels ? JSON.stringify(image.Labels).toLowerCase() : '';
        const id = (image.Id ?? '').toLowerCase();
        return (
          name.toLowerCase().includes(lowerCaseQuery) ||
          tag.toLowerCase().includes(lowerCaseQuery) ||
          id.includes(lowerCaseQuery) ||
          labels.includes(lowerCaseQuery)
        );
      });
    }

    imagesArray.sort((firstImage, secondImage) => {
      const nameFirst = ParseNameAndTag(firstImage.RepoTags).name.toLowerCase();
      const nameSecond = ParseNameAndTag(secondImage.RepoTags).name.toLowerCase();
      return nameFirst.localeCompare(nameSecond);
    });

    return imagesArray;
  }, [images, query]);

  const handleDeleted = () => {
    fetchImages(true);
  };

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
        <ImageIcon className="w-8 h-8 text-gray-400 dark:text-zinc-500 mx-auto" />
        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
          Nenhuma credencial Docker selecionada
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Selecione uma credencial na barra superior para listar e gerenciar as imagens.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toolbar
        view={view}
        query={query}
        setView={setView}
        setQuery={setQuery}
        onDeleted={handleDeleted}
        onBuildImage={() => setShowBuildModal(true)}
        disabled={dockerClientId == null || connecting || credentialsLoading}
      />

      {loading && images.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 p-10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
            Carregando imagens...
          </span>
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-1.5">
          <ImageIcon className="w-7 h-7 text-gray-400 dark:text-zinc-500 mx-auto" />
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            Nenhuma imagem encontrada
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {query
              ? 'Nenhuma imagem corresponde aos termos pesquisados.'
              : 'Construa uma nova imagem a partir de um Dockerfile para começar.'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSorted.map((image) => (
            <ImageCard
              key={image.Id ?? Math.random().toString(36)}
              image={image}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSorted.map((image) => (
            <ImageCard
              key={image.Id ?? Math.random().toString(36)}
              image={image}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {showBuildModal && dockerClientId && (
        <ImageBuildModal
          clientId={dockerClientId}
          onClose={() => setShowBuildModal(false)}
          onSuccess={() => {
            fetchImages(true);
          }}
        />
      )}
    </div>
  );
};

export default ListContainersImages;
