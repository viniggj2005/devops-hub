import iziToast from 'izitoast';
import { GitCommit, FileCode, Clock } from 'lucide-react';
import { octohubStructs } from '../../../wailsjs/go/models';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import DiffViewer from '../../features/octohub-module/components/commit-history/DiffViewer';
import CommitSidebar from '../../features/octohub-module/components/commit-history/CommitSidebar';
import ChangesSidebar from '../../features/octohub-module/components/commit-history/ChangesSidebar';
import ConflictResolutionModal from '../../features/octohub-module/components/ConflictResolutionModal';
import ModifiedFileList from '../../features/octohub-module/components/commit-history/ModifiedFileList';
import CommitDetailsHeader from '../../features/octohub-module/components/commit-history/CommitDetailsHeader';
import { GetStashedFileDiff, ListStashes, PopStash, DropStash, OpenFileInEditor, StageFile } from '../../../wailsjs/go/octohubHandler/GitBranchHandler';
import { ListCommits, GetCommitModifications, GetCommitedFileChanges, GetGitStatus, GetUncommitedFileChanges } from '../../../wailsjs/go/octohubHandler/GitCommitsHandler';

const CommitHistoryPage: React.FC = () => {
    const [_, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadingDiff, setLoadingDiff] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);
    const [fileDiff, setFileDiff] = useState<string | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [stashes, setStashes] = useState<octohubStructs.Stash[]>([]);
    const [commits, setCommits] = useState<octohubStructs.Commit[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [conflictingFiles, setConflictingFiles] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'changes' | 'history'>('changes');
    const [changedFiles, setChangedFiles] = useState<octohubStructs.FilesStatus[]>([]);
    const [selectedChangedFiles, setSelectedChangedFiles] = useState<Set<string>>(new Set());
    const [selectedCommit, setSelectedCommit] = useState<octohubStructs.Commit | null>(null);
    const [modifications, setModifications] = useState<octohubStructs.FileModification[]>([]);

    const [filesWidth, setFilesWidth] = useState(350);
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [resizingFiles, setResizingFiles] = useState(false);
    const [resizingSidebar, setResizingSidebar] = useState(false);

    const startResizingSidebar = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setResizingSidebar(true);
    }, []);

    const startResizingFiles = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setResizingFiles(true);
    }, []);

    const stopResizing = useCallback(() => {
        setResizingSidebar(false);
        setResizingFiles(false);
    }, []);

    const resize = useCallback((event: MouseEvent) => {
        if (resizingSidebar) {
            const newWidth = event.clientX;
            if (newWidth > 200 && newWidth < 600) setSidebarWidth(newWidth);
        } else if (resizingFiles) {
            const newWidth = event.clientX - sidebarWidth;
            if (newWidth > 200 && newWidth < 800) setFilesWidth(newWidth);
        }
    }, [resizingSidebar, resizingFiles, sidebarWidth]);

    useEffect(() => {
        if (resizingSidebar || resizingFiles) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resizingSidebar, resizingFiles, resize, stopResizing]);

    const lastCommitElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(previousPage => {
                    const nextPage = previousPage + 1;
                    fetchCommits(nextPage, true);
                    return nextPage;
                });
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    const fetchCommits = async (pageNum = 0, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const data = await ListCommits(pageNum);
            if (data && data.length > 0) {
                if (append) {
                    setCommits(previousCommits => [...previousCommits, ...data]);
                } else {
                    setCommits(data);
                    if (!selectedCommit) setSelectedCommit(data[0]);
                }
                if (data.length < 15) setHasMore(false);
                else setHasMore(true);
            } else {
                if (!append) setCommits([]);
                setHasMore(false);
            }
        } catch (err: any) {
            console.error("Erro ao buscar commits:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const fetchGitStatus = async () => {
        try {
            const status = await GetGitStatus();
            const files = status || [];
            setChangedFiles(files);
            setSelectedChangedFiles(new Set(files.map(file => file.FileName)));

            if (activeTab === 'changes' && files.length > 0) {
                fetchUncommitedDiff(files[0].FileName);
            }

            const stashesList = await ListStashes();
            setStashes(stashesList || []);
        } catch (err: any) {
            console.error("Erro ao buscar status do git:", err);
        }
    };

    const handlePopStash = async (stashID: string) => {
        try {
            await PopStash(stashID);
            fetchGitStatus();
            iziToast.success({ title: 'Sucesso', message: 'Stash restaurado.', position: 'bottomRight' });
        } catch (err: any) {
            const errStr = String(err);
            if (errStr.includes('conflict') || errStr.includes('needs merge') || errStr.includes('Merge conflict')) {
                try {
                    const status = await GetGitStatus();
                    if (status) {
                        const conflicts = status.filter((f: any) => f.Status.includes('U') || f.Status === 'AA' || f.Status === 'DD').map((f: any) => f.FileName);
                        if (conflicts.length > 0) {
                            setConflictingFiles(conflicts);
                            setShowConflictModal(true);
                            return;
                        }
                    }
                } catch (err: any) {
                    console.error("Erro ao verificar conflitos", err);
                }
            }
            iziToast.error({ title: 'Erro', message: "Erro ao restaurar stash: " + err, position: 'bottomRight' });
        }
    };

    const handleDropStash = async (stashID: string) => {
        if (!confirm("Tem certeza que deseja descartar este stash permanentemente?")) return;
        try {
            await DropStash(stashID);
            fetchGitStatus();
            iziToast.success({ title: 'Sucesso', message: 'Stash descartado.', position: 'bottomRight' });
        } catch (err: any) {
            iziToast.error({ title: 'Erro', message: "Erro ao descartar stash: " + err, position: 'bottomRight' });
        }
    };

    const fetchUncommitedDiff = async (filePath: string) => {
        setLoadingDiff(true);
        setSelectedFile(filePath);
        try {
            const diff = await GetUncommitedFileChanges(filePath);
            setFileDiff(diff);
        } catch (err: any) {
            setFileDiff("Erro ao carregar o diff das alterações locais.");
        } finally {
            setLoadingDiff(false);
        }
    };

    const fetchStashedFileDiff = async (stashID: string, filePath: string) => {
        setLoadingDiff(true);
        setSelectedFile(filePath);
        try {
            const diff = await GetStashedFileDiff(stashID, filePath);
            setFileDiff(diff);
        } catch (err: any) {
            setFileDiff("Erro ao carregar o diff do arquivo stashed.");
        } finally {
            setLoadingDiff(false);
        }
    };


    useEffect(() => {
        fetchGitStatus();
        fetchCommits(0);

        const unbind = EventsOn('git:branch-changed', () => {
            fetchGitStatus();
            fetchCommits(0, false);
        });
        return () => unbind();
    }, []);

    const toggleFileSelection = (fileName: string) => {
        setSelectedChangedFiles(previous => {
            const next = new Set(previous);
            if (next.has(fileName)) next.delete(fileName);
            else next.add(fileName);
            return next;
        });
    };

    const toggleAllSelection = () => {
        if (selectedChangedFiles.size === changedFiles.length && changedFiles.length > 0) {
            setSelectedChangedFiles(new Set());
        } else {
            setSelectedChangedFiles(new Set(changedFiles.map(file => file.FileName)));
        }
    };

    useEffect(() => {
        if (selectedCommit) {
            fetchModifications(selectedCommit.Hash);
        }
    }, [selectedCommit]);

    const fetchModifications = async (hash: string) => {
        setLoadingFiles(true);
        setSelectedFile(null);
        setFileDiff(null);
        try {
            const mods = await GetCommitModifications(hash);
            const modificationList = mods || [];
            setModifications(modificationList);

            if (modificationList.length > 0) {
                fetchFileDiff(modificationList[0].File, hash);
            }
        } catch (err: any) {
            setModifications([]);
        } finally {
            setLoadingFiles(false);
        }
    };

    const fetchFileDiff = async (filePath: string, commitHash?: string) => {
        const hash = commitHash || selectedCommit?.Hash;
        if (!hash) return;

        setLoadingDiff(true);
        setSelectedFile(filePath);
        try {
            const diff = await GetCommitedFileChanges(hash, filePath);
            setFileDiff(diff);
        } catch (err: any) {
            setFileDiff("Erro ao carregar o diff.");
        } finally {
            setLoadingDiff(false);
        }
    };

    const filteredCommits = commits.filter(commit =>
        commit.Title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        commit.Hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        commit.Author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && commits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500 font-medium">Carregando histórico de commits...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-white/5 overflow-hidden">
            <div style={{ width: sidebarWidth }} className="flex flex-col shrink-0 border-r border-zinc-200 dark:border-white/5">
                <div className="flex border-b border-zinc-200 dark:border-white/5">
                    <button
                        onClick={() => {
                            setActiveTab('changes');
                            setSelectedFile(null);
                            setFileDiff(null);
                            if (changedFiles.length > 0) fetchUncommitedDiff(changedFiles[0].FileName);
                        }}
                        className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'changes'
                            ? 'text-emerald-500 border-emerald-500 bg-emerald-500/5'
                            : 'text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <FileCode className="w-3.5 h-3.5" />
                        Changes <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-white/10 rounded-full text-[10px]">{changedFiles.length}</span>
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('history');
                            setSelectedFile(null);
                            setFileDiff(null);
                            if (selectedCommit) fetchModifications(selectedCommit.Hash);
                        }}
                        className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'history'
                            ? 'text-emerald-500 border-emerald-500 bg-emerald-500/5'
                            : 'text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        History
                    </button>
                </div>

                {activeTab === 'changes' ? (
                    <ChangesSidebar
                        files={changedFiles}
                        stashes={stashes}
                        onPopStash={handlePopStash}
                        onDropStash={handleDropStash}
                        onStashFileClick={fetchStashedFileDiff}
                        onRefresh={fetchGitStatus}
                        searchTerm={searchTerm}
                        onSearchTermChange={setSearchTerm}
                        selectedFiles={selectedChangedFiles}
                        selectedFile={selectedFile}
                        onFileClick={fetchUncommitedDiff}
                        toggleFileSelection={toggleFileSelection}
                        toggleAllSelection={toggleAllSelection}
                    />
                ) : (
                    <CommitSidebar
                        commits={filteredCommits}
                        selectedCommit={selectedCommit}
                        onSelectCommit={setSelectedCommit}
                        searchTerm={searchTerm}
                        onSearchTermChange={setSearchTerm}
                        onRefresh={() => { setPage(0); fetchCommits(0); }}
                        loadingMore={loadingMore}
                        lastCommitElementRef={lastCommitElementRef}
                    />
                )}
            </div>

            <div
                onMouseDown={startResizingSidebar}
                className={`w-px cursor-col-resize bg-zinc-200 dark:bg-white/5 hover:bg-emerald-500 transition-colors z-10 ${resizingSidebar ? 'bg-emerald-500' : ''}`}
            />
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0a0a0c] overflow-hidden">
                {activeTab === 'changes' ? (
                    changedFiles.length > 0 ? (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="p-4 border-b border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileCode className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                                        {selectedFile || "Selecione um arquivo"}
                                    </h2>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-transparent">
                                {selectedFile ? (
                                    <>
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-black/20 border-b border-zinc-200 dark:border-white/5 shrink-0">
                                            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate mr-4">{selectedFile}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                            <DiffViewer diff={fileDiff} loading={loadingDiff} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center italic">
                                        Selecione um arquivo para ver as mudanças
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                            <div className="p-8 bg-zinc-100 dark:bg-white/5 rounded-full border border-zinc-200 dark:border-white/5">
                                <FileCode className="w-16 h-16 opacity-10" />
                            </div>
                            <p className="text-sm font-medium italic">Nenhuma alteração pendente no momento</p>
                        </div>
                    )
                ) : selectedCommit ? (
                    <>
                        <CommitDetailsHeader commit={selectedCommit} />
                        <div className="flex-1 flex min-h-0 overflow-hidden">
                            <div style={{ width: filesWidth }} className="flex flex-col shrink-0 border-r border-zinc-200 dark:border-white/5 bg-zinc-50/30 dark:bg-black/10">
                                <ModifiedFileList
                                    modifications={modifications}
                                    loadingFiles={loadingFiles}
                                    selectedFile={selectedFile}
                                    onFileClick={(file) => fetchFileDiff(file)}
                                />
                            </div>
                            <div
                                onMouseDown={startResizingFiles}
                                className={`w-px cursor-col-resize bg-zinc-200 dark:bg-white/5 hover:bg-emerald-500 transition-colors z-10 ${resizingFiles ? 'bg-emerald-500' : ''}`}
                            />
                            <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-transparent">
                                {selectedFile ? (
                                    <>
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-black/20 border-b border-zinc-200 dark:border-white/5 shrink-0">
                                            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate mr-4">{selectedFile}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                            <DiffViewer diff={fileDiff} loading={loadingDiff} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center italic">
                                        Selecione um arquivo para ver as mudanças
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                        <div className="p-8 bg-zinc-100 dark:bg-white/5 rounded-full border border-zinc-200 dark:border-white/5">
                            <GitCommit className="w-16 h-16 opacity-10" />
                        </div>
                        <p className="text-sm font-medium italic">Selecione um commit para ver os detalhes</p>
                    </div>
                )}
            </div>
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

                        const status = await GetGitStatus();
                        if (status) {
                            const conflicts = status.filter((f: any) => f.Status.includes('U') || f.Status === 'AA' || f.Status === 'DD').map((f: any) => f.FileName);
                            setConflictingFiles(conflicts);
                            if (conflicts.length === 0) {
                                setShowConflictModal(false);
                                iziToast.success({ title: 'Tudo Limpo', message: 'Todos os conflitos foram resolvidos!', position: 'bottomRight' });
                                fetchGitStatus();
                            }
                        }
                    } catch (err: any) {
                        iziToast.error({ title: 'Erro', message: "Erro ao marcar como resolvido: " + err, position: 'bottomRight' });
                    }
                }}
            />
        </div>
    );
};

export default CommitHistoryPage;
