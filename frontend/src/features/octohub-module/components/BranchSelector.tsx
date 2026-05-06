import iziToast from 'izitoast';
import React, { useState, useEffect } from 'react';
import StashChangesModal from './StashChangesModal';
import ConflictResolutionModal from './ConflictResolutionModal';
import { EventsEmit } from '../../../../wailsjs/runtime/runtime';
import { GitBranch, Plus, Search, Check, CloudUpload } from 'lucide-react';
import { GetGitStatus } from '../../../../wailsjs/go/octohubHandler/GitCommitsHandler';
import { GetCurrentBranch, ListBranchs, ChangeBranch, CreateBranch, PublishBranch, HasUncommittedChanges, OpenFileInEditor, StageFile } from '../../../../wailsjs/go/octohubHandler/GitBranchHandler';

const BranchSelector: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [branches, setBranches] = useState<string[]>([]);
    const [newBranchName, setNewBranchName] = useState('');
    const [showStashModal, setShowStashModal] = useState(false);
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [currentBranch, setCurrentBranch] = useState<string>('');
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictingFiles, setConflictingFiles] = useState<string[]>([]);
    const [pendingBranch, setPendingBranch] = useState<string | null>(null);

    const checkAndShowConflicts = async (errStr: string): Promise<boolean> => {
        if (errStr.includes('needs merge') || errStr.toLowerCase().includes('conflict')) {
            try {
                const status = await GetGitStatus();
                if (status) {
                    const conflicts = status.filter((f: any) => f.Status.includes('U') || f.Status === 'AA' || f.Status === 'DD').map((f: any) => f.FileName);
                    if (conflicts.length > 0) {
                        setConflictingFiles(conflicts);
                        setShowConflictModal(true);
                        return true;
                    }
                }
            } catch (err) {
                console.error("Erro ao verificar conflitos", err);
            }
        }
        return false;
    };


    const loadData = async () => {
        try {
            const current = await GetCurrentBranch();
            setCurrentBranch(current);
            const list = await ListBranchs();
            const cleanList = list.map((branch: string) => branch.replace('*', '').trim());
            setBranches(cleanList);
        } catch (err) {
            console.error("Erro ao carregar branches:", err);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSwitchBranch = async (branch: string) => {
        if (branch === currentBranch) return;

        try {
            const hasChanges = await HasUncommittedChanges();
            if (hasChanges) {
                setPendingBranch(branch);
                setShowStashModal(true);
                setIsOpen(false);
                return;
            }

            setLoading(true);
            await ChangeBranch(branch, false);
            setCurrentBranch(branch);
            setIsOpen(false);
            EventsEmit('git:branch-changed', branch);
        } catch (err: any) {
            const isConflict = await checkAndShowConflicts(String(err));
            if (!isConflict) {
                iziToast.error({
                    title: 'Erro',
                    message: "Erro ao trocar de branch: " + err,
                    position: 'bottomRight',
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const confirmSwitch = async (action: 'bring' | 'leave') => {
        if (!pendingBranch) return;
        setLoading(true);
        try {
            await ChangeBranch(pendingBranch, action === 'leave');
            EventsEmit('git:branch-changed', pendingBranch);
        } catch (err: any) {
            const isConflict = await checkAndShowConflicts(String(err));
            if (!isConflict) {
                iziToast.error({
                    title: 'Erro',
                    message: "Erro ao trocar branch: " + err,
                    position: 'bottomRight',
                });
            }
        } finally {
            setLoading(false);
            setShowStashModal(false);
            setPendingBranch(null);
        }
    };

    const handleCreateBranch = async () => {
        if (!newBranchName.trim()) return;
        setLoading(true);
        try {
            await CreateBranch(newBranchName.trim());
            await handleSwitchBranch(newBranchName.trim());
            setNewBranchName('');
            setShowCreateInput(false);
        } catch (err: any) {
            alert("Erro ao criar branch: " + err);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        setLoading(true);
        try {
            await PublishBranch(currentBranch);
            alert("Branch publicada com sucesso!");
        } catch (err: any) {
            alert("Erro ao publicar branch: " + err);
        } finally {
            setLoading(false);
        }
    };

    const filteredBranches = branches.filter((branch: string) =>
        branch.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg transition-all"
                >
                    <GitBranch className="w-4 h-4 text-emerald-500" />
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Current Branch</span>
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{currentBranch || 'Loading...'}</span>
                    </div>
                </button>

                <button
                    onClick={handlePublish}
                    disabled={loading}
                    className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all flex items-center gap-2"
                    title="Publish Branch"
                >
                    <CloudUpload className="w-4 h-4" />
                    <span className="text-xs font-bold hidden md:inline">Publish</span>
                </button>
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-zinc-100 dark:border-white/5 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Filter branches..."
                                    className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                />
                            </div>

                            {!showCreateInput ? (
                                <button
                                    onClick={() => setShowCreateInput(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg border border-dashed border-emerald-500/30 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    New Branch
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Branch name..."
                                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-emerald-500/50 rounded-lg text-xs focus:outline-none"
                                        value={newBranchName}
                                        onChange={(event) => setNewBranchName(event.target.value)}
                                        onKeyDown={(event) => event.key === 'Enter' && handleCreateBranch()}
                                    />
                                    <button
                                        onClick={handleCreateBranch}
                                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="max-h-64 overflow-y-auto p-1">
                            {filteredBranches.map(branch => (
                                <button
                                    key={branch}
                                    onClick={() => handleSwitchBranch(branch)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors group ${branch === currentBranch ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <GitBranch className={`w-3.5 h-3.5 ${branch === currentBranch ? 'text-emerald-500' : 'text-zinc-400'}`} />
                                        <span className="text-xs font-medium">{branch}</span>
                                    </div>
                                    {branch === currentBranch && <Check className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <StashChangesModal
                isOpen={showStashModal}
                onClose={() => setShowStashModal(false)}
                currentBranch={currentBranch}
                targetBranch={pendingBranch}
                onConfirm={confirmSwitch}
                loading={loading}
            />

            <ConflictResolutionModal
                isOpen={showConflictModal}
                onClose={() => setShowConflictModal(false)}
                conflictingFiles={conflictingFiles}
                onOpenFile={(file) => {
                    OpenFileInEditor(file).catch(err => {
                        iziToast.error({ title: 'Erro', message: "Erro ao abrir no VSCode: " + err, position: 'bottomRight' });
                    });
                }}
                onStageFile={async (file) => {
                    try {
                        await StageFile(file);
                        iziToast.success({ title: 'Resolvido', message: `${file} marcado como resolvido.`, position: 'bottomRight' });
                        const stillHasConflicts = await checkAndShowConflicts('conflict');
                        if (!stillHasConflicts) {
                            setShowConflictModal(false);
                            iziToast.success({ title: 'Tudo Limpo', message: 'Todos os conflitos foram resolvidos!', position: 'bottomRight' });
                        }
                    } catch (err: any) {
                        iziToast.error({ title: 'Erro', message: "Erro ao marcar como resolvido: " + err, position: 'bottomRight' });
                    }
                }}
            />
        </div>
    );
};

export default BranchSelector;
