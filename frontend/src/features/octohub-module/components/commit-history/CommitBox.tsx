import React from 'react';
import { GitCommitHorizontal } from 'lucide-react';

interface CommitBoxProps {
    summary: string;
    committing: boolean;
    description: string;
    onCommit: () => void;
    selectedCount: number;
    branch: string | null;
    disabledReason?: string;
    mode?: 'commit' | 'merge' | 'squash';
    onSummaryChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
}

const CommitBox: React.FC<CommitBoxProps> = ({
    branch,
    summary,
    onCommit,
    committing,
    description,
    selectedCount,
    disabledReason,
    mode = 'commit',
    onSummaryChange,
    onDescriptionChange,
}) => {
    const reason = disabledReason
        || (mode === 'commit' && selectedCount === 0 ? 'Selecione ao menos uma alteração' : '')
        || (!summary.trim() ? 'Escreva um resumo para o commit' : '');
    const canCommit = !reason && !committing;

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && canCommit) {
            event.preventDefault();
            onCommit();
        }
    };

    return (
        <div className="shrink-0 p-3 border-t border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-900/60 space-y-2">
            <input
                type="text"
                value={summary}
                onKeyDown={onKeyDown}
                placeholder="Resumo (obrigatório)"
                onChange={(event) => onSummaryChange(event.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white"
            />
            <textarea
                rows={3}
                value={description}
                onKeyDown={onKeyDown}
                placeholder="Descrição"
                onChange={(event) => onDescriptionChange(event.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white"
            />
            <button
                onClick={onCommit}
                disabled={!canCommit}
                title={reason || 'Ctrl+Enter'}
                className="w-full py-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
                {committing ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <GitCommitHorizontal className="w-4 h-4" />
                )}
                <span className="truncate">
                    {mode === 'commit'
                        ? `Commit ${selectedCount > 0 ? `de ${selectedCount} arquivo${selectedCount > 1 ? 's' : ''} ` : ''}em `
                        : `Concluir ${mode} em `}
                    <b>{branch || '...'}</b>
                </span>
            </button>
            {reason && <p className="text-[10px] text-center text-zinc-400">{reason}</p>}
        </div>
    );
};

export default CommitBox;
