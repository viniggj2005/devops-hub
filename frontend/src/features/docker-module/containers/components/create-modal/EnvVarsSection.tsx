import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Server, Plus, Trash2 } from 'lucide-react';
import { CreateContainerEnvVar } from '../../../../../interfaces/ContainerInterfaces';

interface EnvVarsSectionProps {
    envVars: CreateContainerEnvVar[];
    setEnvVars: React.Dispatch<React.SetStateAction<CreateContainerEnvVar[]>>;
}

export const EnvVarsSection: React.FC<EnvVarsSectionProps> = ({ envVars, setEnvVars }) => {
    const { dictionary } = useTranslation();
    const createTexts = dictionary.docker.createContainer;
    const addEnv = () => setEnvVars([...envVars, { key: '', value: '' }]);
    const removeEnv = (index: number) => setEnvVars(envVars.filter((_, currentIndex) => currentIndex !== index));
    const updateEnv = (index: number, field: keyof CreateContainerEnvVar, value: string) => {
        const nextEnvVars = [...envVars];
        nextEnvVars[index][field] = value;
        setEnvVars(nextEnvVars);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <Server className="w-4 h-4 text-purple-500" />
                    {createTexts.environment}
                </h3>
                <button
                    onClick={addEnv}
                    className="text-xs flex items-center gap-1 text-purple-500 hover:text-purple-400 font-medium transition-colors"
                >
                    <Plus className="w-3 h-3" /> {createTexts.addVariable}
                </button>
            </div>

            <div className="space-y-2">
                {envVars.map((envVar, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder={createTexts.variableKey}
                            value={envVar.key}
                            onChange={(event) => updateEnv(rowIndex, 'key', event.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-400">=</span>
                        <input
                            type="text"
                            placeholder={createTexts.variableValue}
                            value={envVar.value}
                            onChange={(event) => updateEnv(rowIndex, 'value', event.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={() => removeEnv(rowIndex)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {envVars.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">{createTexts.noVariables}</p>
                )}
            </div>
        </div>
    );
};
