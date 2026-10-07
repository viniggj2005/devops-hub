import React from 'react';
import { octohubStructs } from '../../../../../wailsjs/go/models';
import { Ban, GitMerge, ListChecks, Play, SkipForward } from 'lucide-react';

interface OperationBannerProps {
    busy: boolean;
    onSkip: () => void;
    onAbort: () => void;
    onContinue: () => void;
    onShowConflicts: () => void;
    operation: octohubStructs.OperationState;
}

const titles: Record<string, string> = {
    '': 'Conflitos pendentes',
    merge: 'Merge em andamento',
    squash: 'Squash em andamento',
    rebase: 'Rebase em andamento',
    revert: 'Revert em andamento',
    'cherry-pick': 'Cherry-pick em andamento',
};

const buttonClass = 'shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50';

const OperationBanner: React.FC<OperationBannerProps> = ({ operation, busy, onSkip, onAbort, onContinue, onShowConflicts }) => {
    const conflicts = operation.ConflictingFiles.length;
    const concludesWithCommit = operation.Kind === 'merge' || operation.Kind === 'squash';

    const details = [
        operation.Branch && (operation.Kind === 'rebase' ? `branch ${operation.Branch}` : `de ${operation.Branch}`),
        operation.Kind === 'rebase' && operation.Total > 0 && `commit ${operation.Step} de ${operation.Total}`,
    ].filter(Boolean).join(' · ');

    const hasOperation = operation.Kind !== '';
    const hint = !hasOperation
        ? `${conflicts} arquivo${conflicts === 1 ? '' : 's'} em conflito (por exemplo, depois de restaurar um stash). Resolva para poder fazer commit.`
        : conflicts > 0
            ? `${conflicts} arquivo${conflicts === 1 ? '' : 's'} em conflito. Resolva (tire os marcadores <<<<<<< e >>>>>>>) e ${concludesWithCommit ? 'conclua pelo botão de commit à esquerda' : 'clique em Continuar'}.`
            : concludesWithCommit ? 'Sem conflitos pendentes: revise a mensagem e conclua pelo botão de commit à esquerda.' : 'Sem conflitos pendentes: pode continuar.';

    return (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
            <GitMerge className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0 text-xs">
                <span className="font-bold text-amber-700 dark:text-amber-400">{titles[operation.Kind] ?? 'Operação em andamento'}</span>
                {details && <span className="text-zinc-600 dark:text-zinc-300"> · {details}</span>}
                <div className="text-[11px] text-zinc-500 truncate" title={hint}>{hint}</div>
            </div>
            {conflicts > 0 && (
                <button onClick={onShowConflicts} disabled={busy} className={`${buttonClass} bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25`}>
                    <ListChecks className="w-3.5 h-3.5" />
                    Ver conflitos
                </button>
            )}
            {hasOperation && !concludesWithCommit && (
                <button onClick={onContinue} disabled={busy} className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}>
                    <Play className="w-3.5 h-3.5" />
                    Continuar
                </button>
            )}
            {operation.Kind === 'rebase' && (
                <button onClick={onSkip} disabled={busy} className={`${buttonClass} bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-white/20`}>
                    <SkipForward className="w-3.5 h-3.5" />
                    Pular commit
                </button>
            )}
            {hasOperation && (
                <button onClick={onAbort} disabled={busy} className={`${buttonClass} text-rose-600 dark:text-rose-400 hover:bg-rose-500/10`}>
                    <Ban className="w-3.5 h-3.5" />
                    Abortar
                </button>
            )}
        </div>
    );
};

export default OperationBanner;
