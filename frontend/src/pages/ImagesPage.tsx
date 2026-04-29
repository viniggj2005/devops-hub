import React from 'react';
import ListContainersImages from '../features/docker-module/containersImages/ListContainerImages';

const ImagesPage: React.FC = () => {
  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Imagens Docker
        </h1>
        <p className="text-gray-500 dark:text-zinc-400">
          Pesquise, organize e remova imagens quando necessário.
        </p>
      </div>

      <ListContainersImages />
    </div>
  );
};

export default ImagesPage;
