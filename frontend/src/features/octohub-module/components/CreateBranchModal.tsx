import toast from 'react-hot-toast';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../shared/components/modals/Modal';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import * as octohubStructs from '../../../../bindings/docker-manager-go/src/octohub/structs/models';
import { CircleAlert, Cloud, GitBranch, GitBranchPlus, RefreshCw, Search } from 'lucide-react';
import { CreateBranchFrom, FetchRemotes, HasUncommittedChanges, ListMergeableBranches } from '../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';

interface CreateBranchModalProps {
    open: boolean;
    onClose: () => void;
    initialName?: string;
}

const normalizeBranchName = (name: string) => name.trim().replace(/\s+/g, '-');

const CreateBranchModal: React.FC<CreateBranchModalProps> = ({ open, onClose, initialName = '' }) => {
    const [name, setName] = useState('');
    const [filter, setFilter] = useState('');
    const [dirty, setDirty] = useState(false);
    const [checkout, setCheckout] = useState(true);
    const [creating, setCreating] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [branches, setBranches] = useState<octohubStructs.BranchInfo[]>([]);
    const { currentBranch, notifyChange, handleGitError } = useOctohubRepository();

    const isDetached = currentBranch === 'HEAD';
    const branchName = normalizeBranchName(name);

    const loadBranches = async (preferred: string | null) => {
        const others = (await ListMergeableBranches()) || [];
        const current = currentBranch && !isDetached ? [octohubStructs.BranchInfo.createFrom({ Name: currentBranch, IsCurrent: true })] : [];
        const list = [...current, ...others];
        setBranches(list);
        setSelected((previous) => {
            if (previous && list.some((branch) => branch.Name === previous)) return previous;
            if (preferred && list.some((branch) => branch.Name === preferred)) return preferred;
            return list[0]?.Name ?? 'HEAD';
        });
    };

    useEffect(() => {
        if (!open) return;
        setFilter('');
        setCheckout(true);
        setSelected(null);
        setName(initialName);
        HasUncommittedChanges().then(setDirty).catch(() => setDirty(false));
        loadBranches(isDetached ? null : currentBranch || null).catch((error) =>
            toast.error(errorMessage(error))
        );
    }, [open]);

    const query = filter.trim().toLowerCase();
    const filtered = useMemo(
        () => branches.filter((branch) => branch.Name.toLowerCase().includes(query)),
        [branches, query]
    );

    const duplicated = branches.some((branch) => !branch.IsRemote && branch.Name === branchName);
    const canCreate = branchName !== '' && !duplicated && Boolean(selected) && !creating && !fetching;

    const handleFetch = async () => {
        setFetching(true);
        try {
            await FetchRemotes();
            await loadBranches(selected);
            notifyChange();
            toast.success('Branches remotas atualizadas.');
        } catch (error) {
            handleGitError(error, 'Erro ao buscar do remoto', handleFetch);
        } finally {
            setFetching(false);
        }
    };

    const handleCreate = async () => {
        if (!canCreate || !selected) return;
        setCreating(true);
        try {
            await CreateBranchFrom(branchName, selected, checkout);
            notifyChange();
            onClose();
            toast.success(
                checkout
                    ? `Branch ${branchName} criada a partir de ${selected}. Agora você está nela.`
                    : `Branch ${branchName} criada a partir de ${selected}.`
            );
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setCreating(false);
        }
    };

    const inputClass = 'w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500';

    return (
        <Modal
            size="md"
            isOpen={open}
            title="Nova branch"
            description={selected ? `a partir de ${selected}` : undefined}
            onClose={() => !creating && onClose()}
            icon={<GitBranchPlus className="w-5 h-5 text-emerald-500" />}
            footer={
                <>
                    <button
                        onClick={handleFetch}
                        disabled={fetching || creating}
                        title="git fetch --all --prune"
                        className="mr-auto px-3 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
                        Buscar do remoto
                    </button>
                    <button
                        onClick={onClose}
                        disabled={creating}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!canCreate}
                        className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 flex items-center gap-2"
                    >
                        {creating ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : (
                            <GitBranchPlus className="w-4 h-4 shrink-0" />
                        )}
                        Criar branch
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome da branch</label>
                    <input
                        autoFocus
                        value={name}
                        placeholder="ex: feature/nova-tela"
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
                        className={inputClass}
                    />
                    {name.trim() !== branchName && branchName && (
                        <p className="text-[11px] text-zinc-500">
                            Será criada como <span className="font-mono">{branchName}</span>
                        </p>
                    )}
                    {duplicated && (
                        <p className="flex items-center gap-1.5 text-[11px] text-rose-500">
                            <CircleAlert className="w-3.5 h-3.5" />
                            Já existe uma branch local com esse nome.
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Criar a partir de</label>
                    <div className="flex flex-col h-64 border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
                        <div className="p-2 border-b border-zinc-100 dark:border-white/5">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                                <input
                                    value={filter}
                                    placeholder="Filtrar branches..."
                                    onChange={(event) => setFilter(event.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            {filtered.length === 0 && (
                                <p className="p-4 text-center text-xs text-zinc-500 italic">
                                    {isDetached && branches.length === 0 ? 'Será criada a partir do HEAD atual.' : 'Nenhuma branch encontrada.'}
                                </p>
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
                                            {branch.IsCurrent && <span className="ml-auto shrink-0 text-[10px] font-normal text-zinc-400">atual</span>}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                        type="checkbox"
                        checked={checkout}
                        onChange={(event) => setCheckout(event.target.checked)}
                        className="mt-0.5 accent-emerald-600"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">Mudar para a nova branch depois de criar</span>
                </label>

                {dirty && checkout && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-zinc-700 dark:text-zinc-300">
                        <CircleAlert className="w-4 h-4 shrink-0 text-amber-500" />
                        Você tem alterações não commitadas. Elas vão junto para a nova branch; se conflitarem com a branch de origem, a criação é cancelada.
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CreateBranchModal;
