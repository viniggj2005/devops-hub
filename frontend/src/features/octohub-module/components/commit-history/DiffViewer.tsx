import { Undo2 } from 'lucide-react';
import SelectionCheckbox from './SelectionCheckbox';
import { stateOf } from '../../functions/lineSelection';
import React, { useEffect, useMemo, useRef } from 'react';
import { DiffHunk, DiffLine, parseDiff } from '../../functions/diffParser';

interface DiffViewerProps {
    loading: boolean;
    diff: string | null;
    onDiscardHunk?: (hunk: DiffHunk) => void;
    isLineSelected?: (index: number) => boolean;
    onSetLines?: (indexes: number[], selected: boolean) => void;
}

const lineStyles: Record<string, { row: string; prefix: string }> = {
    context: { row: 'text-black dark:text-zinc-300', prefix: ' ' },
    deletion: { row: 'bg-git-deletion/10 dark:bg-git-deletion/15 text-git-deletion-strong dark:text-git-deletion-soft', prefix: '-' },
    addition: { row: 'bg-git-addition/10 dark:bg-git-addition/15 text-git-addition-strong dark:text-git-addition-soft', prefix: '+' },
};

const DiffViewer: React.FC<DiffViewerProps> = ({ diff, loading, isLineSelected, onSetLines, onDiscardHunk }) => {
    const dragSelection = useRef<boolean | null>(null);
    const lastClickedLine = useRef<number | null>(null);
    const parsed = useMemo(() => parseDiff(diff ?? ''), [diff]);
    const selectable = Boolean(isLineSelected && onSetLines) && parsed.changeIndexes.length > 0;

    useEffect(() => {
        const stopDragging = () => {
            dragSelection.current = null;
        };
        window.addEventListener('mouseup', stopDragging);
        return () => window.removeEventListener('mouseup', stopDragging);
    }, []);

    useEffect(() => {
        lastClickedLine.current = null;
    }, [diff]);

    const startToggle = (event: React.MouseEvent, index: number) => {
        event.preventDefault();
        const selected = !isLineSelected!(index);
        let indexes = [index];
        if (event.shiftKey && lastClickedLine.current !== null) {
            const from = Math.min(lastClickedLine.current, index);
            const to = Math.max(lastClickedLine.current, index);
            indexes = parsed.changeIndexes.filter((lineIndex) => lineIndex >= from && lineIndex <= to);
        }
        lastClickedLine.current = index;
        dragSelection.current = selected;
        onSetLines!(indexes, selected);
    };

    const continueDragging = (index: number) => {
        const selected = dragSelection.current;
        if (selected !== null && isLineSelected!(index) !== selected) onSetLines!([index], selected);
    };

    const toggleHunk = (hunk: DiffHunk) => {
        const allSelected = hunk.changeIndexes.every((index) => isLineSelected!(index));
        onSetLines!(hunk.changeIndexes, !allSelected);
    };

    const gutter = 'sticky left-0 z-[1] flex shrink-0 select-none border-r border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#111113] text-[9px] text-zinc-400 font-mono';

    const renderLine = (line: DiffLine) => {
        if (line.type === 'hunk') {
            const hunk = parsed.hunks[line.hunkIndex];
            const selectedCount = selectable ? hunk.changeIndexes.filter((index) => isLineSelected!(index)).length : 0;
            return (
                <div key={line.index} className="flex text-blue-600 dark:text-blue-400 bg-blue-500/5 border-y border-blue-500/10 dark:border-blue-500/20 font-bold">
                    <div className={gutter}>
                        {selectable && (
                            <button
                                onClick={() => toggleHunk(hunk)}
                                title="Selecionar ou desmarcar todas as linhas deste trecho"
                                className="w-7 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/10"
                            >
                                <SelectionCheckbox size="w-3.5 h-3.5" state={stateOf(selectedCount, hunk.changeIndexes.length)} />
                            </button>
                        )}
                        {onDiscardHunk ? (
                            <button
                                onClick={() => onDiscardHunk(hunk)}
                                title="Descartar as alterações deste trecho"
                                className="w-20 flex items-center justify-center gap-1 font-sans font-bold hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            >
                                <Undo2 className="w-3 h-3" />
                                Descartar
                            </button>
                        ) : (
                            <div className="w-20 flex items-center justify-center">@@</div>
                        )}
                    </div>
                    <div className="px-4 py-0.5 opacity-80 whitespace-pre">{line.content}</div>
                </div>
            );
        }

        if (line.type === 'meta') {
            return (
                <div key={line.index} className="flex text-zinc-400 italic">
                    <div className={gutter}>
                        {selectable && <div className="w-7" />}
                        <div className="w-20" />
                    </div>
                    <div className="px-4 py-0.5 text-[10px]">Sem quebra de linha no final do arquivo</div>
                </div>
            );
        }

        const isChange = line.type !== 'context';
        const selected = !isChange || !selectable || isLineSelected!(line.index);
        const style = lineStyles[line.type];

        return (
            <div key={line.index} className={`flex group ${style.row}`}>
                <div className={gutter}>
                    {selectable && (
                        isChange ? (
                            <div
                                onMouseDown={(event) => startToggle(event, line.index)}
                                onMouseEnter={() => continueDragging(line.index)}
                                title={selected ? 'Esta linha entra no commit (clique para remover)' : 'Esta linha não entra no commit (clique para incluir)'}
                                className="w-7 flex items-center justify-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-white/10"
                            >
                                <SelectionCheckbox size="w-3.5 h-3.5" state={selected ? 'all' : 'none'} />
                            </div>
                        ) : (
                            <div className="w-7" />
                        )
                    )}
                    <div className="w-10 text-center py-1">{line.oldLine ?? ''}</div>
                    <div className="w-10 text-center py-1 border-l border-zinc-200 dark:border-white/5">{line.newLine ?? ''}</div>
                </div>
                <div className={`px-4 py-1 flex gap-2 flex-1 transition-opacity ${selected ? '' : 'opacity-40'}`}>
                    <span className="opacity-50 w-3 shrink-0 select-none">{style.prefix}</span>
                    <span className="whitespace-pre">{line.content}</span>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center gap-2 text-zinc-500 text-xs italic">
                <div className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin"></div>
                Carregando diff...
            </div>
        );
    }

    if (diff === null) return null;

    if (parsed.isBinary || parsed.lines.length === 0) {
        return (
            <div className="p-8 text-center text-zinc-500 text-xs italic">
                {parsed.isBinary ? 'Arquivo binário: o conteúdo não pode ser exibido.' : 'Sem alterações de conteúdo para exibir.'}
            </div>
        );
    }

    return (
        <div className="bg-zinc-50 dark:bg-black/40 border-t border-zinc-200 dark:border-white/5 overflow-x-auto">
            <div className="text-[11px] font-mono leading-relaxed bg-white dark:bg-zinc-950/50 min-w-full w-max" style={{ tabSize: 4 }}>
                {parsed.lines.map(renderLine)}
            </div>
        </div>
    );
};

export default DiffViewer;
