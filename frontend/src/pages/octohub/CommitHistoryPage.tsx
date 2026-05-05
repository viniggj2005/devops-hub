import { GitCommit } from 'lucide-react';
import { octohubStructs } from '../../../wailsjs/go/models';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import CommitSidebar from '../../features/octohub-module/components/commit-history/CommitSidebar';
import ModifiedFileList from '../../features/octohub-module/components/commit-history/ModifiedFileList';
import CommitDetailsHeader from '../../features/octohub-module/components/commit-history/CommitDetailsHeader';
import { ListCommits, GetCommitModifications, GetCommitedFileChanges } from '../../../wailsjs/go/octohubHandlers/GitHandler';

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
    const [commits, setCommits] = useState<octohubStructs.Commit[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [selectedCommit, setSelectedCommit] = useState<octohubStructs.Commit | null>(null);
    const [modifications, setModifications] = useState<octohubStructs.FileModification[]>([]);

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

    useEffect(() => {
        fetchCommits(0);
    }, []);

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
            setModifications(mods || []);
        } catch (err: any) {
            console.error("Erro ao buscar modificações:", err);
            setModifications([]);
        } finally {
            setLoadingFiles(false);
        }
    };

    const fetchFileDiff = async (filePath: string) => {
        if (!selectedCommit) return;

        if (selectedFile === filePath) {
            setSelectedFile(null);
            return;
        }

        setLoadingDiff(true);
        setSelectedFile(filePath);
        try {
            const diff = await GetCommitedFileChanges(selectedCommit.Hash, filePath);
            setFileDiff(diff);
        } catch (err: any) {
            console.error("Erro ao buscar diff:", err);
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
        <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-white/5 overflow-hidden">
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

            <div className="flex-1 flex flex-col bg-zinc-50/30 dark:bg-transparent overflow-hidden">
                {selectedCommit ? (
                    <>
                        <CommitDetailsHeader commit={selectedCommit} />
                        <ModifiedFileList
                            modifications={modifications}
                            loadingFiles={loadingFiles}
                            selectedFile={selectedFile}
                            onFileClick={fetchFileDiff}
                            fileDiff={fileDiff}
                            loadingDiff={loadingDiff}
                        />
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
        </div>
    );
};

export default CommitHistoryPage;
