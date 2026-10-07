import React, { useState } from 'react';
import { useListNavigation } from '../hooks/useListNavigation';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { Check, ChevronDown, CloudDownload, FolderGit2, FolderPlus, KeyRound, Search, TriangleAlert, X } from 'lucide-react';

const RepositorySelector: React.FC = () => {
    const [filter, setFilter] = useState('');
    const query = filter.trim().toLowerCase();
    const [isOpen, setIsOpen] = useState(false);
    const { repository, repositories, githubAccount, addRepository, openCloneModal, openCredentials, selectRepository, removeRepository } = useOctohubRepository();

    const filtered = repositories.filter(
        (item) => item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query)
    );
    const cloneIndex = filtered.length;
    const addIndex = filtered.length + 1;
    const credentialsIndex = filtered.length + 2;

    const close = () => {
        setIsOpen(false);
        setFilter('');
    };

    const choose = (index: number) => {
        if (index === cloneIndex) {
            close();
            openCloneModal();
            return;
        }
        if (index === credentialsIndex) {
            close();
            openCredentials();
            return;
        }
        if (index === addIndex) {
            close();
            addRepository();
            return;
        }
        const target = filtered[index];
        if (!target?.exists) return;
        close();
        if (!target.isCurrent) selectRepository(target.id);
    };

    const { activeIndex, setActiveIndex, onKeyDown, listRef } = useListNavigation(filtered.length + 3, choose, close);

    const actionClass = (index: number) =>
        `flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer ${activeIndex === index ? 'bg-emerald-500/10' : 'hover:bg-emerald-500/5'}`;

    return (
        <div className="relative">
            <button
                onClick={() => (isOpen ? close() : setIsOpen(true))}
                title={repository?.path}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg transition-all"
            >
                <FolderGit2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex flex-col items-start leading-none min-w-0">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Repositório</span>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[160px]">
                        {repository?.name ?? 'Selecionar...'}
                    </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-30" onClick={close} />
                    <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-zinc-100 dark:border-white/5 space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                {githubAccount ? `Repositórios de @${githubAccount.login}` : 'Repositórios sem conta do GitHub'}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Filtrar repositórios..."
                                    className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={filter}
                                    onKeyDown={onKeyDown}
                                    onChange={(event) => {
                                        setFilter(event.target.value);
                                        setActiveIndex(0);
                                    }}
                                />
                            </div>
                        </div>

                        <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
                            {filtered.length === 0 && (
                                <p className="px-3 py-4 text-center text-xs text-zinc-500 italic">
                                    {repositories.length === 0 ? 'Nenhum repositório adicionado ainda.' : 'Nenhum repositório corresponde ao filtro.'}
                                </p>
                            )}
                            {filtered.map((item, index) => (
                                <div
                                    key={item.id}
                                    data-active={index === activeIndex}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => choose(index)}
                                    title={item.path}
                                    className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${item.exists ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${index === activeIndex ? 'bg-zinc-100 dark:bg-white/5' : ''}`}
                                >
                                    {item.exists ? (
                                        <FolderGit2 className={`w-4 h-4 shrink-0 ${item.isCurrent ? 'text-emerald-500' : 'text-zinc-400'}`} />
                                    ) : (
                                        <TriangleAlert className="w-4 h-4 shrink-0 text-amber-500" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-semibold truncate ${item.isCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                            {item.name}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 truncate">
                                            {item.exists ? item.path : 'Pasta não encontrada'}
                                        </div>
                                    </div>
                                    {item.isCurrent && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                    <button
                                        title="Remover da lista"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            close();
                                            removeRepository(item);
                                        }}
                                        className="p-1 rounded-md text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-zinc-100 dark:border-white/5 py-1">
                            <div
                                data-active={activeIndex === cloneIndex}
                                onMouseEnter={() => setActiveIndex(cloneIndex)}
                                onClick={() => choose(cloneIndex)}
                                className={actionClass(cloneIndex)}
                            >
                                <CloudDownload className="w-4 h-4" />
                                Clonar repositório...
                            </div>
                            <div
                                data-active={activeIndex === addIndex}
                                onMouseEnter={() => setActiveIndex(addIndex)}
                                onClick={() => choose(addIndex)}
                                className={actionClass(addIndex)}
                            >
                                <FolderPlus className="w-4 h-4" />
                                Adicionar repositório local...
                            </div>
                            <div
                                data-active={activeIndex === credentialsIndex}
                                onMouseEnter={() => setActiveIndex(credentialsIndex)}
                                onClick={() => choose(credentialsIndex)}
                                className={actionClass(credentialsIndex)}
                            >
                                <KeyRound className="w-4 h-4" />
                                Credenciais Git (GitLab e outros)...
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default RepositorySelector;
