import type { GridEditing } from '../hooks/useGridEdits';
import { startDrag } from '../../../functions/DragFunctions';
import { ArrowDown, ArrowUp, KeyRound, ListChecks } from 'lucide-react';
import { copyToClipboard } from '../../../../shared/functions/clipboard';
import { displayCell, isNumericType, rowsToTsv } from '../../../functions/TreatmentFunctions';
import type { QueryCell, QueryResultSet } from '../../../../../interfaces/PostgresInterfaces';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

const OVERSCAN = 12;
const ROW_HEIGHT = 28;
const INDEX_WIDTH = 56;
const HEADER_HEIGHT = 44;
const MAX_CELL_CHARS = 300;

export interface ResultGridHandle {
  focus: () => void;
  selectRow: (rowRef: number) => void;
}

interface ResultGridProps {
  editing?: GridEditing;
  resultSet: QueryResultSet;
  onDeleteRows?: (rowRefs: number[]) => void;
  onEditCell?: (rowRef: number, column: number) => void;
  onOpenCell: (value: QueryCell, columnIndex: number) => void;
  onSelectionChange?: (rowRefs: number[], column: number | null) => void;
}

type GridSelection = { row: number; column: number | null } | null;

function initialWidths(resultSet: QueryResultSet): number[] {
  const sample = resultSet.rows.slice(0, 200);
  return resultSet.columns.map((column, index) => {
    let characters = Math.max(column.name.length, column.dataType.length);
    for (const row of sample) {
      const value = row[index];
      characters = Math.max(characters, value === null ? 4 : Math.min(value.length, 60));
    }
    return Math.min(420, Math.max(80, Math.round(characters * 7.4 + 28)));
  });
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ResultGrid = forwardRef<ResultGridHandle, ResultGridProps>(
  ({ editing, resultSet, onOpenCell, onEditCell, onDeleteRows, onSelectionChange }, ref) => {
    const anchorRowRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(400);
    const [selection, setSelection] = useState<GridSelection>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
    const [widths, setWidths] = useState<number[]>(() => initialWidths(resultSet));
    const [sort, setSort] = useState<{ column: number; direction: 'asc' | 'desc' } | null>(null);

    const keyColumns = useMemo(() => new Set(resultSet.editable?.keyColumns ?? []), [resultSet]);

    useEffect(() => {
      setWidths(initialWidths(resultSet));
      setSort(null);
      setSelection(null);
      setSelectedRows(new Set());
      setScrollTop(0);
      containerRef.current?.scrollTo({ top: 0, left: 0 });
    }, [resultSet]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const observer = new ResizeObserver(() => setViewportHeight(container.clientHeight));
      observer.observe(container);
      setViewportHeight(container.clientHeight);
      return () => observer.disconnect();
    }, []);

    const sortedRefs = useMemo(() => {
      const refs = resultSet.rows.map((_row, index) => index);
      if (!sort) return refs;
      const numeric = isNumericType(resultSet.columns[sort.column].dataType);
      const factor = sort.direction === 'asc' ? 1 : -1;
      return refs.sort((firstRef, secondRef) => {
        const left = resultSet.rows[firstRef][sort.column];
        const right = resultSet.rows[secondRef][sort.column];
        if (left === right) return 0;
        if (left === null) return 1;
        if (right === null) return -1;
        if (numeric) return (Number(left) - Number(right)) * factor;
        return left.localeCompare(right, 'pt-BR', { numeric: true }) * factor;
      });
    }, [resultSet, sort]);

    const insertedRows = editing?.insertedRows ?? 0;
    const rowRefs = useMemo(
      () => [...sortedRefs, ...Array.from({ length: insertedRows }, (_value, index) => resultSet.rows.length + index)],
      [sortedRefs, insertedRows, resultSet]
    );

    useEffect(() => {
      const existing = new Set(rowRefs);
      setSelectedRows((current) => {
        const kept = [...current].filter((rowRef) => existing.has(rowRef));
        return kept.length === current.size ? current : new Set(kept);
      });
      setSelection((current) => (current && current.row >= rowRefs.length ? null : current));
    }, [rowRefs]);

    const total = rowRefs.length;
    const columnCount = resultSet.columns.length;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(total, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    const tableWidth = INDEX_WIDTH + widths.reduce((sum, width) => sum + width, 0);

    const valueAt = (rowRef: number, column: number): QueryCell | undefined =>
      editing ? editing.valueAt(rowRef, column) : resultSet.rows[rowRef][column];

    const canEdit = (rowRef: number, column: number) =>
      Boolean(editing?.canEditColumn(column) && !editing.isDeleted(rowRef));

    const orderedSelection = (refs: Set<number>) => rowRefs.filter((rowRef) => refs.has(rowRef));

    const select = (next: GridSelection) => {
      setSelection(next);
      if (next) anchorRowRef.current = next.row;
      const rows = next && next.column === null ? new Set([rowRefs[next.row]]) : new Set<number>();
      setSelectedRows(rows);
      onSelectionChange?.(next ? [rowRefs[next.row]] : [], next?.column ?? null);
    };

    const selectRows = (refs: Set<number>, cursorRow: number) => {
      setSelection({ row: cursorRow, column: null });
      setSelectedRows(refs);
      onSelectionChange?.(orderedSelection(refs), null);
    };

    const rangeRefs = (fromRow: number, toRow: number) =>
      new Set(rowRefs.slice(Math.min(fromRow, toRow), Math.max(fromRow, toRow) + 1));

    const allSelected = total > 0 && selection?.column === null && selectedRows.size === total;

    const selectAll = () => {
      if (!total) return;
      anchorRowRef.current = 0;
      selectRows(new Set(rowRefs), selection?.row ?? 0);
      containerRef.current?.focus();
    };

    const clearRowSelection = () => selectRows(new Set(), selection?.row ?? 0);

    const toggleAll = () => {
      if (allSelected) clearRowSelection();
      else selectAll();
      containerRef.current?.focus();
    };

    const handleRowHeaderClick = (event: React.MouseEvent, rowIndex: number) => {
      const rowRef = rowRefs[rowIndex];
      if (event.shiftKey) {
        selectRows(rangeRefs(anchorRowRef.current, rowIndex), rowIndex);
        return;
      }
      const next = new Set(selection?.column === null ? selectedRows : []);
      if (next.has(rowRef)) next.delete(rowRef);
      else next.add(rowRef);
      anchorRowRef.current = rowIndex;
      selectRows(next, rowIndex);
    };

    const scrollToRow = (rowIndex: number) => {
      const container = containerRef.current;
      if (!container) return;
      const top = rowIndex * ROW_HEIGHT;
      const visibleHeight = container.clientHeight - HEADER_HEIGHT;
      if (top < container.scrollTop) container.scrollTop = top;
      else if (top + ROW_HEIGHT > container.scrollTop + visibleHeight)
        container.scrollTop = top + ROW_HEIGHT - visibleHeight;
    };

    useImperativeHandle(ref, () => ({
      focus: () => containerRef.current?.focus(),
      selectRow: (rowRef) => {
        const rowIndex = rowRefs.indexOf(rowRef);
        const index = rowIndex >= 0 ? rowIndex : rowRefs.length;
        const firstEditable = resultSet.columns.findIndex((_column, column) => editing?.canEditColumn(column));
        setSelection({ row: index, column: firstEditable >= 0 ? firstEditable : 0 });
        window.requestAnimationFrame(() => {
          scrollToRow(index);
          containerRef.current?.focus();
        });
      },
    }));

    const toggleSort = (column: number) =>
      setSort((current) => {
        if (!current || current.column !== column) return { column, direction: 'asc' };
        if (current.direction === 'asc') return { column, direction: 'desc' };
        return null;
      });

    const resizeColumn = (event: React.MouseEvent, column: number) => {
      event.stopPropagation();
      const startWidth = widths[column];
      startDrag(event, 'col-resize', (deltaX) =>
        setWidths((current) =>
          current.map((width, index) => (index === column ? Math.max(48, startWidth + deltaX) : width))
        )
      );
    };

    const requestEdit = (row: number, column: number) => {
      const rowRef = rowRefs[row];
      if (!onEditCell || !canEdit(rowRef, column)) return false;
      select({ row, column });
      onEditCell(rowRef, column);
      return true;
    };

    const currentValues = (rowRef: number) => resultSet.columns.map((_column, column) => valueAt(rowRef, column) ?? null);

    const copySelection = () => {
      if (!selection) return;
      if (selection.column !== null) {
        const rowRef = rowRefs[selection.row];
        if (rowRef !== undefined) copyToClipboard(currentValues(rowRef)[selection.column] ?? '', 'Valor copiado');
        return;
      }
      const refs = orderedSelection(selectedRows);
      if (!refs.length) return;
      const multiple = refs.length > 1;
      copyToClipboard(
        rowsToTsv(resultSet, refs.map(currentValues), multiple),
        multiple ? `${refs.length} linhas copiadas` : 'Linha copiada'
      );
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }
      if (event.key === 'Escape' && selection?.column === null && selectedRows.size) {
        event.preventDefault();
        clearRowSelection();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelection();
        return;
      }
      if (!selection || !total) return;
      const rowRef = rowRefs[selection.row];

      if (event.key === 'Delete' && editing) {
        event.preventDefault();
        if (selection.column === null) onDeleteRows?.(orderedSelection(selectedRows));
        else if (canEdit(rowRef, selection.column)) editing.setCell(rowRef, selection.column, null);
        return;
      }

      if (event.shiftKey && selection.column === null && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const row = clamp(selection.row + (event.key === 'ArrowDown' ? 1 : -1), 0, total - 1);
        selectRows(rangeRefs(anchorRowRef.current, row), row);
        scrollToRow(row);
        return;
      }

      if (selection.column !== null) {
        const editableCell = canEdit(rowRef, selection.column);
        if (event.key === 'Enter' && (event.shiftKey || !editableCell)) {
          onOpenCell(valueAt(rowRef, selection.column) ?? null, selection.column);
          return;
        }
        if ((event.key === 'Enter' || event.key === 'F2') && editableCell) {
          event.preventDefault();
          requestEdit(selection.row, selection.column);
          return;
        }
      }

      const pageSize = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1);
      const moves: Record<string, [number, number]> = {
        ArrowDown: [1, 0],
        ArrowUp: [-1, 0],
        ArrowRight: [0, 1],
        ArrowLeft: [0, -1],
        PageDown: [pageSize, 0],
        PageUp: [-pageSize, 0],
      };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      const row = clamp(selection.row + move[0], 0, total - 1);
      const column =
        selection.column === null
          ? move[1] !== 0
            ? 0
            : null
          : clamp(selection.column + move[1], 0, columnCount - 1);
      select({ row, column });
      scrollToRow(row);
    };

    const spacer = (height: number) => (
      <tr aria-hidden>
        <td colSpan={columnCount + 1} style={{ height, padding: 0, border: 0 }} />
      </tr>
    );

    const rowClassName = (rowRef: number, rowSelected: boolean) => {
      if (editing?.isDeleted(rowRef)) return 'bg-rose-500/10 line-through opacity-60';
      if (editing?.isInserted(rowRef)) return rowSelected ? 'bg-emerald-500/20' : 'bg-emerald-500/10';
      return rowSelected ? 'bg-cyan-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]';
    };

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="h-full overflow-auto outline-none relative"
      >
        <table className="border-separate border-spacing-0 text-xs" style={{ width: tableWidth, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: INDEX_WIDTH }} />
            {widths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: HEADER_HEIGHT }}>
              <th
                onClick={toggleAll}
                title={allSelected ? "Desmarcar todas as linhas" : "Selecionar todas as linhas (Ctrl+A)"}
                className={`sticky top-0 left-0 z-30 border-b border-r border-gray-200 dark:border-white/10 cursor-pointer transition-colors ${
                  allSelected
                    ? 'bg-cyan-500/20 dark:bg-cyan-500/25'
                    : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                <ListChecks className={`w-3.5 h-3.5 mx-auto ${allSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400'}`} />
              </th>
              {resultSet.columns.map((column, index) => (
                <th
                  key={index}
                  onClick={() => toggleSort(index)}
                  title={`${column.name} (${column.dataType})${editing && !editing.canEditColumn(index) ? ' — somente leitura' : ''} — clique para ordenar`}
                  className="sticky top-0 z-20 bg-gray-100 dark:bg-zinc-800 border-b border-r border-gray-200 dark:border-white/10 px-2 text-left font-semibold cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {keyColumns.has(index) && <KeyRound className="w-3 h-3 flex-shrink-0 text-amber-500" />}
                    <span
                      className={`truncate ${editing && !editing.canEditColumn(index) ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-800 dark:text-zinc-100'}`}
                    >
                      {column.name}
                    </span>
                    {sort?.column === index &&
                      (sort.direction === 'asc' ? (
                        <ArrowUp className="w-3 h-3 flex-shrink-0 text-cyan-500" />
                      ) : (
                        <ArrowDown className="w-3 h-3 flex-shrink-0 text-cyan-500" />
                      ))}
                  </div>
                  <div className="truncate text-[10px] font-normal text-gray-400 dark:text-zinc-500">{column.dataType}</div>
                  <span
                    onMouseDown={(event) => resizeColumn(event, index)}
                    onClick={(event) => event.stopPropagation()}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-cyan-500/50"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {start > 0 && spacer(start * ROW_HEIGHT)}
            {rowRefs.slice(start, end).map((rowRef, offset) => {
              const rowIndex = start + offset;
              const rowSelected = selection?.column === null && selectedRows.has(rowRef);
              const inserted = editing?.isInserted(rowRef) ?? false;
              return (
                <tr key={rowRef} style={{ height: ROW_HEIGHT }} className={rowClassName(rowRef, rowSelected)}>
                  <td
                    onClick={(event) => handleRowHeaderClick(event, rowIndex)}
                    title="Clique para marcar ou desmarcar a linha · Shift+clique seleciona um intervalo · Esc limpa a seleção"
                    className={`sticky left-0 z-10 border-b border-r border-gray-200 dark:border-white/10 px-2 text-right text-[11px] cursor-pointer tabular-nums select-none ${
                      rowSelected ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300' : 'bg-gray-50 dark:bg-zinc-900 text-gray-400'
                    }`}
                  >
                    {inserted ? <span className="font-bold text-emerald-500">+</span> : rowIndex + 1}
                  </td>
                  {resultSet.columns.map((column, columnIndex) => {
                    const cell = valueAt(rowRef, columnIndex);
                    const selected = selection?.row === rowIndex && selection.column === columnIndex;
                    const modified = editing?.isModified(rowRef, columnIndex) ?? false;
                    const text = cell === undefined ? 'DEFAULT' : displayCell(cell, column.dataType);
                    const muted = cell === null || cell === undefined;
                    return (
                      <td
                        key={columnIndex}
                        onClick={() => select({ row: rowIndex, column: columnIndex })}
                        onDoubleClick={() => {
                          if (!requestEdit(rowIndex, columnIndex)) onOpenCell(cell ?? null, columnIndex);
                        }}
                        className={`border-b border-r border-gray-100 dark:border-white/5 px-2 font-mono whitespace-nowrap overflow-hidden text-ellipsis ${
                          isNumericType(column.dataType) ? 'text-right tabular-nums' : ''
                        } ${muted ? 'italic text-gray-400 dark:text-zinc-600' : 'text-gray-800 dark:text-zinc-200'} ${
                          modified ? 'bg-amber-500/15' : ''
                        } ${selected ? 'outline outline-2 -outline-offset-2 outline-cyan-500 bg-cyan-500/10' : ''}`}
                      >
                        {text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {end < total && spacer((total - end) * ROW_HEIGHT)}
          </tbody>
        </table>
        {total === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 dark:text-zinc-500">A consulta não retornou linhas.</div>
        )}
      </div>
    );
  }
);

ResultGrid.displayName = 'ResultGrid';

export default ResultGrid;
