import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Plus, History, Server, Shield, Zap, ArrowRight } from 'lucide-react';
import SshConnectionList from '../features/ferretShell-module/terminal/components/list/SshConnectionList';
import { useAuth } from '../contexts/AuthContext';

const FerretShellHomePage: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useAuth();

    const quickActions = [
        {
            title: 'Nova Conexão',
            description: 'Configure uma nova sessão SSH para um servidor remoto.',
            icon: <Plus className="w-6 h-6" />,
            color: 'from-purple-500 to-indigo-600',
            path: '/term/createConnectionForm'
        },
        {
            title: 'Sessões Recentes',
            description: 'Acesse rapidamente os servidores conectados recentemente.',
            icon: <History className="w-6 h-6" />,
            color: 'from-blue-500 to-cyan-600',
            path: '#'
        },
        {
            title: 'Chaves SSH',
            description: 'Gerencie suas chaves públicas e privadas com segurança.',
            icon: <Shield className="w-6 h-6" />,
            color: 'from-emerald-500 to-teal-600',
            path: '#'
        }
    ];

    return (
        <div className="space-y-12 pb-20">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/10 via-indigo-600/5 to-transparent border border-purple-500/10 p-8 md:p-12">
                <div className="relative z-10 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-6">
                        <Zap className="w-3 h-3" />
                        Terminal de Alta Performance
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">
                        Potencialize sua gestão de <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">servidores remotos</span>
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-zinc-400 mb-8 leading-relaxed">
                        FerretShell oferece uma experiência de terminal fluida, segura e organizada.
                        Gerencie múltiplas conexões SSH em uma única interface moderna.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => navigate('/term/createConnectionForm')}
                            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/25 hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Nova Conexão
                        </button>
                    </div>
                </div>
                <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-10 dark:opacity-20 hidden lg:block">
                    <Terminal className="w-96 h-96 text-purple-600" />
                </div>
            </section>
            <section className="bg-white dark:bg-zinc-900/30 border border-gray-200 dark:border-white/5 rounded-3xl p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Meus Servidores</h2>
                        <p className="text-gray-500 dark:text-zinc-400">Selecione um servidor para iniciar uma sessão em aba.</p>
                    </div>
                </div>

                <SshConnectionList token={token || ''} />
            </section>
        </div>
    );
};

export default FerretShellHomePage;
