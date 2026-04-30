import React from 'react';
import { IniciarLogin } from '../../../../wailsjs/go/octohubHandlers/OctohubHandler';

interface OctohubHomePageProps {
    isLoggedIn: boolean | null;
    githubUser: any;
    checkLogin: () => Promise<void>;
}

const OctohubHomePage: React.FC<OctohubHomePageProps> = ({ isLoggedIn, githubUser, checkLogin }) => {

    if (isLoggedIn === null) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 dark:text-zinc-400 font-medium">Autenticando no GitHub...</p>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-8 p-8 text-center max-w-lg mx-auto">
                <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                    <div className="relative p-8 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <img src="/gitoctocat.svg" alt="GitHub" className="w-20 h-20 brightness-0 dark:invert" />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold mb-3">Conecte sua conta</h1>
                    <p className="text-gray-500 dark:text-zinc-400">
                        O OctoHub precisa de acesso para gerenciar seus repositórios, chaves SSH e configurações do GitHub.
                    </p>
                </div>
                <button
                    onClick={() => IniciarLogin()}
                    className="w-full sm:w-auto px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    <img src="/gitoctocat.svg" alt="" className="w-5 h-5 brightness-0 invert" />
                    Conectar agora
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <section className="relative overflow-hidden p-8 md:p-12 rounded-[2.5rem] bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xl shadow-emerald-500/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -mr-20 -mt-20"></div>
                <div className="relative flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0">
                        <div className="relative p-1 bg-white/20 rounded-full backdrop-blur-sm">
                            {githubUser?.avatar_url ? (
                                <img
                                    src={githubUser.avatar_url}
                                    alt={githubUser?.login}
                                    className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-2 border-white/50"
                                />
                            ) : (
                                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/10 flex items-center justify-center text-4xl">
                                    👤
                                </div>
                            )}
                            <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-400 border-4 border-emerald-500 rounded-full"></div>
                        </div>
                    </div>
                    <div className="text-center md:text-left space-y-2">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                            Olá, {githubUser?.name || githubUser?.login || 'Desenvolvedor'}!
                        </h1>
                        <p className="text-emerald-50 text-lg opacity-90 max-w-xl">
                            Bem-vindo ao seu painel OctoHub. Gerencie suas chaves, certificados e repositórios com facilidade.
                        </p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-sm font-medium">
                            <span className="px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">@{githubUser?.login}</span>
                            <span className="px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">ID: {githubUser?.id}</span>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    { title: 'Chaves SSH', desc: 'Gerencie suas chaves de acesso ao servidor.', count: '3 ativas' },
                    { title: 'Repositórios', desc: 'Visualize e gerencie seus projetos git.', count: githubUser?.public_repos + ' públicos' },
                    { title: 'Certificados', desc: 'Controle seus certificados TLS/SSL.', count: '2 alertas' },
                ].map((card, i) => (
                    <div key={i} className="group bg-white dark:bg-zinc-900/40 border border-gray-200 dark:border-white/5 p-8 rounded-3xl hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all cursor-pointer">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold">{card.title}</h3>
                            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg uppercase tracking-wider">{card.count}</span>
                        </div>
                        <p className="text-gray-500 dark:text-zinc-400 mb-6 leading-relaxed">
                            {card.desc}
                        </p>
                        <div className="h-1 w-12 bg-emerald-500/30 group-hover:w-full transition-all duration-300 rounded-full"></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OctohubHomePage;
