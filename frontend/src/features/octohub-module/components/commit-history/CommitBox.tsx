import React from 'react';
import { Undo2, GitCommitHorizontal } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import * as octohubStructs from '../../../../../bindings/docker-manager-go/src/octohub/structs/models.js';

interface CommitBoxProps {
    summary: string;
    undoing?: boolean;
    committing: boolean;
    description: string;
    onCommit: () => void;
    selectedCount: number;
    branch: string | null;
    disabledReason?: string;
    onUndoCommit?: () => void;
    mode?: 'commit' | 'merge' | 'squash';
    onSummaryChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    undoableCommit?: octohubStructs.UndoableCommit | null;
}

const CommitBox: React.FC<CommitBoxProps> = ({
    branch,
    summary,
    onCommit,
    committing,
    description,
    onUndoCommit,
    selectedCount,
    disabledReason,
    undoableCommit,
    undoing = false,
    mode = 'commit',
    onSummaryChange,
    onDescriptionChange,
}) => {
    const { dictionary, formatMessage } = useTranslation();
    const boxTexts = dictionary.octohub.commitBox;
    const reason = disabledReason
        || (mode === 'commit' && selectedCount === 0 ? boxTexts.selectChange : '')
        || (!summary.trim() ? boxTexts.writeSummary : '');
    const commitFilesLabel = selectedCount === 0
        ? boxTexts.commitOn
        : formatMessage(selectedCount === 1 ? boxTexts.commitFilesOne : boxTexts.commitFilesOther, { count: selectedCount });
    const canCommit = !reason && !committing && !undoing;

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
                placeholder={boxTexts.summaryPlaceholder}
                onChange={(event) => onSummaryChange(event.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white"
            />
            <textarea
                rows={3}
                value={description}
                onKeyDown={onKeyDown}
                placeholder={dictionary.octohub.common.description}
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
                        ? commitFilesLabel
                        : formatMessage(boxTexts.concludeOn, { operation: mode })}
                    <b>{branch || '...'}</b>
                </span>
            </button>
            {reason && <p className="text-[10px] text-center text-zinc-400">{reason}</p>}
            {mode === 'commit' && undoableCommit && onUndoCommit && (
                <div className="pt-2 mt-1 border-t border-zinc-200/80 dark:border-white/5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500">
                            {formatMessage(boxTexts.unpushedCommit, { hash: undoableCommit.ShortHash })}
                        </p>
                        <p
                            title={undoableCommit.Summary}
                            className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate"
                        >
                            {undoableCommit.Summary}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onUndoCommit}
                        disabled={undoing || committing}
                        title={boxTexts.undoHint}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                        {undoing ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Undo2 className="w-3.5 h-3.5" />
                        )}
                        {dictionary.app.common.cancel}
                    </button>
                </div>
            )}
        </div>
    );
};

export default CommitBox;
