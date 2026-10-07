export type FileSelection =
    | { kind: 'all' }
    | { kind: 'none' }
    | { kind: 'partial'; diffHash: string; lines: number[] };

export type SelectionState = FileSelection['kind'];

export const ALL_SELECTED: FileSelection = { kind: 'all' };
export const NONE_SELECTED: FileSelection = { kind: 'none' };

export function selectedLineSet(selection: FileSelection, changeIndexes: number[]): Set<number> {
    if (selection.kind === 'all') return new Set(changeIndexes);
    if (selection.kind === 'none') return new Set();
    return new Set(selection.lines);
}

export function setLines(
    diffHash: string,
    indexes: number[],
    selected: boolean,
    changeIndexes: number[],
    selection: FileSelection,
): FileSelection {
    const lines = selectedLineSet(selection, changeIndexes);
    indexes.forEach((index) => (selected ? lines.add(index) : lines.delete(index)));

    if (lines.size === changeIndexes.length) return ALL_SELECTED;
    if (lines.size === 0) return NONE_SELECTED;
    return { kind: 'partial', diffHash, lines: changeIndexes.filter((index) => lines.has(index)) };
}

export function stateOf(selectedCount: number, total: number): SelectionState {
    if (selectedCount === 0) return 'none';
    return selectedCount === total ? 'all' : 'partial';
}
