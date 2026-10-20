import iziToast from 'izitoast';
import MergeBranchModal from '../MergeBranchModal';
import { escapeHtml } from '../../functions/gitStatus';
import { useDismiss } from '../../../shared/hooks/useDismiss';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import * as octohubStructs from '../../../../../bindings/docker-manager-go/src/octohub/structs/models';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, GitBranch, GitCompare, GitMerge, Search, X } from 'lucide-react';
import { ListBranches } from '../../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';
import { CompareBranch } from '../../../../../bindings/docker-manager-go/src/octohub/handlers/gitcommitshandler';

export type CompareDirection = 'behind' | 'ahead';

interface BranchCompareBarProps {
    revision: number;
    branch: string | null;
    currentBranch: string | null;
    direction: CompareDirection;
    onBranchChange: (branch: string | null) => void;
    onDirectionChange: (direction: CompareDirection) => void;
}

const BranchCompareBar: React.FC<BranchCompareBarProps> = ({
    branch,
    revision,
    direction,
    currentBranch,
    onBranchChange,
    onDirectionChange,
}) => {
    const [filter, setFilter] = useState('');
    const pickerRef = useRef<HTMLDivElement>(null);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [branches, setBranches] = useState<octohubStructs.BranchInfo[]>([]);
    const [comparison, setComparison] = useState<octohubStructs.BranchComparison | null>(null);

    const currentLabel = currentBranch === 'HEAD' ? 'HEAD destacado' : currentBranch || '';

    useDismiss(pickerRef, pickerOpen, () => setPickerOpen(false));

    useEffect(() => {
        if (!pickerOpen) return;
        setFilter('');
        ListBranches()
            .then((list) => setBranches((list || []).filter((item) => !item.IsCurrent)))
            .catch((error) => iziToast.error({ title: 'Erro', message: escapeHtml(errorMessage(error)), position: 'bottomRight' }));
    }, [pickerOpen]);

    useEffect(() => {
        if (!branch) {
            setComparison(null);
            return;
        }
        let cancelled = false;
        CompareBranch(branch)
            .then((result) => !cancelled && setComparison(result))
            .catch((error) => {
                if (cancelled) return;
                iziToast.error({ title: 'Erro', message: escapeHtml(`Não foi possível comparar com ${branch}: ${errorMessage(error)}`), position: 'bottomRight' });
                onBranchChange(null);
            });
        return () => {
            cancelled = true;
        };
    }, [branch, revision]);

    const query = filter.trim().toLowerCase();
    const filteredBranches = useMemo(
        () => branches.filter((item) => item.Name.toLowerCase().includes(query)),
        [branches, query]
    );

    const selectBranch = (name: string) => {
        setPickerOpen(false);
        onDirectionChange('behind');
        onBranchChange(name);
    };

    const tabClass = (tab: CompareDirection) => `flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${direction === tab
        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`;

    if (!branch) {
        return (
            <div ref={pickerRef} className="relative">
                <button
                    onClick={() => setPickerOpen((open) => !open)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-lg text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                    <GitCompare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Comparar com outra branch...</span>
                </button>
                {pickerOpen && (
                    <>
                        <div className="absolute left-0 right-0 mt-1 z-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-zinc-200 dark:border-white/5 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={filter}
                                    placeholder="Filtrar branches..."
                                    onChange={(event) => setFilter(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') setPickerOpen(false);
                                        if (event.key === 'Enter' && filteredBranches[0]) selectBranch(filteredBranches[0].Name);
                                    }}
                                    className="w-full pl-7 pr-2 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-zinc-900 dark:text-white"
                                />
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                                {filteredBranches.length > 0 ? filteredBranches.map((item) => (
                                    <button
                                        key={item.Name}
                                        onClick={() => selectBranch(item.Name)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
                                    >
                                        {item.IsRemote
                                            ? <Cloud className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                                            : <GitBranch className="w-3.5 h-3.5 shrink-0 text-zinc-400" />}
                                        <span className="truncate">{item.Name}</span>
                                    </button>
                                )) : (
                                    <div className="px-3 py-4 text-center text-xs italic text-zinc-400">Nenhuma branch encontrada.</div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <GitCompare className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span className="flex-1 min-w-0 text-xs text-zinc-700 dark:text-zinc-300 truncate" title={branch}>
                    <span className="font-bold">{branch}</span>
                </span>
                <button
                    title="Parar de comparar"
                    onClick={() => onBranchChange(null)}
                    className="p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="flex gap-1 p-0.5 bg-zinc-200/60 dark:bg-white/5 rounded-lg">
                <button
                    className={tabClass('behind')}
                    onClick={() => onDirectionChange('behind')}
                    title={`Commits de ${branch} que ainda não estão em ${currentLabel}`}
                >
                    Atrás ({comparison?.Behind ?? '…'})
                </button>
                <button
                    className={tabClass('ahead')}
                    onClick={() => onDirectionChange('ahead')}
                    title={`Commits de ${currentLabel} que não estão em ${branch}`}
                >
                    À frente ({comparison?.Ahead ?? '…'})
                </button>
            </div>
            {direction === 'behind' && (comparison?.Behind ?? 0) > 0 && currentBranch !== 'HEAD' && (
                <button
                    onClick={() => setMergeOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                >
                    <GitMerge className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Merge de {branch} em {currentLabel}</span>
                </button>
            )}
            <MergeBranchModal open={mergeOpen} initialBranch={branch} onClose={() => setMergeOpen(false)} />
        </div>
    );
};

export default BranchCompareBar;
