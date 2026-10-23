import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import { Modal } from '../../../shared/components/modals/Modal';
import { useOctohubRepository } from '../../contexts/OctohubRepositoryContext';
import * as octohubStructs from '../../../../../bindings/docker-manager-go/src/octohub/structs/models';
import { ArrowUpDown, ChevronDown, ChevronUp, Cherry, GitBranch, GitBranchPlus, LockKeyhole, Search, Tag } from 'lucide-react';
import { CherryPickCommit, CreateBranchFromCommit, CreateTag, HasUncommittedChanges, ListBranches, ListReorderableCommits, PushTag, ReorderCommits } from '../../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';

export type CommitAction = 'branch' | 'tag' | 'cherry-pick' | 'reorder';

interface CommitActionModalProps {
    onClose: () => void;
    action: CommitAction | null;
    commit: octohubStructs.Commit | null;
}

interface ActionProps {
    onClose: () => void;
    commit: octohubStructs.Commit;
}

const shortHash = (hash: string) => hash.slice(0, 7);

const inputClass = 'w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500';

const Footer: React.FC<{ busy: boolean; disabled: boolean; label: string; onConfirm: () => void; onClose: () => void }> = ({ busy, disabled, label, onConfirm, onClose }) => (
    <>
        <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
        >
            Cancelar
        </button>
        <button
            onClick={onConfirm}
            disabled={disabled || busy}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 flex items-center gap-2"
        >
            {busy && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {label}
        </button>
    </>
);

const StashOption: React.FC<{ dirty: boolean; checked: boolean; required?: boolean; onChange: (value: boolean) => void }> = ({ dirty, checked, required, onChange }) =>
    dirty ? (
        <label className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 accent-emerald-600" />
            <span className="text-zinc-700 dark:text-zinc-300">
                Você tem alterações não commitadas. Guardar em um stash antes (elas ficam em Stashes pendentes).
                {required && <b> Obrigatório para esta operação.</b>}
            </span>
        </label>
    ) : null;

const CommitSummary: React.FC<{ commit: octohubStructs.Commit }> = ({ commit }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-white/5 text-xs min-w-0">
        <span className="font-mono text-zinc-400 shrink-0">{shortHash(commit.Hash)}</span>
        <span className="truncate text-zinc-700 dark:text-zinc-300">{commit.Title}</span>
    </div>
);

const CreateBranchModal: React.FC<ActionProps> = ({ commit, onClose }) => {
    const { notifyChange, handleGitError } = useOctohubRepository();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [checkout, setCheckout] = useState(true);
    const branchName = name.trim().replace(/\s+/g, '-');

    const create = async () => {
        if (!branchName) return;
        setBusy(true);
        try {
            await CreateBranchFromCommit(branchName, commit.Hash, checkout);
            toast.success(`Branch ${branchName} criada em ${shortHash(commit.Hash)}.`);
            notifyChange();
            onClose();
        } catch (error) {
            handleGitError(error, 'Erro ao criar a branch');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="sm"
            onClose={onClose}
            title="Criar branch a partir do commit"
            icon={<GitBranchPlus className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!branchName} label="Criar branch" onConfirm={create} onClose={onClose} />}
        >
            <div className="space-y-3">
                <CommitSummary commit={commit} />
                <input
                    autoFocus
                    value={name}
                    className={inputClass}
                    placeholder="nome-da-branch"
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && create()}
                />
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={checkout} onChange={(event) => setCheckout(event.target.checked)} className="accent-emerald-600" />
                    Trocar para a nova branch
                </label>
            </div>
        </Modal>
    );
};

