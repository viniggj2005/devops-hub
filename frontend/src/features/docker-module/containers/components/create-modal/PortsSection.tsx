import React from 'react';
import { Globe, Plus, Trash2 } from 'lucide-react';
import { CreateContainerPortMapping } from '../../../../../interfaces/ContainerInterfaces';

interface PortsSectionProps {
    ports: CreateContainerPortMapping[];
    setPorts: React.Dispatch<React.SetStateAction<CreateContainerPortMapping[]>>;
}

export const PortsSection: React.FC<PortsSectionProps> = ({ ports, setPorts }) => {
    const addPort = () => setPorts([...ports, { hostPort: '', containerPort: '' }]);
    const removePort = (index: number) => setPorts(ports.filter((_, i) => i !== index));
    const updatePort = (index: number, field: keyof CreateContainerPortMapping, value: string) => {
        const newPorts = [...ports];
        newPorts[index][field] = value;
        setPorts(newPorts);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <Globe className="w-4 h-4 text-blue-500" />
                    Mapeamento de Portas
                </h3>
                <button
                    onClick={addPort}
                    className="text-xs flex items-center gap-1 text-blue-500 hover:text-blue-400 font-medium transition-colors"
                >
                    <Plus className="w-3 h-3" /> Adicionar Porta
                </button>
            </div>

            <div className="space-y-2">
                {ports.map((port, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Host Port (ex: 8080)"
                            value={port.hostPort}
                            onChange={(e) => updatePort(idx, 'hostPort', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-400">:</span>
                        <input
                            type="text"
                            placeholder="Container Port (ex: 80)"
                            value={port.containerPort}
                            onChange={(e) => updatePort(idx, 'containerPort', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={() => removePort(idx)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {ports.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">Nenhuma porta mapeada.</p>
                )}
            </div>
        </div>
    );
};
