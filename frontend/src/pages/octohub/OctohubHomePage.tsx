import React from 'react';
import { useNavigate } from 'react-router-dom';
import { octohubDtos } from '../../../wailsjs/go/models';
import { ArrowRight, CloudDownload, FolderGit2, FolderPlus, KeyRound, TriangleAlert, User, X } from 'lucide-react';
import { useOctohubRepository } from '../../features/octohub-module/contexts/OctohubRepositoryContext';

interface OctohubHomePageProps {
    githubUser: any;
    isLoggedIn: boolean | null;
    onConnect: () => void;
}

const OctohubHomePage: React.FC<OctohubHomePageProps> = ({ githubUser, isLoggedIn, onConnect }) => {
    const navigate = useNavigate();
    const { repositories, githubAccount, addRepository, openCloneModal, openCredentials, selectRepository, removeRepository } = useOctohubRepository();

    const openRepository = async (repository: octohubDtos.RepositoryDto) => {
        if (repository.isCurrent || (await selectRepository(repository.id))) navigate('/octohub/history');
    };

    const addAndOpen = async () => {
        if (await addRepository()) navigate('/octohub/history');
    };

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
                    onClick={onConnect}
                    className="w-full sm:w-auto px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    <img src="/gitoctocat.svg" alt="" className="w-5 h-5 brightness-0 invert" />
                    Conectar agora
                </button>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-10 p-6 md:p-8">
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
                                        <User />
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
                                {githubUser?.public_repos !== undefined && (
                                    <span className="px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">{githubUser.public_repos} repositórios públicos</span>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold">
                                {githubAccount ? `Repositórios de @${githubAccount.login}` : 'Repositórios locais'}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                                Cada conta do GitHub tem a sua lista. Escolha um repositório para ver as alterações, o histórico e fazer commits.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => openCredentials()}
                                title="Logins para GitLab e outros servidores Git"
                                className="px-4 py-2.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
                            >
                                <KeyRound className="w-4 h-4" />
                                Credenciais Git
                            </button>
                            <button
                                onClick={openCloneModal}
                                className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
                            >
                                <CloudDownload className="w-4 h-4" />
                                Clonar
                            </button>
                            <button
                                onClick={addAndOpen}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
                            >
                                <FolderPlus className="w-4 h-4" />
                                Adicionar
                            </button>
                        </div>
                    </div>

                    {repositories.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                                onClick={openCloneModal}
                                className="flex flex-col items-center justify-center gap-3 p-10 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/10 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
                            >
                                <CloudDownload className="w-10 h-10 text-emerald-500" />
                                <p className="font-semibold">Clonar do GitHub</p>
                                <p className="text-sm text-gray-500 dark:text-zinc-400">
                                    {githubAccount ? `Escolha um dos repositórios de @${githubAccount.login} ou informe uma URL.` : 'Informe a URL de um repositório remoto.'}
                                </p>
                            </div>
                            <div
                                onClick={addAndOpen}
                                className="flex flex-col items-center justify-center gap-3 p-10 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/10 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
                            >
                                <FolderGit2 className="w-10 h-10 text-emerald-500" />
                                <p className="font-semibold">Adicionar pasta existente</p>
                                <p className="text-sm text-gray-500 dark:text-zinc-400">Escolha a pasta de um repositório Git que já está no seu computador.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {repositories.map((repository) => (
                                <div
                                    key={repository.id}
                                    title={repository.path}
                                    onClick={() => repository.exists && openRepository(repository)}
                                    className={`group relative bg-white dark:bg-zinc-900/40 border p-5 rounded-2xl transition-all ${repository.exists ? 'cursor-pointer hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5' : 'opacity-60 cursor-not-allowed'} ${repository.isCurrent ? 'border-emerald-500/40' : 'border-gray-200 dark:border-white/5'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2.5 rounded-xl shrink-0 ${repository.exists ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {repository.exists ? <FolderGit2 className="w-5 h-5" /> : <TriangleAlert className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold truncate">{repository.name}</h3>
                                                {repository.isCurrent && (
                                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0">Atual</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate mt-1">
                                                {repository.exists ? repository.path : 'Pasta não encontrada'}
                                            </p>
                                        </div>
                                        <button
                                            title="Remover da lista"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeRepository(repository);
                                            }}
                                            className="p-1 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all shrink-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {repository.exists && (
                                        <div className="flex items-center gap-1 mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Abrir alterações
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default OctohubHomePage;