const CreateTagModal: React.FC<ActionProps> = ({ commit, onClose }) => {
    const { notifyChange, handleGitError } = useOctohubRepository();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [push, setPush] = useState(false);
    const [message, setMessage] = useState('');
    const tagName = name.trim();

    const pushTag = async (tag: string) => {
        try {
            await PushTag(tag);
            toast.success(`Tag ${tag} enviada para o origin.`);
        } catch (error) {
            handleGitError(error, 'A tag foi criada, mas não foi enviada', () => pushTag(tag));
        }
    };

    const create = async () => {
        if (!tagName) return;
        setBusy(true);
        try {
            await CreateTag(tagName, commit.Hash, message);
            toast.success(`Tag ${tagName} criada em ${shortHash(commit.Hash)}.`);
            notifyChange();
            onClose();
            if (push) await pushTag(tagName);
        } catch (error) {
            handleGitError(error, 'Erro ao criar a tag');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="sm"
            title="Criar tag"
            onClose={onClose}
            icon={<Tag className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!tagName} label="Criar tag" onConfirm={create} onClose={onClose} />}
        >
            <div className="space-y-3">
                <CommitSummary commit={commit} />
                <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="v1.0.0" className={inputClass} />
                <textarea
                    rows={3}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Mensagem (opcional; com mensagem a tag fica anotada)"
                    className={`${inputClass} resize-none`}
                />
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={push} onChange={(event) => setPush(event.target.checked)} className="accent-emerald-600" />
                    Enviar a tag para o origin agora
                </label>
            </div>
        </Modal>
    );
};

