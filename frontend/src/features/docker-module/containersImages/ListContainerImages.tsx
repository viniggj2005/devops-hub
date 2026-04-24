import iziToast from 'izitoast';
import Toolbar from './components/toolbar/Toolbar';
import ImageCard from './components/cards/ImageCard';
import React, { useMemo, useState, useEffect } from 'react';
import ImageBuildModal from './components/modals/ImageBuildModal';
import { useDockerClient } from '../../../contexts/DockerClientContext';
import { ViewMode } from '../../../interfaces/ContainerImagesInterfaces';
import { ParseNameAndTag } from '../../../features/shared/functions/TreatmentFunction';
import { ContainerImagesService } from './services/ContainerImagesService';

const ListContainersImages: React.FC = () => {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [showBuildModal, setShowBuildModal] = useState(false);
  const { dockerClientId, loading: credentialsLoading, connecting } = useDockerClient();
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

    imagesArray.sort((a, b) => {
      const nameA = ParseNameAndTag(a.RepoTags).name.toLowerCase();
      const nameB = ParseNameAndTag(b.RepoTags).name.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return imagesArray;
  }, [images, query]);

  const handleDeleted = () => {
    fetchImages();
  };

  useEffect(() => {
    if (credentialsLoading) {
      iziToast.info({ title: 'Carregando', message: 'Carregando credenciais...', position: 'bottomRight' });
    } else if (dockerClientId == null) {
      if (!connecting) {
        iziToast.warning({ title: 'Atenção', message: 'Selecione uma credencial Docker.', position: 'bottomRight' });
      }
    } else if (connecting) {
      iziToast.info({ title: 'Conectando', message: 'Conectando ao daemon Docker...', position: 'bottomRight' });
    }
  }, [credentialsLoading, dockerClientId, connecting, loading, filteredSorted.length]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
      <Toolbar
        view={view}
        query={query}
        setView={setView}
        setQuery={setQuery}
        onDeleted={handleDeleted}
        onBuildImage={() => setShowBuildModal(true)}
        disabled={dockerClientId == null || connecting || credentialsLoading}
      />

      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ">
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
          clientId={dockerClientId!}
          onClose={() => setShowBuildModal(false)}
          onSuccess={() => {
            fetchImages();
          }}
        />
      )}
    </div>
  );
};

export default ListContainersImages;
