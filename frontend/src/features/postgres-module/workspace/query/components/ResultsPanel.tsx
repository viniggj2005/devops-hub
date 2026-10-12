import ResultGrid from './ResultGrid';
import HistoryPanel from './HistoryPanel';
import MessagesPanel from './MessagesPanel';
import React, { useMemo, useState } from 'react';
import CellViewerModal from './CellViewerModal';
import { Braces, Copy, Download } from 'lucide-react';
import { copyToClipboard } from '../../../../shared/functions/clipboard';
import { formatNumber, rowsToTsv } from '../../../functions/TreatmentFunctions';
import type {
  QueryCell,
  QueryColumn,
  QueryExecution,
  QueryHistoryEntry,
} from '../../../../../interfaces/PostgresInterfaces';

export type ResultsPanelTab = 'results' | 'messages' | 'history';

interface ResultsPanelProps {
  panel: ResultsPanelTab;
  running: boolean;
  runError: string | null;
  resultIndex: number;
  history: QueryHistoryEntry[];
  execution: QueryExecution | null;
  errorLocation: { line: number; column: number } | null;
  onPanelChange: (panel: ResultsPanelTab) => void;
  onResultIndexChange: (index: number) => void;
  onLoadHistory: (sql: string) => void;
  onExport: (format: 'csv' | 'json', resultIndex: number) => void;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({
  panel,
  running,
  runError,
  resultIndex,
  history,
  execution,
  errorLocation,
  onPanelChange,
  onResultIndexChange,
  onLoadHistory,
  onExport,
}) => {
  const [cell, setCell] = useState<{ value: QueryCell; column: QueryColumn } | null>(null);
  const gridSets = useMemo(
    () => execution?.resultSets.filter((resultSet) => resultSet.columns.length > 0) ?? [],
    [execution]
  );
  const current = gridSets[resultIndex] ?? null;
  const isPlan = current?.columns.length === 1 && current.columns[0].name === 'QUERY PLAN';
  const hasError = Boolean(execution?.error || runError);
  const hasNotices = Boolean(execution?.notices.length);

  const tabs: { id: ResultsPanelTab; label: string; badge?: React.ReactNode }[] = [
    {
      id: 'results',
      label: 'Resultado',
      badge: current ? formatNumber(current.rowCount) : undefined,
    },
    {
      id: 'messages',
      label: 'Mensagens',
      badge: hasError ? (
        <span className="h-2 w-2 rounded-full bg-rose-500" />
      ) : hasNotices ? (
        <span className="h-2 w-2 rounded-full bg-amber-500" />
      ) : undefined,
    },
    { id: 'history', label: 'Histórico', badge: history.length ? history.length : undefined },
  ];

  const toolButton =
    'flex items-center gap-1.5 h-7 px-2 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors';

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {running && <div className="absolute inset-x-0 top-0 h-0.5 bg-cyan-500 animate-pulse z-10" />}

      <div className="flex items-center gap-1 h-10 px-2 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-950/40 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onPanelChange(tab.id)}
            className={`flex items-center gap-2 h-7 px-3 rounded-lg text-xs font-semibold transition-colors ${
              panel === tab.id
                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined &&
              (typeof tab.badge === 'object' ? (
                tab.badge
              ) : (
                <span className="px-1.5 rounded-full bg-gray-200/80 dark:bg-white/10 text-[10px] tabular-nums">
                  {tab.badge}
                </span>
              ))}
          </button>
        ))}

        {panel === 'results' && current && (
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {gridSets.length > 1 && (
              <select
                value={resultIndex}
                onChange={(event) => onResultIndexChange(Number(event.target.value))}
                className="h-7 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs px-2 outline-none dark:[color-scheme:dark]"
              >
                {gridSets.map((resultSet, index) => (
                  <option key={index} value={index}>
                    Resultado {index + 1} — {resultSet.commandTag}
                  </option>
                ))}
              </select>
            )}
            <span
              className={`text-[11px] truncate ${current.truncated ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}
            >
              {current.truncated
                ? `Exibindo ${formatNumber(current.rows.length)} de ${formatNumber(current.rowCount)} linhas`
                : `${formatNumber(current.rowCount)} ${current.rowCount === 1 ? 'linha' : 'linhas'}`}
            </span>
            <button
              className={toolButton}
              title="Exportar CSV"
              onClick={() => onExport('csv', resultIndex)}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              className={toolButton}
              title="Exportar JSON"
              onClick={() => onExport('json', resultIndex)}
            >
              <Braces className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              className={toolButton}
              title="Copiar tudo (separado por tabulação, pronto para planilhas)"
              onClick={() => copyToClipboard(rowsToTsv(current, current.rows), 'Resultado copiado')}
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {panel === 'results' &&
          (current ? (
            isPlan ? (
              <pre className="h-full overflow-auto p-4 text-xs font-mono text-gray-800 dark:text-zinc-200 whitespace-pre">
                {current.rows.map((row) => row[0]).join('\n')}
              </pre>
            ) : (
              <ResultGrid
                resultSet={current}
                onOpenCell={(value, columnIndex) =>
                  setCell({ value, column: current.columns[columnIndex] })
                }
              />
            )
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-zinc-500 px-4 text-center">
              {execution
                ? 'A consulta não retornou um conjunto de linhas — veja a aba Mensagens.'
                : running
                  ? 'Executando…'
                  : 'Execute uma consulta (Ctrl+Enter ou F5) para ver o resultado.'}
            </div>
          ))}
        {panel === 'messages' && (
          <MessagesPanel execution={execution} runError={runError} errorLocation={errorLocation} />
        )}
        {panel === 'history' && <HistoryPanel entries={history} onLoad={onLoadHistory} />}
      </div>

      <CellViewerModal cell={cell} onClose={() => setCell(null)} />
    </div>
  );
};

export default ResultsPanel;
