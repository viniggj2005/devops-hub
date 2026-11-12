import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { HardDrive, Plus, Trash2 } from 'lucide-react';
import { CreateContainerVolumeMapping } from '../../../../../interfaces/ContainerInterfaces';

interface VolumesSectionProps {
    volumes: CreateContainerVolumeMapping[];
    setVolumes: React.Dispatch<React.SetStateAction<CreateContainerVolumeMapping[]>>;
    availableVolumes: any[];
}

export const VolumesSection: React.FC<VolumesSectionProps> = ({ volumes, setVolumes, availableVolumes }) => {
    const { dictionary } = useTranslation();
    const createTexts = dictionary.docker.createContainer;
    const addVolume = () => setVolumes([...volumes, { hostPath: '', containerPath: '' }]);
    const removeVolume = (index: number) => setVolumes(volumes.filter((_, currentIndex) => currentIndex !== index));
    const updateVolume = (index: number, field: keyof CreateContainerVolumeMapping, value: string) => {
        const nextVolumes = [...volumes];
        nextVolumes[index][field] = value;
        setVolumes(nextVolumes);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <HardDrive className="w-4 h-4 text-orange-500" />
                    {createTexts.volumes}
                </h3>
                <button
                    onClick={addVolume}
                    className="text-xs flex items-center gap-1 text-orange-500 hover:text-orange-400 font-medium transition-colors"
                >
                    <Plus className="w-3 h-3" /> {createTexts.addVolume}
                </button>
            </div>

            <div className="space-y-2">
                {volumes.map((volume, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-3">
                        <input
                            type="text"
                            list="volume-list"
                            placeholder={createTexts.hostPath}
                            value={volume.hostPath}
                            onChange={(event) => updateVolume(rowIndex, 'hostPath', event.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-gray-900 dark:text-white"
                        />
                        <datalist id="volume-list">
                            {availableVolumes.map((volumeOption) => (
                                <option key={volumeOption.Name} value={volumeOption.Name} />
                            ))}
                        </datalist>
                        <span className="text-gray-400">:</span>
                        <input
                            type="text"
                            placeholder={createTexts.containerPath}
                            value={volume.containerPath}
                            onChange={(event) => updateVolume(rowIndex, 'containerPath', event.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={() => removeVolume(rowIndex)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {volumes.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">{createTexts.noVolumes}</p>
                )}
            </div>
        </div>
    );
};
