import React from 'react';
import { Hash, User, Calendar } from 'lucide-react';
import { octohubStructs } from '../../../../../wailsjs/go/models';

interface CommitDetailsHeaderProps {
    commit: octohubStructs.Commit;
}

const getRelativeTime = (dateString: string) => {
    return dateString.replace('Date:', '').trim();
};

const CommitDetailsHeader: React.FC<CommitDetailsHeaderProps> = ({ commit }) => {
    return (
        <div className="p-6 border-b border-zinc-200 dark:border-white/5 bg-white/50 dark:bg-transparent backdrop-blur-md">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{commit.Title}</h1>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-md border border-zinc-200 dark:border-white/10 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                    <Hash className="w-3 h-3" />
                    {commit.Hash}
                </div>
            </div>

            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                        <User className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Autor</p>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{commit.Author}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                        <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Data</p>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{getRelativeTime(commit.Date)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommitDetailsHeader;
