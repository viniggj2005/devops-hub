import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Globe, Plus, Trash2 } from 'lucide-react';
import { CreateContainerPortMapping } from '../../../../../interfaces/ContainerInterfaces';

interface PortsSectionProps {
    ports: CreateContainerPortMapping[];
    setPorts: React.Dispatch<React.SetStateAction<CreateContainerPortMapping[]>>;
}

export const PortsSection: React.FC<PortsSectionProps> = ({ ports, setPorts }) => {
    const { dictionary } = useTranslation();
    const createTexts = dictionary.docker.createContainer;
    const addPort = () => setPorts([...ports, { hostPort: '', containerPort: '' }]);
    const removePort = (index: number) => setPorts(ports.filter((_, currentIndex) => currentIndex !== index));
    const updatePort = (index: number, field: keyof CreateContainerPortMapping, value: string) => {
        const nextPorts = [...ports];
        nextPorts[index][field] = value;
        setPorts(nextPorts);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <Globe className="w-4 h-4 text-blue-500" />
                    {createTexts.ports}
                </h3>
                <button
                    onClick={addPort}
                    className="text-xs flex items-center gap-1 text-blue-500 hover:text-blue-400 font-medium transition-colors"
                >
                    <Plus className="w-3 h-3" /> {createTexts.addPort}
                </button>
            </div>

            <div className="space-y-2">
                {ports.map((port, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder={createTexts.hostPort}
                            value={port.hostPort}
                            onChange={(event) => updatePort(rowIndex, 'hostPort', event.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-400">:</span>
                        <input
                            type="text"
                            placeholder={createTexts.containerPort}
                            value={port.containerPort}
                            onChange={(event) => updatePort(rowIndex, 'containerPort', event.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={() => removePort(rowIndex)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {ports.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">{createTexts.noPorts}</p>
                )}
            </div>
        </div>
    );
};
