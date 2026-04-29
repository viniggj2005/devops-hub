import React from 'react';
import { Server, Plus, Trash2 } from 'lucide-react';
import { CreateContainerEnvVar } from '../../../../../interfaces/ContainerInterfaces';

interface EnvVarsSectionProps {
    envVars: CreateContainerEnvVar[];
    setEnvVars: React.Dispatch<React.SetStateAction<CreateContainerEnvVar[]>>;
}

export const EnvVarsSection: React.FC<EnvVarsSectionProps> = ({ envVars, setEnvVars }) => {
    const addEnv = () => setEnvVars([...envVars, { key: '', value: '' }]);
    const removeEnv = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
    const updateEnv = (index: number, field: keyof CreateContainerEnvVar, value: string) => {
        const newEnv = [...envVars];
        newEnv[index][field] = value;
        setEnvVars(newEnv);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <Server className="w-4 h-4 text-purple-500" />
                    Variáveis de Ambiente
                </h3>
                <button
                    onClick={addEnv}
                    className="text-xs flex items-center gap-1 text-purple-500 hover:text-purple-400 font-medium transition-colors"
                >
                    <Plus className="w-3 h-3" /> Adicionar Variável
                </button>
            </div>

            <div className="space-y-2">
                {envVars.map((env, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Chave (ex: NODE_ENV)"
                            value={env.key}
                            onChange={(e) => updateEnv(idx, 'key', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-400">=</span>
                        <input
                            type="text"
                            placeholder="Valor (ex: production)"
                            value={env.value}
                            onChange={(e) => updateEnv(idx, 'value', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={() => removeEnv(idx)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {envVars.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">Nenhuma variável definida.</p>
                )}
            </div>
        </div>
    );
};
