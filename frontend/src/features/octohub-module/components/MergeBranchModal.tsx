import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../shared/components/modals/Modal';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import * as octohubStructs from '../../../../bindings/docker-manager-go/src/octohub/structs/models';
import { CircleAlert, CircleCheck, Cloud, GitBranch, GitMerge, RefreshCw, Search } from 'lucide-react';
import { FetchRemotes, GetDefaultBranch, GetMergePreview, HasUncommittedChanges, ListMergeableBranches, MergeBranch } from '../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';

type MergeStrategy = 'merge' | 'no-ff' | 'squash' | 'rebase';

interface MergeBranchModalProps {
    open: boolean;
    onClose: () => void;
    initialBranch?: string | null;
}

const strategies: { value: MergeStrategy; label: string; description: string }[] = [
    { value: 'rebase', label: 'Rebase', description: 'Reaplica os commits da branch atual em cima da branch escolhida, deixando o histórico linear.' },
    { value: 'no-ff', label: 'Merge commit', description: 'Sempre cria um commit de merge, deixando claro no histórico de onde vieram as alterações.' },
    { value: 'squash', label: 'Squash e merge', description: 'Junta todas as alterações da branch escolhida em um único commit novo na branch atual.' },
    { value: 'merge', label: 'Merge', description: 'Traz os commits da branch escolhida. Avança direto (fast-forward) quando dá; senão cria um commit de merge.' },
];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const MergeBranchModal: React.FC<MergeBranchModalProps> = ({ open, onClose, initialBranch }) => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('');
    const [summary, setSummary] = useState('');
    const [dirty, setDirty] = useState(false);
    const [merging, setMerging] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [description, setDescription] = useState('');
    const [stashChanges, setStashChanges] = useState(true);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [strategy, setStrategy] = useState<MergeStrategy>('merge');
    const [branches, setBranches] = useState<octohubStructs.BranchInfo[]>([]);
    const [preview, setPreview] = useState<octohubStructs.MergePreview | null>(null);
    const { currentBranch, notifyChange, openConflicts, handleGitError } = useOctohubRepository();

    const current = currentBranch === 'HEAD' ? 'HEAD' : currentBranch || '';

    const loadBranches = async (preferred: string | null) => {
        const list = (await ListMergeableBranches()) || [];
        setBranches(list);
        setSelected((previous) => {
            if (previous && list.some((branch) => branch.Name === previous)) return previous;
            if (preferred && list.some((branch) => branch.Name === preferred)) return preferred;
            return list[0]?.Name ?? null;
        });
    };

    useEffect(() => {
        if (!open) return;
        setFilter('');
        setPreview(null);
        setSelected(null);
        setStrategy('merge');
        setStashChanges(true);
        HasUncommittedChanges().then(setDirty).catch(() => setDirty(false));
        GetDefaultBranch()
            .then((defaultBranch) => loadBranches(initialBranch || (defaultBranch && defaultBranch !== currentBranch ? defaultBranch : null)))
            .catch((error) => toast.error(errorMessage(error)));
    }, [open]);

    useEffect(() => {
        if (!open || !selected) {
            setPreview(null);
            return;
        }
        let cancelled = false;
        setLoadingPreview(true);
        GetMergePreview(selected)
            .then((result) => !cancelled && setPreview(result))
            .catch(() => !cancelled && setPreview(null))
            .finally(() => !cancelled && setLoadingPreview(false));
        return () => {
            cancelled = true;
        };
    }, [open, selected, previewKey]);

    useEffect(() => {
        if (!selected) return;
        if (strategy === 'squash') {
            setSummary(`Squash de ${selected}`);
            setDescription((preview?.Commits || []).map((commit) => `* ${commit.Title}`).join('\n'));
        } else if (strategy === 'no-ff') {
            setSummary(`Merge branch '${selected}'`);
            setDescription('');
        }
    }, [strategy, selected, preview]);

    const query = filter.trim().toLowerCase();
    const filtered = useMemo(
        () => branches.filter((branch) => branch.Name.toLowerCase().includes(query)),
        [branches, query]
    );

    const handleFetch = async () => {
        setFetching(true);
        try {
            await FetchRemotes();
            await loadBranches(selected);
            setPreviewKey((key) => key + 1);
            notifyChange();
            toast.success('Branches remotas atualizadas.');
        } catch (error) {
            handleGitError(error, 'Erro ao buscar do remoto', handleFetch);
        } finally {
            setFetching(false);
        }
    };

    const successMessage = () => {
        const source = selected || '';
        const target = current;
        switch (strategy) {
            case 'merge': return preview?.CanFastForward ? `${target} avançou até ${source}.` : `${source} mesclada em ${target}.`;
            case 'no-ff': return `${source} mesclada em ${target} com commit de merge.`;
            case 'squash': return `As alterações de ${source} viraram um commit em ${target}.`;
            default: return `${target} agora está em cima de ${source}.`;
        }
    };

    const handleMerge = async () => {
        if (!selected || merging) return;
        setMerging(true);
        try {
            const message = strategy === 'squash' || strategy === 'no-ff'
                ? [summary.trim(), description.trim()].filter(Boolean).join('\n\n')
                : '';
            const state = await MergeBranch(selected, strategy, message, dirty && stashChanges);
            notifyChange();
            onClose();
            navigate('/octohub/history');
            if (state.Kind) {
                openConflicts();
            } else {
                toast.success(successMessage());
            }
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setMerging(false);
        }
    };

    const actionLabel = {
        merge: `Mesclar ${selected ?? ''} em ${current}`,
        'no-ff': 'Criar commit de merge',
        squash: 'Squash e merge',
        rebase: `Rebase em ${selected ?? ''}`,
    }[strategy];

    const needsMessage = strategy === 'squash' || strategy === 'no-ff';
    const strategyInfo = strategies.find((item) => item.value === strategy)!;
    const canMerge = Boolean(selected) && !loadingPreview && Boolean(preview) && !preview!.UpToDate && !merging && !fetching;
    const inputClass = 'w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500';

    return (
        <Modal
            size="lg"
            isOpen={open}
            title="Mesclar na branch atual"
            description={current}
            onClose={() => !merging && onClose()}
            icon={<GitMerge className="w-5 h-5 text-emerald-500" />}
            footer={
                <>
                    <button
                        onClick={handleFetch}
                        disabled={fetching || merging}
                        title="git fetch --all --prune"
                        className="mr-auto px-3 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
                        Buscar do remoto
                    </button>
                    <button
                        onClick={onClose}
                        disabled={merging}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={!canMerge}
                        className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 flex items-center gap-2 max-w-[320px]"
                    >
                        {merging ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : (
                            <GitMerge className="w-4 h-4 shrink-0" />
                        )}
                        <span className="truncate">{actionLabel}</span>
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                        {strategies.map((item) => (
                            <button
                                key={item.value}
                                disabled={merging}
                                onClick={() => setStrategy(item.value)}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${strategy === item.value
                                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-zinc-500">{strategyInfo.description}</p>
                </div>

                <div className="flex gap-4 h-72">
                    <div className="w-64 shrink-0 flex flex-col border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
                        <div className="p-2 border-b border-zinc-100 dark:border-white/5">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                                <input
                                    autoFocus
                                    value={filter}
                                    placeholder={strategy === 'rebase' ? 'Rebase em cima de...' : 'Trazer de...'}
                                    onChange={(event) => setFilter(event.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            {filtered.length === 0 && (
                                <p className="p-4 text-center text-xs text-zinc-500 italic">Nenhuma outra branch.</p>
                            )}
                            {filtered.map((branch, index) => {
                                const showGroup = index === 0 || filtered[index - 1].IsRemote !== branch.IsRemote;
                                return (
                                    <React.Fragment key={`${branch.IsRemote}-${branch.Name}`}>
                                        {showGroup && (
                                            <div className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                                                {branch.IsRemote ? 'Remotas' : 'Locais'}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setSelected(branch.Name)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${selected === branch.Name
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            {branch.IsRemote ? <Cloud className="w-3.5 h-3.5 shrink-0" /> : <GitBranch className="w-3.5 h-3.5 shrink-0" />}
                                            <span className="truncate" title={branch.Name}>{branch.Name}</span>
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col border border-zinc-200 dark:border-white/10 rounded-xl p-4 overflow-y-auto custom-scrollbar space-y-3">
                        {!selected ? (
                            <p className="m-auto text-xs text-zinc-500 italic">Escolha uma branch.</p>
                        ) : loadingPreview || !preview ? (
                            <div className="m-auto flex items-center gap-2 text-xs text-zinc-500">
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                Calculando...
                            </div>
                        ) : preview.UpToDate ? (
                            <div className="m-auto flex flex-col items-center gap-2 text-center text-xs text-zinc-500">
                                <CircleCheck className="w-8 h-8 text-emerald-500" />
                                {strategy === 'rebase'
                                    ? `${current} já está em cima de ${selected}. Nada para fazer.`
                                    : `${current} já tem todos os commits de ${selected}. Nada para mesclar.`}
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                                    {strategy === 'rebase'
                                        ? preview.Behind === 0
                                            ? `${current} vai só avançar até ${selected} (${plural(preview.Ahead, 'commit')} novos).`
                                            : `${plural(preview.Behind, 'commit')} de ${current} vão ser reaplicados em cima dos ${plural(preview.Ahead, 'commit')} novos de ${selected}.`
                                        : `${plural(preview.Ahead, 'commit')} de ${selected} vão entrar em ${current}.`}
                                </p>
                                {strategy === 'merge' && (
                                    <p className="text-xs text-zinc-500">
                                        {preview.CanFastForward ? 'Vai avançar direto (fast-forward), sem commit de merge.' : 'Vai criar um commit de merge.'}
                                    </p>
                                )}
                                {preview.ConflictingFiles.length > 0 ? (
                                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                                        <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                                            <CircleAlert className="w-4 h-4" />
                                            {strategy === 'rebase' ? 'Pode haver conflito em' : 'Vai haver conflito em'} {plural(preview.ConflictingFiles.length, 'arquivo')}
                                        </div>
                                        {preview.ConflictingFiles.slice(0, 6).map((file) => (
                                            <div key={file} className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">{file}</div>
                                        ))}
                                        <p className="text-[11px] text-zinc-500">Dá para seguir: os conflitos ficam marcados para você resolver antes de concluir.</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        <CircleCheck className="w-4 h-4" />
                                        Sem conflitos
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Commits que entram</div>
                                    {preview.Commits.slice(0, 8).map((commit) => (
                                        <div key={commit.Hash} className="flex items-center gap-2 text-[11px] min-w-0">
                                            <span className="font-mono text-zinc-400 shrink-0">{commit.Hash}</span>
                                            <span className="truncate text-zinc-700 dark:text-zinc-300">{commit.Title}</span>
                                            <span className="ml-auto shrink-0 text-zinc-400">{commit.Author}</span>
                                        </div>
                                    ))}
                                    {preview.Ahead > 8 && <div className="text-[11px] text-zinc-400">e mais {preview.Ahead - 8}...</div>}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {needsMessage && (
                    <div className="space-y-2">
                        <input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Resumo do commit" className={inputClass} />
                        <textarea
                            rows={3}
                            value={description}
                            placeholder="Descrição"
                            onChange={(event) => setDescription(event.target.value)}
                            className={`${inputClass} resize-none`}
                        />
                    </div>
                )}

                {dirty && (
                    <label className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={stashChanges}
                            onChange={(event) => setStashChanges(event.target.checked)}
                            className="mt-0.5 accent-emerald-600"
                        />
                        <span className="text-zinc-700 dark:text-zinc-300">
                            Você tem alterações não commitadas. Guardar em um stash antes de começar (elas ficam em Stashes pendentes para restaurar depois).
                            {strategy === 'rebase' && <b> Obrigatório para o rebase.</b>}
                        </span>
                    </label>
                )}
            </div>
        </Modal>
    );
};

export default MergeBranchModal;
