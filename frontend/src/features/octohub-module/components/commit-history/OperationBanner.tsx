import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { Dictionary } from '../../../i18n/Languages';
import * as octohubStructs from '../../../../../bindings/docker-manager-go/src/octohub/structs/models';
import { Ban, GitMerge, ListChecks, Play, SkipForward } from 'lucide-react';

interface OperationBannerProps {
    busy: boolean;
    onSkip: () => void;
    onAbort: () => void;
    onContinue: () => void;
    onShowConflicts: () => void;
    operation: octohubStructs.OperationState;
}

const titleKeys: Record<string, keyof Dictionary['octohub']['operations']['titles']> = {
    '': 'none',
    merge: 'merge',
    squash: 'squash',
    rebase: 'rebase',
    revert: 'revert',
    'cherry-pick': 'cherryPick',
};

const buttonClass = 'shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50';

const OperationBanner: React.FC<OperationBannerProps> = ({ operation, busy, onSkip, onAbort, onContinue, onShowConflicts }) => {
    const { dictionary, formatMessage } = useTranslation();
    const operationTexts = dictionary.octohub.operations;
    const conflicts = operation.ConflictingFiles.length;
    const concludesWithCommit = operation.Kind === 'merge' || operation.Kind === 'squash';

    const details = [
        operation.Branch && formatMessage(operation.Kind === 'rebase' ? operationTexts.branchDetail : operationTexts.fromDetail, { branch: operation.Branch }),
        operation.Kind === 'rebase' && operation.Total > 0 && formatMessage(operationTexts.stepDetail, { step: operation.Step, total: operation.Total }),
    ].filter(Boolean).join(' · ');

    const hasOperation = operation.Kind !== '';
    const hint = !hasOperation
        ? formatMessage(conflicts === 1 ? operationTexts.stashConflictsOne : operationTexts.stashConflictsOther, { count: conflicts })
        : conflicts > 0
            ? formatMessage(conflicts === 1 ? operationTexts.conflictsOne : operationTexts.conflictsOther, {
                count: conflicts,
                next: concludesWithCommit ? operationTexts.concludeWithCommit : operationTexts.clickContinue,
            })
            : concludesWithCommit ? operationTexts.noConflictsCommit : operationTexts.noConflictsContinue;
    const titleKey = titleKeys[operation.Kind];

    return (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
            <GitMerge className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0 text-xs">
                <span className="font-bold text-amber-700 dark:text-amber-400">{titleKey ? operationTexts.titles[titleKey] : operationTexts.titles.fallback}</span>
                {details && <span className="text-zinc-600 dark:text-zinc-300"> · {details}</span>}
                <div className="text-[11px] text-zinc-500 truncate" title={hint}>{hint}</div>
            </div>
            {conflicts > 0 && (
                <button onClick={onShowConflicts} disabled={busy} className={`${buttonClass} bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25`}>
                    <ListChecks className="w-3.5 h-3.5" />
                    {operationTexts.showConflicts}
                </button>
            )}
            {hasOperation && !concludesWithCommit && (
                <button onClick={onContinue} disabled={busy} className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}>
                    <Play className="w-3.5 h-3.5" />
                    {operationTexts.continue}
                </button>
            )}
            {operation.Kind === 'rebase' && (
                <button onClick={onSkip} disabled={busy} className={`${buttonClass} bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-white/20`}>
                    <SkipForward className="w-3.5 h-3.5" />
                    {operationTexts.skipCommit}
                </button>
            )}
            {hasOperation && (
                <button onClick={onAbort} disabled={busy} className={`${buttonClass} text-rose-600 dark:text-rose-400 hover:bg-rose-500/10`}>
                    <Ban className="w-3.5 h-3.5" />
                    {operationTexts.abort}
                </button>
            )}
        </div>
    );
};

export default OperationBanner;
