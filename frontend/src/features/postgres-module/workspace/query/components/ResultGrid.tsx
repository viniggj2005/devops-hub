import { ArrowDown, ArrowUp } from 'lucide-react';
import { startDrag } from '../../../functions/DragFunctions';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '../../../../shared/functions/clipboard';
import { displayCell, isNumericType, rowsToTsv } from '../../../functions/TreatmentFunctions';
import type { QueryCell, QueryResultSet } from '../../../../../interfaces/PostgresInterfaces';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 44;
const OVERSCAN = 12;
const INDEX_WIDTH = 56;
const MAX_CELL_CHARS = 300;

interface ResultGridProps {
  resultSet: QueryResultSet;
  onOpenCell: (value: QueryCell, columnIndex: number) => void;
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

const ResultGrid: React.FC<ResultGridProps> = ({ resultSet, onOpenCell }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [selection, setSelection] = useState<GridSelection>(null);
  const [widths, setWidths] = useState<number[]>(() => initialWidths(resultSet));
  const [sort, setSort] = useState<{ column: number; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    setWidths(initialWidths(resultSet));
    setSort(null);
    setSelection(null);
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

  const rows = useMemo(() => {
    if (!sort) return resultSet.rows;
    const numeric = isNumericType(resultSet.columns[sort.column].dataType);
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...resultSet.rows].sort((first, second) => {
      const left = first[sort.column];
      const right = second[sort.column];
      if (left === right) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      if (numeric) return (Number(left) - Number(right)) * factor;
      return left.localeCompare(right, 'pt-BR', { numeric: true }) * factor;
    });
  }, [resultSet, sort]);

  const total = rows.length;
  const columnCount = resultSet.columns.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const tableWidth = INDEX_WIDTH + widths.reduce((sum, width) => sum + width, 0);

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
        current.map((width, index) =>
          index === column ? Math.max(48, startWidth + deltaX) : width
        )
      )
    );
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

  const copySelection = () => {
    if (!selection) return;
    const row = rows[selection.row];
    if (!row) return;
    if (selection.column === null)
      copyToClipboard(rowsToTsv(resultSet, [row], false), 'Linha copiada');
    else copyToClipboard(row[selection.column] ?? '', 'Valor copiado');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copySelection();
      return;
    }
    if (!selection || !total) return;

    if (event.key === 'Enter' && selection.column !== null) {
      onOpenCell(rows[selection.row][selection.column], selection.column);
      return;
    }

    const moves: Record<string, [number, number]> = {
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      PageDown: [Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1), 0],
      PageUp: [-Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1), 0],
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
    setSelection({ row, column });
    scrollToRow(row);
  };

  const spacer = (height: number) => (
    <tr aria-hidden>
      <td colSpan={columnCount + 1} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className="h-full overflow-auto outline-none relative"
    >
      <table
        className="border-separate border-spacing-0 text-xs"
        style={{ width: tableWidth, tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: INDEX_WIDTH }} />
          {widths.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ height: HEADER_HEIGHT }}>
            <th className="sticky top-0 left-0 z-30 bg-gray-100 dark:bg-zinc-800 border-b border-r border-gray-200 dark:border-white/10" />
            {resultSet.columns.map((column, index) => (
              <th
                key={index}
                onClick={() => toggleSort(index)}
                title={`${column.name} (${column.dataType}) — clique para ordenar`}
                className="sticky top-0 z-20 bg-gray-100 dark:bg-zinc-800 border-b border-r border-gray-200 dark:border-white/10 px-2 text-left font-semibold cursor-pointer select-none"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span className="truncate text-gray-800 dark:text-zinc-100">{column.name}</span>
                  {sort?.column === index &&
                    (sort.direction === 'asc' ? (
                      <ArrowUp className="w-3 h-3 flex-shrink-0 text-cyan-500" />
                    ) : (
                      <ArrowDown className="w-3 h-3 flex-shrink-0 text-cyan-500" />
                    ))}
                </div>
                <div className="truncate text-[10px] font-normal text-gray-400 dark:text-zinc-500">
                  {column.dataType}
                </div>
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
          {rows.slice(start, end).map((row, offset) => {
            const rowIndex = start + offset;
            const rowSelected = selection?.row === rowIndex && selection.column === null;
            return (
              <tr
                key={rowIndex}
                style={{ height: ROW_HEIGHT }}
                className={
                  rowSelected ? 'bg-cyan-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                }
              >
                <td
                  onClick={() => setSelection({ row: rowIndex, column: null })}
                  className="sticky left-0 z-10 bg-gray-50 dark:bg-zinc-900 border-b border-r border-gray-200 dark:border-white/10 px-2 text-right text-[11px] text-gray-400 cursor-pointer tabular-nums"
                >
                  {rowIndex + 1}
                </td>
                {row.map((cell, columnIndex) => {
                  const column = resultSet.columns[columnIndex];
                  const selected = selection?.row === rowIndex && selection.column === columnIndex;
                  const text = displayCell(cell, column.dataType);
                  return (
                    <td
                      key={columnIndex}
                      onClick={() => setSelection({ row: rowIndex, column: columnIndex })}
                      onDoubleClick={() => onOpenCell(cell, columnIndex)}
                      className={`border-b border-r border-gray-100 dark:border-white/5 px-2 font-mono whitespace-nowrap overflow-hidden text-ellipsis ${
                        isNumericType(column.dataType) ? 'text-right tabular-nums' : ''
                      } ${cell === null ? 'italic text-gray-400 dark:text-zinc-600' : 'text-gray-800 dark:text-zinc-200'} ${
                        selected
                          ? 'outline outline-2 -outline-offset-2 outline-cyan-500 bg-cyan-500/10'
                          : ''
                      }`}
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
        <div className="px-4 py-6 text-sm text-gray-400 dark:text-zinc-500">
          A consulta não retornou linhas.
        </div>
      )}
    </div>
  );
};

export default ResultGrid;
