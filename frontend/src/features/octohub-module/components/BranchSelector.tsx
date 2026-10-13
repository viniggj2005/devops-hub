import iziToast from 'izitoast';
import MergeBranchModal from './MergeBranchModal';
import StashChangesModal from './StashChangesModal';
import { octohubStructs } from '../../../../wailsjs/go/models';
import { useListNavigation } from '../hooks/useListNavigation';
import React, { useCallback, useEffect, useState } from 'react';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { getConflictingFiles, isConflictError } from '../functions/gitStatus';
import { GetGitStatus } from '../../../../wailsjs/go/octohubHandler/GitCommitsHandler';
import { Check, ChevronDown, Cloud, CloudUpload, GitBranch, GitBranchPlus, GitMerge, RefreshCw, Search } from 'lucide-react';
import { ListBranches, ChangeBranch, CreateAndCheckoutBranch, PublishBranch, FetchRemotes, GetOriginURL, HasUncommittedChanges } from '../../../../wailsjs/go/octohubHandler/GitBranchHandler';

type BranchItem = { type: 'create' } | { type: 'branch'; branch: octohubStructs.BranchInfo };

const localName = (branch: octohubStructs.BranchInfo) =>
    branch.IsRemote ? branch.Name.slice(branch.Name.indexOf('/') + 1) : branch.Name;

