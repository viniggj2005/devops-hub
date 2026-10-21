import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContextMenu from '../../features/shared/components/menus/ContextMenu';
import * as octohubDtos from '../../../bindings/docker-manager-go/src/octohub/dtos/models';
import { useOctohubRepository } from '../../features/octohub-module/contexts/OctohubRepositoryContext';
import { useRepositoryContextMenu } from '../../features/octohub-module/hooks/useRepositoryContextMenu';
import {
    X,
    User,
    Search,
    GitBranch,
    ArrowRight,
    FolderGit2,
    TriangleAlert,
    GitCommitHorizontal,
} from 'lucide-react';

interface OctohubHomePageProps {
    githubUser: any;
    onConnect: () => void;
    isLoggedIn: boolean | null;
}

const OctohubHomePage: React.FC<OctohubHomePageProps> = ({
    onConnect,
    githubUser,
    isLoggedIn,
}) => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const { menu, entries, openMenu, closeMenu } = useRepositoryContextMenu();
    const {
        repository,
        repositories,
        currentBranch,
        githubAccount,
        selectRepository,
        removeRepository,
    } = useOctohubRepository();

    const openRepository = async (targetRepository: octohubDtos.RepositoryDto) => {
        if (targetRepository.isCurrent || (await selectRepository(targetRepository.id))) {
            navigate('/octohub/history');
        }
    };

    const filteredRepositories = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) return repositories;
        return repositories.filter(
            (item) =>
                item.name.toLowerCase().includes(normalizedSearch) ||
                item.path.toLowerCase().includes(normalizedSearch)
        );
    }, [repositories, search]);

    if (isLoggedIn === null) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 dark:text-zinc-400 font-medium">
                        Autenticando no GitHub...
                    </p>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-8 p-8 text-center max-w-lg mx-auto">
                <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse" />
                    <div className="relative p-8 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <img
                            alt="GitHub"
                            src="/gitoctocat.svg"
                            className="w-20 h-20 brightness-0 dark:invert"
                        />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold mb-3">Conecte sua conta</h1>
                    <p className="text-gray-500 dark:text-zinc-400">
                        O OctoHub precisa de acesso para gerenciar seus repositórios, chaves SSH e
                        configurações do GitHub.
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
        <div
            onContextMenu={(event) => event.preventDefault()}
            className="h-full overflow-y-auto custom-scrollbar"
        >
            <div className="max-w-6xl mx-auto space-y-6 p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-white/5">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="relative shrink-0">
                            {githubUser?.avatar_url ? (
                                <img
                                    alt={githubUser?.login}
                                    src={githubUser.avatar_url}
                                    className="w-12 h-12 rounded-2xl object-cover border border-gray-200 dark:border-white/10"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <User className="w-6 h-6" />
                                </div>
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                                    {githubUser?.name || githubUser?.login || 'Desenvolvedor'}
                                </h1>
                                <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    @{githubUser?.login}
                                </span>
                                {githubUser?.public_repos !== undefined && (
                                    <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400">
                                        {githubUser.public_repos} públicos
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                                Selecione um repositório abaixo ou use o seletor da barra superior.
                            </p>
                        </div>
                    </div>

                    {repository?.exists && (
                        <button
                            onClick={() => navigate('/octohub/history')}
                            onContextMenu={(event) => openMenu(event, repository)}
                            className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-colors flex items-center gap-2.5 self-start sm:self-auto"
                        >
                            <GitCommitHorizontal className="w-4 h-4" />
                            <span>Abrir {repository.name}</span>
                            {currentBranch && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-[11px]">
                                    <GitBranch className="w-3 h-3" />
                                    {currentBranch}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                {githubAccount
                                    ? `Repositórios de @${githubAccount.login}`
                                    : 'Repositórios locais'}
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400">
                                {repositories.length}
                            </span>
                        </div>

                        {repositories.length > 0 && (
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Filtrar repositórios..."
                                    className="w-full h-9 pl-9 pr-8 rounded-xl text-xs outline-none border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 focus:border-emerald-500"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {repositories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center bg-white/50 dark:bg-zinc-900/20">
                            <FolderGit2 className="w-10 h-10 text-emerald-500/70" />
                            <p className="font-semibold text-sm">
                                Nenhum repositório vinculado a esta conta ainda
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md">
                                Clique no seletor <b>Repositório</b> na barra superior para clonar
                                do GitHub, criar um novo repositório ou adicionar uma pasta local.
                            </p>
                        </div>
                    ) : filteredRepositories.length === 0 ? (
                        <p className="py-10 text-center text-xs text-zinc-400">
                            Nenhum repositório corresponde ao filtro.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredRepositories.map((repositoryItem) => (
                                <div
                                    key={repositoryItem.id}
                                    title={repositoryItem.path}
                                    onContextMenu={(event) => openMenu(event, repositoryItem)}
                                    onClick={() =>
                                        repositoryItem.exists && openRepository(repositoryItem)
                                    }
                                    className={`group relative bg-white dark:bg-zinc-900/40 border p-5 rounded-2xl transition-all ${
                                        repositoryItem.exists
                                            ? 'cursor-pointer hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5'
                                            : 'opacity-60 cursor-not-allowed'
                                    } ${
                                        repositoryItem.isCurrent
                                            ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                                            : 'border-gray-200 dark:border-white/5'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`p-2.5 rounded-xl shrink-0 ${
                                                repositoryItem.exists
                                                    ? 'bg-emerald-500/10 text-emerald-500'
                                                    : 'bg-amber-500/10 text-amber-500'
                                            }`}
                                        >
                                            {repositoryItem.exists ? (
                                                <FolderGit2 className="w-5 h-5" />
                                            ) : (
                                                <TriangleAlert className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold truncate">
                                                    {repositoryItem.name}
                                                </h3>
                                                {repositoryItem.isCurrent && (
                                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0">
                                                        Atual
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate mt-1">
                                                {repositoryItem.exists
                                                    ? repositoryItem.path
                                                    : 'Pasta não encontrada'}
                                            </p>
                                        </div>
                                        <button
                                            title="Remover da lista"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeRepository(repositoryItem);
                                            }}
                                            className="p-1 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all shrink-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {repositoryItem.exists && (
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

            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    entries={entries}
                    onClose={closeMenu}
                    title={menu.repository.name}
                />
            )}
        </div>
    );
};

export default OctohubHomePage;
