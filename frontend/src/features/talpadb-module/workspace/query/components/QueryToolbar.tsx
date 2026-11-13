import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import type { TxStatus } from '../../../../../interfaces/TalpadbInterfaces';
import {
  Play,
  Save,
  Gauge,
  Check,
  Braces,
  Square,
  Loader2,
  Bookmark,
  ListTree,
  FolderOpen,
} from 'lucide-react';

export const ROW_LIMITS = [100, 500, 1000, 5000, 10000, 50000];

interface QueryToolbarProps {
  running: boolean;
  maxRows: number;
  canAnalyze: boolean;
  variableCount: number;
  savedQueryName: string;
  txStatus: TxStatus | null;
  savingNamedQuery: boolean;
  savedQueriesCount: number;
  onRun: () => void;
  onSave: () => void;
  onCancel: () => void;
  onOpenFile: () => void;
  onOpenVariables: () => void;
  onOpenSavedQueries: () => void;
  onExplain: (analyze: boolean) => void;
  onMaxRowsChange: (value: number) => void;
  onSaveNamedQuery: (name: string) => void;
}

type TxStatusLabel = Exclude<TxStatus, 'unknown'>;

const txStatusStyles: Record<TxStatus, { labelKey: TxStatusLabel; className: string } | null> = {
  idle: {
    labelKey: 'idle',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  transaction: {
    labelKey: 'transaction',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  failed: {
    labelKey: 'failed',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  },
  closed: { labelKey: 'closed', className: 'bg-gray-500/10 text-gray-500' },
  unknown: null,
};

const iconButton =
  'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap';

const QueryToolbar: React.FC<QueryToolbarProps> = ({
  onRun,
  onSave,
  running,
  maxRows,
  txStatus,
  onCancel,
  onExplain,
  canAnalyze,
  onOpenFile,
  variableCount,
  savedQueryName,
  onOpenVariables,
  onMaxRowsChange,
  savingNamedQuery,
  onSaveNamedQuery,
  savedQueriesCount,
  onOpenSavedQueries,
}) => {
  const [showSaveInput, setShowSaveInput] = useState(false);
  const { dictionary, formatMessage, language } = useTranslation();
  const toolbarTexts = dictionary.talpadb.toolbar;
  const [queryNameInput, setQueryNameInput] = useState(savedQueryName);
  const status = txStatus ? txStatusStyles[txStatus] : null;

  useEffect(() => {
    setQueryNameInput(savedQueryName);
  }, [savedQueryName]);

  const handleConfirmSaveName = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = queryNameInput.trim();
    if (!trimmedName) return;
    onSaveNamedQuery(trimmedName);
    setShowSaveInput(false);
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-200 dark:border-white/5 flex-shrink-0 overflow-x-auto">
      {running ? (
        <button
          onClick={onCancel}
          title={toolbarTexts.cancelHint}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 shadow shadow-rose-500/20 transition-colors"
        >
          <Square className="w-3.5 h-3.5" fill="currentColor" />
          {dictionary.app.common.cancel}
        </button>
      ) : (
        <button
          onClick={onRun}
          title={toolbarTexts.runHint}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 shadow shadow-cyan-500/20 transition-opacity"
        >
          <Play className="w-3.5 h-3.5" fill="currentColor" />
          {toolbarTexts.run}
        </button>
      )}

      <button
        onClick={() => onExplain(false)}
        disabled={running}
        title={toolbarTexts.explainHint}
        className={iconButton}
      >
        <ListTree className="w-4 h-4" />
        Explain
      </button>
      <button
        onClick={() => onExplain(true)}
        disabled={running || !canAnalyze}
        title={
          canAnalyze
            ? toolbarTexts.analyzeHint
            : toolbarTexts.analyzeUnavailable
        }
        className={iconButton}
      >
        <Gauge className="w-4 h-4" />
        Analyze
      </button>

      <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

      <button
        type="button"
        onClick={onOpenVariables}
        title={toolbarTexts.variablesHint}
        className={`${iconButton} ${
          variableCount > 0
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            : ''
        }`}
      >
        <Braces className="w-3.5 h-3.5 text-amber-500" />
        {toolbarTexts.variables}
        {variableCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-mono font-bold">
            {variableCount}
          </span>
        )}
      </button>

      {showSaveInput ? (
        <form onSubmit={handleConfirmSaveName} className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={queryNameInput}
            onChange={(event) => setQueryNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setShowSaveInput(false);
              }
            }}
            placeholder={toolbarTexts.queryNamePlaceholder}
            className="h-8 w-44 rounded-lg border border-cyan-500/60 bg-white dark:bg-zinc-900 px-2.5 text-xs text-gray-800 dark:text-zinc-100 outline-none"
          />
          <button
            type="submit"
            disabled={savingNamedQuery || !queryNameInput.trim()}
            title={toolbarTexts.confirmSaveHint}
            className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {dictionary.talpadb.common.save}
          </button>
          <button
            type="button"
            onClick={() => setShowSaveInput(false)}
            className="h-8 px-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            {dictionary.app.common.cancel}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowSaveInput(true)}
          title={toolbarTexts.saveHint}
          className={iconButton}
        >
          <Bookmark className="w-3.5 h-3.5 text-cyan-500" />
          {savedQueryName ? formatMessage(toolbarTexts.savedAs, { name: savedQueryName }) : toolbarTexts.saveQuery}
        </button>
      )}

      {savedQueriesCount > 0 && !showSaveInput && (
        <button
          type="button"
          onClick={onOpenSavedQueries}
          title={toolbarTexts.savedQueriesHint}
          className={iconButton}
        >
          {toolbarTexts.saved}
          <span className="px-1.5 py-0.5 rounded-full bg-gray-200/80 dark:bg-white/10 text-[10px] tabular-nums">
            {savedQueriesCount}
          </span>
        </button>
      )}

      <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

      <button onClick={onOpenFile} title={toolbarTexts.openFile} className={iconButton}>
        <FolderOpen className="w-4 h-4" />
      </button>
      <button onClick={onSave} title={toolbarTexts.saveFile} className={iconButton}>
        <Save className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">
        {toolbarTexts.limit}
        <select
          value={maxRows}
          onChange={(event) => onMaxRowsChange(Number(event.target.value))}
          title={toolbarTexts.limitHint}
          className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs px-2 outline-none focus:border-cyan-500 dark:[color-scheme:dark]"
        >
          {ROW_LIMITS.map((limit) => (
            <option key={limit} value={limit}>
              {formatMessage(toolbarTexts.rowsOption, { count: limit.toLocaleString(language) })}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-2 pl-2">
        {running && <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />}
        {status && (
          <span
            className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.className}`}
          >
            {toolbarTexts.txStatus[status.labelKey]}
          </span>
        )}
      </div>
    </div>
  );
};

export default QueryToolbar;