const BranchSelector: React.FC = () => {
    const { repository, currentBranch, revision, notifyChange, openConflicts, handleGitError, openPublishModal } = useOctohubRepository();
    const [filter, setFilter] = useState('');
    const [originUrl, setOriginUrl] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [showStashModal, setShowStashModal] = useState(false);
    const [branches, setBranches] = useState<octohubStructs.BranchInfo[]>([]);
    const [pendingBranch, setPendingBranch] = useState<octohubStructs.BranchInfo | null>(null);

    const hasRepository = Boolean(repository?.exists);
    const isDetached = currentBranch === 'HEAD';
    const current = branches.find((branch) => branch.IsCurrent);

    const loadBranches = useCallback(async () => {
        if (!hasRepository) {
            setBranches([]);
            setOriginUrl('');
            return;
        }
        try {
            setBranches(await ListBranches());
            setOriginUrl(await GetOriginURL());
        } catch {
            setBranches([]);
        }
    }, [hasRepository, repository?.id]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches, revision]);

    const query = filter.trim().toLowerCase();
    const newBranchName = filter.trim().replace(/\s+/g, '-');
    const matches = branches.filter((branch) => branch.Name.toLowerCase().includes(query));
    const canCreate = newBranchName !== '' && !branches.some((branch) => !branch.IsRemote && branch.Name === newBranchName);
    const items: BranchItem[] = [
        ...(canCreate ? [{ type: 'create' } as BranchItem] : []),
        ...matches.filter((branch) => !branch.IsRemote).map((branch) => ({ type: 'branch', branch }) as BranchItem),
        ...matches.filter((branch) => branch.IsRemote).map((branch) => ({ type: 'branch', branch }) as BranchItem),
    ];

    const close = () => {
        setIsOpen(false);
        setFilter('');
    };

    const showConflictsOrError = async (error: unknown, prefix: string) => {
        if (isConflictError(error)) {
            const conflicts = getConflictingFiles(await GetGitStatus().catch(() => []));
            if (conflicts.length > 0) {
                openConflicts();
                return;
            }
        }
        iziToast.error({ title: 'Erro', message: `${prefix}: ${error}`, position: 'bottomRight' });
    };

    const switchBranch = async (branch: octohubStructs.BranchInfo, leaveChanges: boolean) => {
        setLoading(true);
        try {
            await ChangeBranch(branch.Name, branch.IsRemote, leaveChanges);
            iziToast.success({ title: 'Branch', message: `Agora em ${localName(branch)}.`, position: 'bottomRight' });
        } catch (error) {
            await showConflictsOrError(error, 'Erro ao trocar de branch');
        } finally {
            setLoading(false);
            notifyChange();
        }
    };

    const handleSwitch = async (branch: octohubStructs.BranchInfo) => {
        close();
        if (branch.IsCurrent) return;
        try {
            if (await HasUncommittedChanges()) {
                setPendingBranch(branch);
                setShowStashModal(true);
                return;
            }
        } catch (error) {
            iziToast.error({ title: 'Erro', message: String(error), position: 'bottomRight' });
            return;
        }
        await switchBranch(branch, false);
    };

    const confirmSwitch = async (action: 'bring' | 'leave') => {
        if (!pendingBranch) return;
        await switchBranch(pendingBranch, action === 'leave');
        setShowStashModal(false);
        setPendingBranch(null);
    };

    const handleCreate = async () => {
        close();
        setLoading(true);
        try {
            await CreateAndCheckoutBranch(newBranchName);
            iziToast.success({ title: 'Branch', message: `Branch ${newBranchName} criada.`, position: 'bottomRight' });
            notifyChange();
        } catch (error) {
            iziToast.error({ title: 'Erro', message: `Erro ao criar branch: ${error}`, position: 'bottomRight' });
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!currentBranch) return;
        if (!originUrl) {
            openPublishModal();
            return;
        }
        setLoading(true);
        try {
            await PublishBranch(currentBranch);
            iziToast.success({ title: 'Branch', message: `${currentBranch} enviada para o remoto.`, position: 'bottomRight' });
            notifyChange();
        } catch (error) {
            handleGitError(error, 'Erro ao enviar branch', handlePublish);
        } finally {
            setLoading(false);
        }
    };

    const handleFetch = async () => {
        setFetching(true);
        try {
            await FetchRemotes();
            iziToast.success({ title: 'Fetch', message: 'Remotos atualizados.', position: 'bottomRight' });
            notifyChange();
        } catch (error) {
            handleGitError(error, 'Erro ao buscar do remoto', handleFetch);
        } finally {
            setFetching(false);
        }
    };

    const choose = (index: number) => {
        const item = items[index];
        if (!item) return;
        if (item.type === 'create') handleCreate();
        else handleSwitch(item.branch);
    };

    const { activeIndex, setActiveIndex, onKeyDown, listRef } = useListNavigation(items.length, choose, close);

    const showPublish = hasRepository && !isDetached && current && (!current.Upstream || current.Ahead > 0);

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => (isOpen ? close() : setIsOpen(true))}
                    disabled={!hasRepository || loading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <GitBranch className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex flex-col items-start leading-none min-w-0">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Branch atual</span>
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[160px]">
                            {!hasRepository ? 'Sem repositório' : isDetached ? 'HEAD destacado' : currentBranch || 'Carregando...'}
                        </span>
                    </div>
                    {loading ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                </button>

                <button
                    onClick={() => setMergeOpen(true)}
                    disabled={!hasRepository || loading}
                    title="Trazer outra branch para a atual (merge, squash ou rebase)"
                    className="p-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <GitMerge className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold hidden md:inline text-zinc-700 dark:text-zinc-300">Mesclar</span>
                </button>

                <button
                    onClick={handleFetch}
                    disabled={!hasRepository || !originUrl || loading || fetching}
                    title={originUrl ? 'Buscar atualizações de todos os remotos (git fetch --all --prune)' : 'Repositório sem remoto'}
                    className="p-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`w-4 h-4 text-emerald-500 ${fetching ? 'animate-spin' : ''}`} />
                    <span className="text-xs font-bold hidden md:inline text-zinc-700 dark:text-zinc-300">
                        {current && current.Behind > 0 ? `Fetch ↓${current.Behind}` : 'Fetch'}
                    </span>
                </button>

                {showPublish && (
                    <button
                        onClick={handlePublish}
                        disabled={loading}
                        className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                        title={!originUrl ? 'Criar o repositório no GitHub e enviar' : current?.Upstream ? `Enviar commits para ${current.Upstream}` : 'Publicar a branch em origin'}
                    >
                        <CloudUpload className="w-4 h-4" />
                        <span className="text-xs font-bold hidden md:inline">
                            {!originUrl ? 'Publicar repositório' : current?.Upstream ? `Enviar ↑${current.Ahead}` : 'Publicar'}
                        </span>
                    </button>
                )}
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-30" onClick={close} />
                    <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-zinc-100 dark:border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Filtrar ou criar branch..."
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

                        <div ref={listRef} className="max-h-80 overflow-y-auto p-1">
                            {items.length === 0 && (
                                <p className="px-3 py-4 text-center text-xs text-zinc-500 italic">
                                    Digite um nome para criar uma branch.
                                </p>
                            )}
                            {items.map((item, index) => {
                                const isActive = index === activeIndex;
                                const previous = items[index - 1];
                                const groupTitle =
                                    item.type === 'branch' &&
                                    (previous?.type !== 'branch' || previous.branch.IsRemote !== item.branch.IsRemote)
                                        ? item.branch.IsRemote ? 'Remotas' : 'Locais'
                                        : null;

                                if (item.type === 'create') {
                                    return (
                                        <div
                                            key="create"
                                            data-active={isActive}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onClick={() => choose(index)}
                                            className={`flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-emerald-600 dark:text-emerald-400 ${isActive ? 'bg-emerald-500/10' : ''}`}
                                        >
                                            <GitBranchPlus className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold truncate">Criar branch “{newBranchName}”</div>
                                                <div className="text-[10px] text-zinc-500">
                                                    A partir de {isDetached ? 'HEAD' : currentBranch}, levando suas alterações
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                const { branch } = item;
                                return (
                                    <React.Fragment key={`${branch.IsRemote}-${branch.Name}`}>
                                        {groupTitle && (
                                            <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                                                {groupTitle}
                                            </div>
                                        )}
                                        <div
                                            data-active={isActive}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onClick={() => choose(index)}
                                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${branch.IsCurrent ? 'text-emerald-500' : 'text-zinc-600 dark:text-zinc-400'} ${isActive ? 'bg-zinc-100 dark:bg-white/5' : ''}`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {branch.IsRemote ? (
                                                    <Cloud className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                                                ) : (
                                                    <GitBranch className={`w-3.5 h-3.5 shrink-0 ${branch.IsCurrent ? 'text-emerald-500' : 'text-zinc-400'}`} />
                                                )}
                                                <span className="text-xs font-medium truncate" title={branch.Name}>{branch.Name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-zinc-400">
                                                {branch.Ahead > 0 && <span title={`${branch.Ahead} commit(s) para enviar`}>↑{branch.Ahead}</span>}
                                                {branch.Behind > 0 && <span title={`${branch.Behind} commit(s) no remoto`}>↓{branch.Behind}</span>}
                                                {branch.IsCurrent && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => {
                                close();
                                setMergeOpen(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 border-t border-zinc-100 dark:border-white/5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5"
                        >
                            <GitMerge className="w-3.5 h-3.5" />
                            Mesclar outra branch em {isDetached ? 'HEAD' : currentBranch}...
                        </button>
                        <div className="px-3 py-2 border-t border-zinc-100 dark:border-white/5 text-[10px] text-zinc-400">
                            ↑↓ para navegar · Enter para trocar · Esc para fechar
                        </div>
                    </div>
                </>
            )}

            <MergeBranchModal open={mergeOpen} onClose={() => setMergeOpen(false)} />

            <StashChangesModal
                isOpen={showStashModal}
                onClose={() => setShowStashModal(false)}
                currentBranch={currentBranch || ''}
                targetBranch={pendingBranch ? localName(pendingBranch) : null}
                onConfirm={confirmSwitch}
                loading={loading}
            />
        </div>
    );
};

export default BranchSelector;
