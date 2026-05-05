import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Search, Check, CloudUpload, Trash2, X, AlertCircle } from 'lucide-react';
import { GetCurrentBranch, ListBranchs, ChangeBranch, CreateBranch, PublishBranch, HasUncommittedChanges } from '../../../../wailsjs/go/octohubHandler/GitBranchHandler';

const BranchSelector: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [branches, setBranches] = useState<string[]>([]);
    const [newBranchName, setNewBranchName] = useState('');
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [currentBranch, setCurrentBranch] = useState<string>('');

    const [showStashModal, setShowStashModal] = useState(false);
    const [pendingBranch, setPendingBranch] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const current = await GetCurrentBranch();
            setCurrentBranch(current);
            const list = await ListBranchs();
            const cleanList = list.map(b => b.replace('*', '').trim());
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
            window.location.reload();
        } catch (err: any) {
            alert("Erro ao trocar de branch: " + err);
        } finally {
            setLoading(false);
        }
    };

    const confirmSwitch = async (action: 'bring' | 'leave') => {
        if (!pendingBranch) return;
        setLoading(true);
        try {
            await ChangeBranch(pendingBranch, action === 'leave');
            window.location.reload();
        } catch (err: any) {
            alert("Erro ao trocar branch: " + err);
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

    const filteredBranches = branches.filter(branch =>
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
                            {filteredBranches.length === 0 && (
                                <div className="p-8 text-center text-zinc-500 text-xs italic">
                                    No branches found
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {showStashModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStashModal(false)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-zinc-100 dark:border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                    Switch Branch
                                </h3>
                                <button onClick={() => setShowStashModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-zinc-400" />
                                </button>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                You have local changes on <span className="font-bold text-emerald-500">{currentBranch}</span>.
                                How would you like to handle them before switching to <span className="font-bold text-emerald-500">{pendingBranch}</span>?
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <button
                                onClick={() => confirmSwitch('bring')}
                                className="w-full p-4 border border-zinc-200 dark:border-white/10 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                                        <CloudUpload className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Bring my changes to {pendingBranch}</h4>
                                        <p className="text-xs text-zinc-500 mt-1">Your changes will be temporarily stashed and moved to the new branch.</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => confirmSwitch('leave')}
                                className="w-full p-4 border border-zinc-200 dark:border-white/10 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                                        <Trash2 className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Leave my changes on {currentBranch}</h4>
                                        <p className="text-xs text-zinc-500 mt-1">Your changes will be stashed on this branch and can be recovered later.</p>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="p-4 bg-zinc-50 dark:bg-black/20 flex justify-end gap-3">
                            <button
                                onClick={() => setShowStashModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchSelector;
