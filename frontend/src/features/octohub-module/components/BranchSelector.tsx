import toast from 'react-hot-toast';
import MergeBranchModal from './MergeBranchModal';
import CreateBranchModal from './CreateBranchModal';
import StashChangesModal from './StashChangesModal';
import { useDismiss } from '../../shared/hooks/useDismiss';
import { useListNavigation } from '../hooks/useListNavigation';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { getConflictingFiles, isConflictError } from '../functions/gitStatus';
import * as octohubStructs from '../../../../bindings/docker-manager-go/src/octohub/structs/models';
import { GetGitStatus } from '../../../../bindings/docker-manager-go/src/octohub/handlers/gitcommitshandler';
import {
    Check,
    Cloud,
    Search,
    GitMerge,
    RefreshCw,
    GitBranch,
    ChevronDown,
    CloudUpload,
    GitBranchPlus,
} from 'lucide-react';
import {
    ListBranches,
    ChangeBranch,
    FetchRemotes,
    GetOriginURL,
    PublishBranch,
    HasUncommittedChanges,
} from '../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';

type BranchItem = { type: 'create' } | { type: 'branch'; branch: octohubStructs.BranchInfo };

const localName = (branch: octohubStructs.BranchInfo) =>
    branch.IsRemote ? branch.Name.slice(branch.Name.indexOf('/') + 1) : branch.Name;

