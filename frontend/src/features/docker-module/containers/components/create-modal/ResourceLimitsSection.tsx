import React from 'react';
import { Cpu, HardDrive, LayoutList } from 'lucide-react';

interface ResourceLimitsSectionProps {
    cpu: string;
    memory: string;
    pidsLimit: string;
    setCpu: (value: string) => void;
    setMemory: (value: string) => void;
    setPidsLimit: (value: string) => void;
}

export const ResourceLimitsSection: React.FC<ResourceLimitsSectionProps> = ({
    memory,
    setMemory,
    cpu,
    setCpu,
    pidsLimit,
    setPidsLimit
}) => {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-500" />
                Limites de Recursos (Opcional)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Memória RAM (MB)
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <HardDrive className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="number"
                            min="0"
                            value={memory}
                            onChange={(e) => setMemory(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Ex: 512"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        CPUs (Cores)
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Cpu className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={cpu}
                            onChange={(e) => setCpu(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Ex: 0.5"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Limite de Processos
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <LayoutList className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="number"
                            min="0"
                            value={pidsLimit}
                            onChange={(e) => setPidsLimit(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Ex: 100"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
