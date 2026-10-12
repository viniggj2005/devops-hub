import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, EyeOff, Settings } from 'lucide-react';
import { useAppStore } from '../features/appFrame/AppStore';
import { appModules } from '../features/shared/constants/AppModules';
import { useGeneralConfigsStore } from '../features/settings/store/GeneralConfigsStore';
import { POSTGRES_MODULE, PostgresModuleIcon } from '../features/postgres-module/moduleInfo';
import { moduleIconBackground } from '../features/settings/functions/ModuleIconBackground';

const MainHomePage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { openTab } = useAppStore();
    const configsLoaded = useGeneralConfigsStore(state => state.loaded);
    const modulesConfig = useGeneralConfigsStore(state => state.modules);

    const visibleModules = [
        ...appModules
            .filter(module => modulesConfig[module.configName].showOnHome)
            .map(module => ({
                ...module,
                iconNode: <img src={module.icon} alt={module.title} className="w-14 h-14 brightness-0 invert" />,
            })),
        {
            id: 'postgres' as const,
            configName: undefined,
            homePath: undefined as string | undefined,
            title: POSTGRES_MODULE.name,
            description: POSTGRES_MODULE.description,
            color: POSTGRES_MODULE.gradient,
            status: 'Ativo' as const,
            iconNode: <PostgresModuleIcon className="w-14 h-14 text-white" />,
        },
    ];
    const hasVisibleActiveModule = visibleModules.some(module => module.status === 'Ativo');

    return (
        <div className="h-full overflow-y-auto bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-white flex flex-col">

            <header className="relative z-10 p-6 md:p-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">DeployOps Console</h1>
                    <p className="text-gray-500 dark:text-zinc-400 mt-1">Bem-vindo de volta, {user?.nome || 'Usuário'}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => openTab('settings')}
                        aria-label="Configurações"
                        title="Configurações"
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-colors"
                    >
                        <Settings className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
            </header>


            <main className="flex-1 flex flex-col items-center justify-center p-6 -mt-20">
                <div className="max-w-5xl w-full">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-5 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            O que vamos gerenciar hoje?
                        </h2>
                        <p className="text-lg text-gray-500 dark:text-zinc-400">
                            Selecione um módulo para começar a operar sua infraestrutura.
                        </p>
                    </div>

                    {configsLoaded && !hasVisibleActiveModule && (
                        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-gray-300 dark:border-white/10 p-10 mb-6 text-center">
                            <EyeOff className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                            <p className="text-gray-500 dark:text-zinc-400">Nenhum módulo ativo está visível na tela inicial.</p>
                            <button
                                onClick={() => openTab('settings')}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                            >
                                Escolher módulos
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {configsLoaded && visibleModules.map(module => (
                            <div
                                key={module.id}
                                onClick={() => {
                                    if (module.status !== 'Ativo') return;
                                    openTab(module.id, module.title);
                                    if (module.homePath) navigate(module.homePath);
                                }}
                                className={`group relative overflow-hidden rounded-3xl bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-white/5 p-8 ${module.status === 'Ativo' ? 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10' : 'opacity-70 cursor-not-allowed'} transition-all`}
                            >
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 blur-3xl transition-opacity`} />

                                <div className="flex items-start justify-between mb-6">
                                    <div style={module.configName ? moduleIconBackground(modulesConfig[module.configName]) : undefined} className={`p-4 rounded-2xl bg-gradient-to-br ${module.color} text-white shadow-lg shadow-blue-500/20`}>
                                        {module.iconNode}
                                    </div>
                                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${module.status === 'Ativo' ? 'bg-green-500/10 text-green-500' :
                                        module.status === 'Beta' ? 'bg-amber-500/10 text-amber-500' : module.status === 'Inativo' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                                        }`}>
                                        {module.status}
                                    </span>
                                </div>

                                <h3 className="text-2xl font-bold mb-2 group-hover:text-blue-500 transition-colors">{module.title}</h3>
                                <p className="text-gray-500 dark:text-zinc-400 leading-relaxed">
                                    {module.description}
                                </p>

                                <div className="mt-8 flex items-center gap-2 text-sm font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                                    Acessar Módulo
                                    <Box className="w-4 h-4 rotate-[-45deg]" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="p-10 text-center text-gray-400 dark:text-zinc-600 text-sm">
            </footer>
        </div>
    );
};

export default MainHomePage;
