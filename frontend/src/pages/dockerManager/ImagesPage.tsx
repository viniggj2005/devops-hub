import React from 'react';
import ListContainersImages from '../../features/docker-module/containersImages/ListContainerImages';

const ImagesPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      <div className="pb-5 border-b border-gray-200 dark:border-white/5 space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Imagens Docker
        </h1>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Pesquise, construa novas tags a partir de Dockerfile e gerencie o cache de imagens do host.
        </p>
      </div>

      <ListContainersImages />
    </div>
  );
};

export default ImagesPage;
