import React from 'react';
import { Network } from 'lucide-react';
import { image } from '../../../../../../wailsjs/go/models';

interface BasicInfoSectionProps {
    containerName: string;
    setContainerName: (name: string) => void;
    imageName: string;
    setImageName: (name: string) => void;
    selectedNetwork: string;
    setSelectedNetwork: (network: string) => void;
    availableImages: image.Summary[];
    availableNetworks: any[];
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
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nome do Container
                    </label>
                    <input
                        type="text"
                        placeholder="Ex: meu-app-web"
                        value={containerName}
                        onChange={(e) => setContainerName(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-900 dark:text-white"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Imagem (Obrigatório)
                    </label>
                    <input
                        type="text"
                        list="image-list"
                        placeholder="Ex: nginx:latest"
                        value={imageName}
                        onChange={(e) => setImageName(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-900 dark:text-white"
                    />
                    <datalist id="image-list">
                        {availableImages.map((img) => {
                            const tag = img.RepoTags && img.RepoTags.length > 0 ? img.RepoTags[0] : img.Id.substring(0, 12);
                            return <option key={img.Id} value={tag} />;
                        })}
                    </datalist>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Network className="w-4 h-4 text-green-500" />
                    Rede
                </label>
                <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all text-gray-900 dark:text-white appearance-none"
                    style={{ backgroundImage: 'none' }}
                >
                    {availableNetworks.map((net) => (
                        <option key={net.Id} value={net.Name}>
                            {net.Name} ({net.Driver})
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};