const BranchSelector: React.FC = () => {
    const [filter, setFilter] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const [originUrl, setOriginUrl] = useState('');
    const [fetching, setFetching] = useState(false);
    const [createName, setCreateName] = useState('');
    const [mergeOpen, setMergeOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [showStashModal, setShowStashModal] = useState(false);
    const [branches, setBranches] = useState<octohubStructs.BranchInfo[]>([]);
    const [pendingBranch, setPendingBranch] = useState<octohubStructs.BranchInfo | null>(null);
    const {
        revision,
        repository,
        notifyChange,
        currentBranch,
        openConflicts,
        handleGitError,
        openPublishModal,
    } = useOctohubRepository();

    const isDetached = currentBranch === 'HEAD';
    const hasRepository = Boolean(repository?.exists);
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
    const canCreate =
        newBranchName !== '' &&
        !branches.some((branch) => !branch.IsRemote && branch.Name === newBranchName);
    const items: BranchItem[] = [
        ...(canCreate ? [{ type: 'create' } as BranchItem] : []),
        ...matches
            .filter((branch) => !branch.IsRemote)
            .map((branch) => ({ type: 'branch', branch }) as BranchItem),
        ...matches
            .filter((branch) => branch.IsRemote)
            .map((branch) => ({ type: 'branch', branch }) as BranchItem),
    ];

    const close = () => {
        setIsOpen(false);
        setFilter('');
    };

    useDismiss([triggerRef, panelRef], isOpen, close);

    const showConflictsOrError = async (error: unknown, prefix: string) => {
        if (isConflictError(error)) {
            const conflicts = getConflictingFiles(await GetGitStatus().catch(() => []));
            if (conflicts.length > 0) {
                openConflicts();
                return;
            }
        }
        toast.error(`${prefix}: ${errorMessage(error)}`);
    };

    const switchBranch = async (branch: octohubStructs.BranchInfo, leaveChanges: boolean) => {
        setLoading(true);
        try {
            await ChangeBranch(branch.Name, branch.IsRemote, leaveChanges);
            toast.success(`Agora em ${localName(branch)}.`);
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
            toast.error(errorMessage(error));
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

    const openCreateModal = (initialName = '') => {
        close();
        setCreateName(initialName);
        setCreateOpen(true);
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
            toast.success(`${currentBranch} enviada para o remoto.`);
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
            toast.success('Remotos atualizados.');
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
        if (item.type === 'create') openCreateModal(newBranchName);
        else handleSwitch(item.branch);
    };

    const { activeIndex, setActiveIndex, onKeyDown, listRef } = useListNavigation(
        items.length,
        choose,
        close
    );

    const showPublish =
        hasRepository && !isDetached && current && (!current.Upstream || current.Ahead > 0);

    return (
        <div className="relative">
            <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/5 p-0.5">
                <button
                    ref={triggerRef}
                    disabled={!hasRepository || loading}
                    onClick={() => (isOpen ? close() : setIsOpen(true))}
                    className="flex items-center gap-2 px-2.5 py-1 hover:bg-zinc-200/70 dark:hover:bg-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <GitBranch className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex flex-col items-start leading-none min-w-0">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">
                            Branch
                        </span>
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[140px]">
                            {!hasRepository
                                ? 'Sem repositório'
                                : isDetached
                                  ? 'HEAD destacado'
                                  : currentBranch || 'Carregando...'}
                        </span>
                    </div>
                    {loading ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                        <ChevronDown
                            className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${
                                isOpen ? 'rotate-180' : ''
                            }`}
                        />
                    )}
                </button>

                <div className="h-5 w-px bg-zinc-200 dark:bg-white/10 mx-0.5" />

                <button
                    onClick={handleFetch}
                    disabled={!hasRepository || !originUrl || loading || fetching}
                    title={
                        originUrl
                            ? 'Buscar atualizações de todos os remotos (git fetch --all --prune)'
                            : 'Repositório sem remoto'
                    }
                    className="px-2.5 py-1.5 hover:bg-zinc-200/70 dark:hover:bg-white/10 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <RefreshCw
                        className={`w-3.5 h-3.5 text-emerald-500 ${fetching ? 'animate-spin' : ''}`}
                    />
                    <span className="text-xs font-bold hidden xl:inline text-zinc-700 dark:text-zinc-300">
                        Fetch
                    </span>
                    {current && current.Behind > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold">
                            ↓{current.Behind}
                        </span>
                    )}
                </button>

                {showPublish && (
                    <button
                        onClick={handlePublish}
                        disabled={loading}
                        title={
                            !originUrl
                                ? 'Criar o repositório no GitHub e enviar'
                                : current?.Upstream
                                  ? `Enviar commits para ${current.Upstream}`
                                  : 'Publicar a branch em origin'
                        }
                        className="ml-0.5 px-2.5 py-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <CloudUpload className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">
                            {!originUrl
                                ? 'Publicar'
                                : current?.Upstream
                                  ? `Enviar ↑${current.Ahead}`
                                  : 'Publicar'}
                        </span>
                    </button>
                )}
            </div>

            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    <div className="p-3 border-b border-zinc-100 dark:border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                                type="text"
                                autoFocus
                                value={filter}
                                onKeyDown={onKeyDown}
                                placeholder="Filtrar ou criar branch..."
                                onChange={(event) => {
                                    setFilter(event.target.value);
                                    setActiveIndex(0);
                                }}
                                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
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
                                (previous?.type !== 'branch' ||
                                    previous.branch.IsRemote !== item.branch.IsRemote)
                                    ? item.branch.IsRemote
                                        ? 'Remotas'
                                        : 'Locais'
                                    : null;

                            if (item.type === 'create') {
                                return (
                                    <div
                                        key="create"
                                        data-active={isActive}
                                        onClick={() => choose(index)}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        className={`flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-emerald-600 dark:text-emerald-400 ${
                                            isActive ? 'bg-emerald-500/10' : ''
                                        }`}
                                    >
                                        <GitBranchPlus className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold truncate">
                                                Criar branch “{newBranchName}”
                                            </div>
                                            <div className="text-[10px] text-zinc-500">
                                                Escolher a branch de origem...
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
                                        onClick={() => choose(index)}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                            branch.IsCurrent
                                                ? 'text-emerald-500'
                                                : 'text-zinc-600 dark:text-zinc-400'
                                        } ${isActive ? 'bg-zinc-100 dark:bg-white/5' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {branch.IsRemote ? (
                                                <Cloud className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                                            ) : (
                                                <GitBranch
                                                    className={`w-3.5 h-3.5 shrink-0 ${
                                                        branch.IsCurrent
                                                            ? 'text-emerald-500'
                                                            : 'text-zinc-400'
                                                    }`}
                                                />
                                            )}
                                            <span
                                                title={branch.Name}
                                                className="text-xs font-medium truncate"
                                            >
                                                {branch.Name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-zinc-400">
                                            {branch.Ahead > 0 && (
                                                <span title={`${branch.Ahead} commit(s) para enviar`}>
                                                    ↑{branch.Ahead}
                                                </span>
                                            )}
                                            {branch.Behind > 0 && (
                                                <span title={`${branch.Behind} commit(s) no remoto`}>
                                                    ↓{branch.Behind}
                                                </span>
                                            )}
                                            {branch.IsCurrent && (
                                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    <div className="border-t border-zinc-100 dark:border-white/5 py-1">
                        <button
                            onClick={() => openCreateModal()}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                        >
                            <GitBranchPlus className="w-4 h-4" />
                            Nova branch...
                        </button>
                        <button
                            onClick={() => {
                                close();
                                setMergeOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                        >
                            <GitMerge className="w-4 h-4" />
                            <span className="truncate">
                                Mesclar outra branch em {isDetached ? 'HEAD' : currentBranch}...
                            </span>
                        </button>
                    </div>

                    <div className="px-3 py-2 border-t border-zinc-100 dark:border-white/5 text-[10px] text-zinc-400">
                        ↑↓ para navegar · Enter para trocar · Esc para fechar
                    </div>
                </div>
            )}

            <MergeBranchModal open={mergeOpen} onClose={() => setMergeOpen(false)} />

            <CreateBranchModal
                open={createOpen}
                initialName={createName}
                onClose={() => setCreateOpen(false)}
            />

            <StashChangesModal
                loading={loading}
                isOpen={showStashModal}
                onConfirm={confirmSwitch}
                currentBranch={currentBranch || ''}
                onClose={() => setShowStashModal(false)}
                targetBranch={pendingBranch ? localName(pendingBranch) : null}
            />
        </div>
    );
};

export default BranchSelector;
