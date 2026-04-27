import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Plus, History, Server, Shield, Zap, ArrowRight } from 'lucide-react';

const FerretShellHomePage: React.FC = () => {
    const navigate = useNavigate();

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
                        <button className="px-8 py-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                            Saiba mais
                        </button>
                    </div>
                </div>
                <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-10 dark:opacity-20 hidden lg:block">
                    <Terminal className="w-96 h-96 text-purple-600" />
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Rápido</h2>
                        <p className="text-gray-500 dark:text-zinc-400">Tudo o que você precisa para começar.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {quickActions.map((action, index) => (
                        <div
                            key={index}
                            onClick={() => action.path !== '#' && navigate(action.path)}
                            className="group p-8 rounded-3xl bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-white/5 hover:border-purple-500/50 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 blur-2xl transition-opacity`} />

                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-lg mb-6 group-hover:scale-110 transition-transform`}>
                                {action.icon}
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-purple-500 transition-colors">
                                {action.title}
                            </h3>
                            <p className="text-gray-500 dark:text-zinc-400 text-sm leading-relaxed mb-6">
                                {action.description}
                            </p>

                            <div className="flex items-center gap-2 text-sm font-bold text-purple-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                Explorar <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            <section className="bg-white dark:bg-zinc-900/30 border border-gray-200 dark:border-white/5 rounded-3xl p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Servidores Ativos</h2>
                        <p className="text-gray-500 dark:text-zinc-400">Nenhuma sessão ativa no momento.</p>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Terminal className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-zinc-500 max-w-sm">
                        Suas conexões SSH ativas aparecerão aqui para fácil monitoramento e acesso rápido.
                    </p>
                    <button
                        onClick={() => navigate('/term/createConnectionForm')}
                        className="mt-6 text-purple-600 font-bold hover:underline"
                    >
                        Conectar ao primeiro servidor
                    </button>
                </div>
            </section>
        </div>
    );
};

export default FerretShellHomePage;
