import React from 'react';

interface DiffViewerProps {
    loading: boolean;
    diff: string | null;
}

interface ParsedDiffLine {
    content: string;
    oldLine?: number;
    newLine?: number;
    type: 'header' | 'addition' | 'deletion' | 'unchanged';
}

const DiffViewer: React.FC<DiffViewerProps> = ({ diff, loading }) => {
    const parseDiff = (diffText: string): ParsedDiffLine[] => {
        const lines = diffText.split('\n');
        const parsed: ParsedDiffLine[] = [];
        let oldLineCounter = 0;
        let newLineCounter = 0;

        lines.forEach(line => {
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
                if (match) {
                    oldLineCounter = parseInt(match[1]);
                    newLineCounter = parseInt(match[2]);
                }
                parsed.push({ content: line, type: 'header' });
            } else if (line.startsWith('-')) {
                parsed.push({ content: line.substring(1), oldLine: oldLineCounter, type: 'deletion' });
                oldLineCounter++;
            } else if (line.startsWith('+')) {
                parsed.push({ content: line.substring(1), newLine: newLineCounter, type: 'addition' });
                newLineCounter++;
            } else {
                parsed.push({ content: line.startsWith(' ') ? line.substring(1) : line, oldLine: oldLineCounter, newLine: newLineCounter, type: 'unchanged' });
                oldLineCounter++;
                newLineCounter++;
            }
        });

        return parsed;
    };

    const renderDiffLine = (line: ParsedDiffLine, index: number) => {
        const { type, content, oldLine, newLine } = line;

        if (type === 'header') {
            return (
                <div key={index} className="flex text-blue-600 dark:text-blue-400 opacity-80 bg-blue-500/5 -mx-4 border-y border-blue-500/10 dark:border-blue-500/20 font-bold">
                    <div className="w-20 shrink-0 border-r border-blue-500/10 flex items-center justify-center text-[9px] select-none">
                        @@
                    </div>
                    <div className="px-4 py-0.5">{content}</div>
                </div>
            );
        }

        const isDeletion = type === 'deletion';
        const isAddition = type === 'addition';
        const isUnchanged = type === 'unchanged';

        let bgColor = '';
        let textColor = 'text-zinc-600 dark:text-zinc-400';
        let prefix = ' ';

        if (isAddition) {
            bgColor = 'bg-emerald-500/10 dark:bg-emerald-500/15';
            textColor = 'text-emerald-700 dark:text-emerald-400';
            prefix = '+';
        } else if (isDeletion) {
            bgColor = 'bg-rose-500/10 dark:bg-rose-500/15';
            textColor = 'text-rose-700 dark:text-rose-400';
            prefix = '-';
        } else if (isUnchanged) {
            textColor = 'text-black dark:text-zinc-300';
        }

        return (
            <div key={index} className={`flex group hover:bg-zinc-100/50 dark:hover:bg-white/5 transition-colors ${bgColor} ${textColor}`}>
                <div className="flex w-20 shrink-0 select-none border-r border-zinc-200 dark:border-white/5 bg-zinc-100/30 dark:bg-black/20 text-[9px] text-zinc-400 font-mono">
                    <div className="w-10 text-center py-1">
                        {oldLine ?? ''}
                    </div>
                    <div className="w-10 text-center py-1 border-l border-zinc-200 dark:border-white/5">
                        {newLine ?? ''}
                    </div>
                </div>
                <div className="px-4 py-1 flex gap-2 min-w-0 flex-1">
                    <span className="opacity-50 w-3 shrink-0">{prefix}</span>
                    <span className="truncate">{content}</span>
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

    if (!diff) return null;

    const parsedLines = parseDiff(diff);

    return (
        <div className="bg-zinc-50 dark:bg-black/40 border-t border-zinc-200 dark:border-white/5 overflow-x-auto">
            <pre className="text-[11px] font-mono leading-relaxed bg-white dark:bg-zinc-950/50">
                {parsedLines.map((line, index) => renderDiffLine(line, index))}
            </pre>
        </div>
    );
};

export default DiffViewer;
