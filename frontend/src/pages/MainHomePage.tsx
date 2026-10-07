import React from 'react';
import { Box, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore, ModuleType } from '../features/appFrame/AppStore';

const MainHomePage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { openTab } = useAppStore();

    const modules: { id: ModuleType, title: string, description: string, icon: any, color: string, status: string }[] = [
        {
            id: 'docker',
            title: 'Docker Manager',
            description: 'Gerencie contêineres, imagens, redes e volumes Docker.',
            icon: <img src="/docker-manager.svg" alt="Docker Manager" className="w-14 h-14 brightness-0 invert" />,
            color: 'from-blue-500 to-blue-700',
            status: 'Ativo'
        },
        {
            id: 'ferretshell',
            title: 'FerretShell',
            description: 'Acesse e gerencie seus servidores remotos via terminal SSH.',
            icon: <img src="/term.svg" alt="Ferretshell" className="w-14 h-14 brightness-0 invert" />,
            color: 'from-purple-500 to-purple-700',
            status: 'Ativo'
        },
        {
            id: 'octohub',
            title: 'OctoHub',
            description: 'Configurações de acesso, chaves SSH e certificados TLS.',
            icon: <img src="/gitoctocat.svg" alt="git" className="w-14 h-14 brightness-0 invert" />,
            color: 'from-emerald-500 to-emerald-700',
            status: 'Ativo'
        },
        {
            id: 'vulpes',
            title: 'Vulpes',
            description: 'Visualize o uso de recursos e logs do sistema em tempo real.',
            icon: <img src="/fox.svg" alt="fox" className="w-14 h-14 brightness-0 invert" />,
            color: 'from-amber-500 to-amber-700',
            status: 'Inativo'
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-white flex flex-col">

            <header className="p-6 md:p-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">DeployOps Console</h1>
                    <p className="text-gray-500 dark:text-zinc-400 mt-1">Bem-vindo de volta, {user?.nome || 'Usuário'}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => { }}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {modules.map((module, index) => (
                            <div
                                key={`${module.id}-${index}`}
                                onClick={() => {
                                    if (module.status === 'Ativo') {
                                        openTab(module.id, module.title);
                                        if (module.id === 'ferretshell') navigate('/term/home');
                                        if (module.id === 'docker') navigate('/docker/home');
                                        if (module.id === 'octohub') navigate('/octohub/home');
                                    }
                                }}
                                className={`group relative overflow-hidden rounded-3xl bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-white/5 p-8 ${module.status === 'Ativo' ? 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10' : 'opacity-70 cursor-not-allowed'} transition-all`}
                            >
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 blur-3xl transition-opacity`} />

                                <div className="flex items-start justify-between mb-6">
                                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${module.color} text-white shadow-lg shadow-blue-500/20`}>
                                        {module.icon}
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
