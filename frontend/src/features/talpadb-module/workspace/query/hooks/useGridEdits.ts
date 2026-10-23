import { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryCell, QueryResultSet, RowChange, TableChanges } from '../../../../../interfaces/TalpadbInterfaces';

type RowValues = Record<number, QueryCell>;

interface PendingEdits {
  inserted: RowValues[];
  deleted: Record<number, true>;
  updates: Record<number, RowValues>;
}

export interface GridEditing {
  existingRows: number;
  insertedRows: number;
  isDeleted: (rowRef: number) => boolean;
  isInserted: (rowRef: number) => boolean;
  canEditColumn: (column: number) => boolean;
  isModified: (rowRef: number, column: number) => boolean;
  valueAt: (rowRef: number, column: number) => QueryCell | undefined;
  setCell: (rowRef: number, column: number, value: QueryCell) => void;
  resetCell: (rowRef: number, column: number) => void;
}

const emptyEdits = (): PendingEdits => ({ inserted: [], deleted: {}, updates: {} });

export function useGridEdits(resultSet: QueryResultSet | null) {
  const [edits, setEdits] = useState<PendingEdits>(emptyEdits);
  const editable = resultSet?.editable ?? null;
  const existingRows = resultSet?.rows.length ?? 0;

  useEffect(() => setEdits(emptyEdits()), [resultSet]);

  const canEditColumn = useCallback((column: number) => Boolean(editable && editable.columnNumbers[column] > 0), [editable]);

  const setCell = useCallback(
    (rowRef: number, column: number, value: QueryCell) => {
      if (!resultSet) return;
      setEdits((current) => {
        if (rowRef >= existingRows) {
          const inserted = current.inserted.map((row, index) =>
            index === rowRef - existingRows ? { ...row, [column]: value } : row
          );
          return { ...current, inserted };
        }
        const { [column]: _previous, ...otherColumns } = current.updates[rowRef] ?? {};
        const rowValues = resultSet.rows[rowRef][column] === value ? otherColumns : { ...otherColumns, [column]: value };
        const { [rowRef]: _row, ...otherRows } = current.updates;
        const updates = Object.keys(rowValues).length ? { ...otherRows, [rowRef]: rowValues } : otherRows;
        return { ...current, updates };
      });
    },
    [resultSet, existingRows]
  );

  const resetCell = useCallback(
    (rowRef: number, column: number) =>
      setEdits((current) => {
        if (rowRef >= existingRows) {
          const inserted = current.inserted.map((row, index) => {
            if (index !== rowRef - existingRows) return row;
            const { [column]: _removed, ...others } = row;
            return others;
          });
          return { ...current, inserted };
        }
        const { [column]: _removed, ...otherColumns } = current.updates[rowRef] ?? {};
        const { [rowRef]: _row, ...otherRows } = current.updates;
        const updates = Object.keys(otherColumns).length ? { ...otherRows, [rowRef]: otherColumns } : otherRows;
        return { ...current, updates };
      }),
    [existingRows]
  );

  const addRow = useCallback(() => {
    setEdits((current) => ({ ...current, inserted: [...current.inserted, {}] }));
    return existingRows + edits.inserted.length;
  }, [existingRows, edits.inserted.length]);

  const setDeleted = useCallback(
    (rowRefs: number[], deleted: boolean) =>
      setEdits((current) => {
        const removedInserts = new Set(rowRefs.filter((rowRef) => rowRef >= existingRows).map((rowRef) => rowRef - existingRows));
        const inserted =
          deleted && removedInserts.size ? current.inserted.filter((_row, index) => !removedInserts.has(index)) : current.inserted;
        const deletedRows = { ...current.deleted };
        for (const rowRef of rowRefs) {
          if (rowRef >= existingRows) continue;
          if (deleted) deletedRows[rowRef] = true;
          else delete deletedRows[rowRef];
        }
        return { ...current, inserted, deleted: deletedRows };
      }),
    [existingRows]
  );

  const discard = useCallback(() => setEdits(emptyEdits()), []);

  const editing = useMemo<GridEditing>(
    () => ({
      setCell,
      resetCell,
      existingRows,
      canEditColumn,
      insertedRows: edits.inserted.length,
      isInserted: (rowRef) => rowRef >= existingRows,
      isDeleted: (rowRef) => Boolean(edits.deleted[rowRef]),
      isModified: (rowRef, column) =>
        rowRef >= existingRows ? column in edits.inserted[rowRef - existingRows] : column in (edits.updates[rowRef] ?? {}),
      valueAt: (rowRef, column) => {
        if (rowRef >= existingRows) return edits.inserted[rowRef - existingRows]?.[column];
        const updated = edits.updates[rowRef];
        return updated && column in updated ? updated[column] : resultSet?.rows[rowRef][column] ?? null;
      },
    }),
    [setCell, resetCell, existingRows, canEditColumn, edits, resultSet]
  );

  const pendingCount =
    Object.keys(edits.deleted).length +
    edits.inserted.length +
    Object.keys(edits.updates).filter((rowRef) => !edits.deleted[Number(rowRef)]).length;

  const buildChanges = (): TableChanges | null => {
    if (!resultSet || !editable) return null;
    const toCells = (values: RowValues) =>
      Object.entries(values).map(([column, value]) => ({ column: editable.columnNumbers[Number(column)], value }));
    const keyOf = (rowRef: number) =>
      editable.keyColumns.map((column) => ({ column: editable.columnNumbers[column], value: resultSet.rows[rowRef][column] }));

    const updates: RowChange[] = Object.entries(edits.updates)
      .filter(([rowRef]) => !edits.deleted[Number(rowRef)])
      .map(([rowRef, values]) => ({ key: keyOf(Number(rowRef)), values: toCells(values) }));
    const deletes: RowChange[] = Object.keys(edits.deleted).map((rowRef) => ({ key: keyOf(Number(rowRef)), values: [] }));
    const inserts: RowChange[] = edits.inserted.map((values) => ({ key: [], values: toCells(values) }));

    return { tableOid: editable.tableOid, updates, deletes, inserts };
  };

  return { editable, editing, pendingCount, addRow, setDeleted, discard, buildChanges };
}
