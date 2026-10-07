export type DiffLineType = 'hunk' | 'context' | 'addition' | 'deletion' | 'meta';

export interface DiffLine {
    index: number;
    content: string;
    oldLine?: number;
    newLine?: number;
    hunkIndex: number;
    type: DiffLineType;
}

export interface DiffHunk {
    header: string;
    changeIndexes: number[];
}

export interface ParsedDiff {
    lines: DiffLine[];
    hunks: DiffHunk[];
    isBinary: boolean;
    isNewFile: boolean;
    isDeletedFile: boolean;
    changeIndexes: number[];
}

const hunkHeaderRegex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiff(diff: string): ParsedDiff {
    const parsed: ParsedDiff = { lines: [], hunks: [], changeIndexes: [], isBinary: false, isNewFile: false, isDeletedFile: false };
    let inHunk = false;
    let oldLine = 0;
    let newLine = 0;

    diff.split('\n').forEach((rawLine, index) => {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

        if (line.startsWith('diff ')) {
            inHunk = false;
            return;
        }

        const hunkMatch = hunkHeaderRegex.exec(line);
        if (hunkMatch) {
            inHunk = true;
            oldLine = Number(hunkMatch[1]);
            newLine = Number(hunkMatch[2]);
            parsed.hunks.push({ header: line, changeIndexes: [] });
            parsed.lines.push({ index, type: 'hunk', content: line, hunkIndex: parsed.hunks.length - 1 });
            return;
        }

        if (!inHunk) {
            if (line.startsWith('Binary files') || line === 'GIT binary patch') parsed.isBinary = true;
            if (line.startsWith('new file mode')) parsed.isNewFile = true;
            if (line.startsWith('deleted file mode')) parsed.isDeletedFile = true;
            return;
        }

        const hunkIndex = parsed.hunks.length - 1;
        switch (line[0]) {
            case '+':
                parsed.lines.push({ index, type: 'addition', content: line.slice(1), newLine: newLine++, hunkIndex });
                parsed.hunks[hunkIndex].changeIndexes.push(index);
                parsed.changeIndexes.push(index);
                break;
            case '-':
                parsed.lines.push({ index, type: 'deletion', content: line.slice(1), oldLine: oldLine++, hunkIndex });
                parsed.hunks[hunkIndex].changeIndexes.push(index);
                parsed.changeIndexes.push(index);
                break;
            case ' ':
                parsed.lines.push({ index, type: 'context', content: line.slice(1), oldLine: oldLine++, newLine: newLine++, hunkIndex });
                break;
            case '\\':
                parsed.lines.push({ index, type: 'meta', content: line, hunkIndex });
                break;
        }
    });

    return parsed;
}
