import React from 'react';
import { Network } from 'lucide-react';
import * as image from '../../../../../../bindings/github.com/docker/docker/api/types/image/models';

interface BasicInfoSectionProps {
  imageName: string;
  containerName: string;
  selectedNetwork: string;
  availableNetworks: any[];
  availableImages: image.Summary[];
  setImageName: (name: string) => void;
  setContainerName: (name: string) => void;
  setSelectedNetwork: (network: string) => void;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  imageName,
  setImageName,
  containerName,
  selectedNetwork,
  availableImages,
  setContainerName,
  availableNetworks,
  setSelectedNetwork,
}) => {
  const inputClass =
    'w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950/70 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
            Nome do Container
          </label>
          <input
            type="text"
            placeholder="Ex: meu-app-web"
            value={containerName}
            onChange={(event) => setContainerName(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
            Imagem <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            list="image-list"
            placeholder="Ex: nginx:latest"
            value={imageName}
            onChange={(event) => setImageName(event.target.value)}
            className={inputClass}
          />
          <datalist id="image-list">
            {availableImages.map((imageItem) => {
              const tag =
                imageItem.RepoTags && imageItem.RepoTags.length > 0
                  ? imageItem.RepoTags[0]
                  : imageItem.Id.substring(0, 12);
              return <option key={imageItem.Id} value={tag} />;
            })}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5 text-emerald-500" />
          Rede
        </label>
        <select
          value={selectedNetwork}
          onChange={(event) => setSelectedNetwork(event.target.value)}
          className={inputClass}
        >
          {availableNetworks.length === 0 ? (
            <option value="bridge" className="dark:bg-zinc-900">
              bridge (padrão)
            </option>
          ) : (
            availableNetworks.map((networkItem) => (
              <option key={networkItem.Id} value={networkItem.Name} className="dark:bg-zinc-900">
                {networkItem.Name} ({networkItem.Driver})
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
};
