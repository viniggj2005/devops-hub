import React from 'react';
import { Search, RotateCcw, GitCommit } from 'lucide-react';
import { octohubStructs } from '../../../../../wailsjs/go/models';

interface CommitSidebarProps {
    searchTerm: string;
    loadingMore: boolean;
    onRefresh: () => void;
    commits: octohubStructs.Commit[];
    onSearchTermChange: (term: string) => void;
    selectedCommit: octohubStructs.Commit | null;
    onSelectCommit: (commit: octohubStructs.Commit) => void;
    lastCommitElementRef: (node: HTMLDivElement | null) => void;
}

const formatShortDate = (dateString: string) => {
    const cleaned = dateString.replace('Date:', '').trim();
    const parts = cleaned.split(' ');
    if (parts.length >= 4) {
        return `${parts[1]} ${parts[2]}, ${parts[parts.length - 2]}`;
    }
    return cleaned;
};

const CommitSidebar: React.FC<CommitSidebarProps> = ({
    commits,
    onRefresh,
    searchTerm,
    loadingMore,
    selectedCommit,
    onSelectCommit,
    onSearchTermChange,
    lastCommitElementRef
}) => {
    return (
        <div className="w-80 flex flex-col border-r border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-black/40 shrink-0">
            <div className="p-4 border-b border-zinc-200 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Histórico</h2>
                    <button
                        onClick={onRefresh}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                        title="Atualizar"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Filtrar commits..."
                        className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all text-zinc-900 dark:text-white"
                        value={searchTerm}
                        onChange={(event) => onSearchTermChange(event.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {commits.length > 0 ? (
                    <>
                        {commits.map((commit, index) => (
                            <div
                                key={commit.Hash}
                                ref={index === commits.length - 1 ? lastCommitElementRef : null}
                                onClick={() => onSelectCommit(commit)}
                                className={`p-3 cursor-pointer border-b border-zinc-100 dark:border-white/5 transition-all ${selectedCommit?.Hash === commit.Hash
                                    ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                                    : 'hover:bg-zinc-100 dark:hover:bg-white/5 border-l-2 border-l-transparent'
                                    }`}
                            >
                                <div className="flex items-start gap-2.5">
                                    <div className={`p-1.5 rounded-md ${selectedCommit?.Hash === commit.Hash ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                                        <GitCommit className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-xs font-bold truncate pr-2 text-zinc-900 dark:text-white leading-tight">{commit.Title}</h3>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                                <span className="font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[80px]">{commit.Author}</span>
                                                <span>•</span>
                                                <span className="font-mono">{commit.Hash.substring(0, 7)}</span>
                                            </div>
                                            <span className="text-[9px] text-zinc-400 whitespace-nowrap">{formatShortDate(commit.Date)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loadingMore && (
                            <div className="p-4 flex justify-center">
                                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-8 text-center text-zinc-500 italic text-xs">
                        Nenhum commit encontrado.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommitSidebar;
