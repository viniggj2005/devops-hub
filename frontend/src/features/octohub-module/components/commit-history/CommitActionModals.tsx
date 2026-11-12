import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import { Modal } from '../../../shared/components/modals/Modal';
import { useTranslation } from '../../../i18n/useTranslation';
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

const Footer: React.FC<{ busy: boolean; disabled: boolean; label: string; onConfirm: () => void; onClose: () => void }> = ({ busy, disabled, label, onConfirm, onClose }) => {
    const { dictionary } = useTranslation();
    return (
    <>
        <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
        >
            {dictionary.app.common.cancel}
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
};

const StashOption: React.FC<{ dirty: boolean; checked: boolean; required?: boolean; onChange: (value: boolean) => void }> = ({ dirty, checked, required, onChange }) => {
    const { dictionary } = useTranslation();
    const actionTexts = dictionary.octohub.commitActions;
    return dirty ? (
        <label className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 accent-emerald-600" />
            <span className="text-zinc-700 dark:text-zinc-300">
                {actionTexts.stashBefore}
                {required && <b>{actionTexts.requiredForOperation}</b>}
            </span>
        </label>
    ) : null;
};

const CommitSummary: React.FC<{ commit: octohubStructs.Commit }> = ({ commit }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-white/5 text-xs min-w-0">
        <span className="font-mono text-zinc-400 shrink-0">{shortHash(commit.Hash)}</span>
        <span className="truncate text-zinc-700 dark:text-zinc-300">{commit.Title}</span>
    </div>
);

const CreateBranchModal: React.FC<ActionProps> = ({ commit, onClose }) => {
    const { notifyChange, handleGitError } = useOctohubRepository();
    const { dictionary, formatMessage } = useTranslation();
    const actionTexts = dictionary.octohub.commitActions;
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [checkout, setCheckout] = useState(true);
    const branchName = name.trim().replace(/\s+/g, '-');

    const create = async () => {
        if (!branchName) return;
        setBusy(true);
        try {
            await CreateBranchFromCommit(branchName, commit.Hash, checkout);
            toast.success(formatMessage(actionTexts.branchCreated, { name: branchName, hash: shortHash(commit.Hash) }));
            notifyChange();
            onClose();
        } catch (error) {
            handleGitError(error, actionTexts.branchFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="sm"
            onClose={onClose}
            title={actionTexts.branchTitle}
            icon={<GitBranchPlus className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!branchName} label={actionTexts.createBranch} onConfirm={create} onClose={onClose} />}
        >
            <div className="space-y-3">
                <CommitSummary commit={commit} />
                <input
                    autoFocus
                    value={name}
                    className={inputClass}
                    placeholder={actionTexts.branchPlaceholder}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && create()}
                />
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={checkout} onChange={(event) => setCheckout(event.target.checked)} className="accent-emerald-600" />
                    {actionTexts.switchToNewBranch}
                </label>
            </div>
        </Modal>
    );
};

const CreateTagModal: React.FC<ActionProps> = ({ commit, onClose }) => {
    const { notifyChange, handleGitError } = useOctohubRepository();
    const { dictionary, formatMessage } = useTranslation();
    const actionTexts = dictionary.octohub.commitActions;
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [push, setPush] = useState(false);
    const [message, setMessage] = useState('');
    const tagName = name.trim();

    const pushTag = async (tag: string) => {
        try {
            await PushTag(tag);
            toast.success(formatMessage(actionTexts.tagPushed, { tag }));
        } catch (error) {
            handleGitError(error, actionTexts.tagNotPushed, () => pushTag(tag));
        }
    };

    const create = async () => {
        if (!tagName) return;
        setBusy(true);
        try {
            await CreateTag(tagName, commit.Hash, message);
            toast.success(formatMessage(actionTexts.tagCreated, { tag: tagName, hash: shortHash(commit.Hash) }));
            notifyChange();
            onClose();
            if (push) await pushTag(tagName);
        } catch (error) {
            handleGitError(error, actionTexts.tagFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="sm"
            title={actionTexts.tagTitle}
            onClose={onClose}
            icon={<Tag className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!tagName} label={actionTexts.createTag} onConfirm={create} onClose={onClose} />}
        >
            <div className="space-y-3">
                <CommitSummary commit={commit} />
                <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="v1.0.0" className={inputClass} />
                <textarea
                    rows={3}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={actionTexts.tagMessagePlaceholder}
                    className={`${inputClass} resize-none`}
                />
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={push} onChange={(event) => setPush(event.target.checked)} className="accent-emerald-600" />
                    {actionTexts.pushTagNow}
                </label>
            </div>
        </Modal>
    );
};

const CherryPickModal: React.FC<ActionProps> = ({ commit, onClose }) => {
    const { notifyChange, openConflicts, handleGitError } = useOctohubRepository();
    const { dictionary, formatMessage } = useTranslation();
    const actionTexts = dictionary.octohub.commitActions;
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
            else toast.success(formatMessage(actionTexts.cherryPicked, { branch: target }));
        } catch (error) {
            handleGitError(error, actionTexts.cherryPickFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="sm"
            onClose={onClose}
            title={actionTexts.cherryPickTitle}
            icon={<Cherry className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!target} label={target ? formatMessage(actionTexts.applyOn, { branch: target }) : actionTexts.chooseBranch} onConfirm={apply} onClose={onClose} />}
        >
            <div className="space-y-3">
                <CommitSummary commit={commit} />
                <p className="text-[11px] text-zinc-500">{actionTexts.cherryPickHint}</p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={dictionary.octohub.common.filterBranches} className={`${inputClass} pl-8`} />
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar border border-zinc-200 dark:border-white/10 rounded-lg p-1">
                    {filtered.length === 0 ? (
                        <p className="p-4 text-center text-xs text-zinc-500 italic">{actionTexts.noOtherLocalBranch}</p>
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
    const { dictionary } = useTranslation();
    const actionTexts = dictionary.octohub.commitActions;
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
                handleGitError(error, actionTexts.loadCommitsFailed);
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
            else toast.success(actionTexts.reordered);
        } catch (error) {
            handleGitError(error, actionTexts.reorderFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen
            size="md"
            onClose={onClose}
            title={actionTexts.reorderTitle}
            icon={<ArrowUpDown className="w-5 h-5 text-emerald-500" />}
            footer={<Footer busy={busy} disabled={!changed || (dirty && !stash)} label={actionTexts.applyOrder} onConfirm={apply} onClose={onClose} />}
        >
            <div className="space-y-3">
                <p className="text-[11px] text-zinc-500">
                    {actionTexts.reorderHint}
                </p>
                {original !== null && !commitListed && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {actionTexts.commitNotListed}
                    </p>
                )}
                {original === null ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-zinc-500">
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        {actionTexts.loadingCommits}
                    </div>
                ) : movableCount < 2 ? (
                    <p className="py-6 text-center text-xs text-zinc-500 italic">
                        {actionTexts.notEnoughCommits}
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
                                        <span title={actionTexts.alreadyPushed} className="shrink-0 flex items-center gap-1 text-[10px] text-zinc-400">
                                            <LockKeyhole className="w-3 h-3" />
                                            {actionTexts.pushed}
                                        </span>
                                    ) : (
                                        <div className="shrink-0 flex flex-col">
                                            <button
                                                title={actionTexts.moveUp}
                                                disabled={index === 0 || busy}
                                                onClick={() => move(index, -1)}
                                                className="p-0.5 rounded text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30"
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                title={actionTexts.moveDown}
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