const CherryPickModal: React.FC<ActionProps> = ({ commit, onClose }) => {
    const { notifyChange, openConflicts, handleGitError } = useOctohubRepository();
    const [filter, setFilter] = useState('');
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [stash, setStash] = useState(true);
    const [target, setTarget] = useState<string | null>(null);
    const [branches, setBranches] = useState<octohubStructs.BranchInfo[]>([]);

    useEffect(() => {
        ListBranches()
            .then((list) => setBranches((list || []).filter((branch) => !branch.IsRemote && !branch.IsCurrent)))
            .catch(() => setBranches([]));
        HasUncommittedChanges().then(setDirty).catch(() => setDirty(false));
    }, []);

    const query = filter.trim().toLowerCase();
    const filtered = branches.filter((branch) => branch.Name.toLowerCase().includes(query));

    const apply = async () => {
        if (!target) return;
        setBusy(true);
        try {
            const state = await CherryPickCommit(commit.Hash, target, dirty && stash);
            notifyChange();
            onClose();
            if (state.Kind) openConflicts();
            else toast.success(`Commit aplicado em ${target}. Agora você está nessa branch.`);
        } catch (error) {
            handleGitError(error, 'Erro no cherry-pick');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="sm"
            onClose={onClose}
            title="Cherry-pick do commit"
            icon={<Cherry className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!target} label={target ? `Aplicar em ${target}` : 'Escolha a branch'} onConfirm={apply} onClose={onClose} />}
        >
            <div className="space-y-3">
                <CommitSummary commit={commit} />
                <p className="text-[11px] text-zinc-500">O OctoHub troca para a branch escolhida e aplica este commit nela.</p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar branches..." className={`${inputClass} pl-8`} />
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar border border-zinc-200 dark:border-white/10 rounded-lg p-1">
                    {filtered.length === 0 ? (
                        <p className="p-4 text-center text-xs text-zinc-500 italic">Nenhuma outra branch local.</p>
                    ) : (
                        filtered.map((branch) => (
                            <button
                                key={branch.Name}
                                onClick={() => setTarget(branch.Name)}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors ${target === branch.Name
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                                }`}
                            >
                                <GitBranch className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{branch.Name}</span>
                            </button>
                        ))
                    )}
                </div>
                <StashOption dirty={dirty} checked={stash} onChange={setStash} />
            </div>
        </Modal>
    );
};

const ReorderModal: React.FC<ActionProps> = ({ commit, onClose }) => {
    const { notifyChange, openConflicts, handleGitError } = useOctohubRepository();
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [stash, setStash] = useState(true);
    const [order, setOrder] = useState<octohubStructs.ReorderableCommit[]>([]);
    const [original, setOriginal] = useState<octohubStructs.ReorderableCommit[] | null>(null);

    useEffect(() => {
        ListReorderableCommits()
            .then((list) => {
                setOriginal(list || []);
                setOrder(list || []);
            })
            .catch((error) => {
                handleGitError(error, 'Erro ao carregar os commits');
                onClose();
            });
        HasUncommittedChanges().then(setDirty).catch(() => setDirty(false));
    }, []);

    const firstPushed = order.findIndex((item) => item.Pushed);
    const movableCount = firstPushed < 0 ? order.length : firstPushed;
    const changed = original !== null && order.some((item, index) => item.Hash !== original[index].Hash);
    const commitListed = order.some((item) => item.Hash === commit.Hash);

    const move = (index: number, direction: number) => {
        const target = index + direction;
        if (target < 0 || target >= movableCount) return;
        setOrder((previous) => {
            const next = [...previous];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const apply = async () => {
        setBusy(true);
        try {
            const state = await ReorderCommits(order.slice(0, movableCount).map((item) => item.Hash), dirty && stash);
            notifyChange();
            onClose();
            if (state.Kind) openConflicts();
            else toast.success('Commits reordenados.');
        } catch (error) {
            handleGitError(error, 'Erro ao reordenar os commits');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="md"
            onClose={onClose}
            title="Reordenar commits"
            icon={<ArrowUpDown className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!changed || (dirty && !stash)} label="Aplicar nova ordem" onConfirm={apply} onClose={onClose} />}
        >
            <div className="space-y-3">
                <p className="text-[11px] text-zinc-500">
                    Do mais novo (em cima) ao mais antigo. Use as setas para mudar a posição; o OctoHub refaz os commits na nova ordem.
                    Commits já enviados para o remoto ficam travados, porque mudá-los exigiria forçar o envio.
                </p>
                {original !== null && !commitListed && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        O commit escolhido já foi enviado, está antes de um merge ou não está entre os 30 mais recentes.
                    </p>
                )}
                {original === null ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-zinc-500">
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        Carregando commits...
                    </div>
                ) : movableCount < 2 ? (
                    <p className="py-6 text-center text-xs text-zinc-500 italic">
                        Não há commits suficientes para reordenar: os enviados ao remoto ficam travados e a lista para no último merge.
                    </p>
                ) : null}
                {order.length > 0 && (
                    <div className="max-h-80 overflow-y-auto custom-scrollbar border border-zinc-200 dark:border-white/10 rounded-lg divide-y divide-zinc-100 dark:divide-white/5">
                        {order.map((item, index) => {
                            const locked = index >= movableCount;
                            return (
                                <div
                                    key={item.Hash}
                                    className={`flex items-center gap-3 px-3 py-2 ${item.Hash === commit.Hash ? 'bg-emerald-500/10' : ''} ${locked ? 'opacity-60' : ''}`}
                                >
                                    <span className="w-14 shrink-0 font-mono text-[11px] text-zinc-400">{item.ShortHash}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium truncate text-zinc-800 dark:text-zinc-200">{item.Title}</div>
                                        <div className="text-[10px] text-zinc-500 truncate">{item.Author}</div>
                                    </div>
                                    {locked ? (
                                        <span title="Já enviado ao remoto" className="shrink-0 flex items-center gap-1 text-[10px] text-zinc-400">
                                            <LockKeyhole className="w-3 h-3" />
                                            enviado
                                        </span>
                                    ) : (
                                        <div className="shrink-0 flex flex-col">
                                            <button
                                                title="Mover para cima"
                                                disabled={index === 0 || busy}
                                                onClick={() => move(index, -1)}
                                                className="p-0.5 rounded text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30"
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                title="Mover para baixo"
                                                disabled={index >= movableCount - 1 || busy}
                                                onClick={() => move(index, 1)}
                                                className="p-0.5 rounded text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30"
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <StashOption dirty={dirty} checked={stash} onChange={setStash} required />
            </div>
        </Modal>
    );
};

const CommitActionModal: React.FC<CommitActionModalProps> = ({ commit, action, onClose }) => {
    if (!commit || !action) return null;
    switch (action) {
        case 'branch':
            return <CreateBranchModal commit={commit} onClose={onClose} />;
        case 'tag':
            return <CreateTagModal commit={commit} onClose={onClose} />;
        case 'cherry-pick':
            return <CherryPickModal commit={commit} onClose={onClose} />;
        default:
            return <ReorderModal commit={commit} onClose={onClose} />;
    }
};

export default CommitActionModal;
