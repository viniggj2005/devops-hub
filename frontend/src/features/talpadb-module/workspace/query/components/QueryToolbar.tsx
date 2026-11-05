import React, { useEffect, useState } from 'react';
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

const txStatusStyles: Record<TxStatus, { label: string; className: string } | null> = {
  idle: {
    label: 'Sem transação',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  transaction: {
    label: 'Transação aberta',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  failed: {
    label: 'Transação com erro — execute ROLLBACK',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  },
  closed: { label: 'Desconectado', className: 'bg-gray-500/10 text-gray-500' },
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
          title="Cancelar a consulta em execução"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 shadow shadow-rose-500/20 transition-colors"
        >
          <Square className="w-3.5 h-3.5" fill="currentColor" />
          Cancelar
        </button>
      ) : (
        <button
          onClick={onRun}
          title="Executar (F5 ou Ctrl+Enter). Com texto selecionado, executa só a seleção."
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 shadow shadow-cyan-500/20 transition-opacity"
        >
          <Play className="w-3.5 h-3.5" fill="currentColor" />
          Executar
        </button>
      )}

      <button
        onClick={() => onExplain(false)}
        disabled={running}
        title="Plano de execução (F7)"
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
            ? 'Executa e mede o plano real (Shift+F7) — atenção: a consulta é de fato executada'
            : 'Disponível apenas para PostgreSQL'
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
        title="Abrir aba de variáveis temporárias ($1, $2, ...)"
        className={`${iconButton} ${
          variableCount > 0
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            : ''
        }`}
      >
        <Braces className="w-3.5 h-3.5 text-amber-500" />
        Variáveis
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
            placeholder="Nome da query..."
            className="h-8 w-44 rounded-lg border border-cyan-500/60 bg-white dark:bg-zinc-900 px-2.5 text-xs text-gray-800 dark:text-zinc-100 outline-none"
          />
          <button
            type="submit"
            disabled={savingNamedQuery || !queryNameInput.trim()}
            title="Confirmar e salvar query com variáveis"
            className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setShowSaveInput(false)}
            className="h-8 px-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowSaveInput(true)}
          title="Salvar query e variáveis dando apenas um nome"
          className={iconButton}
        >
          <Bookmark className="w-3.5 h-3.5 text-cyan-500" />
          {savedQueryName ? `Salva: ${savedQueryName}` : 'Salvar Query'}
        </button>
      )}

      {savedQueriesCount > 0 && !showSaveInput && (
        <button
          type="button"
          onClick={onOpenSavedQueries}
          title="Ver queries salvas desta conexão"
          className={iconButton}
        >
          Salvas
          <span className="px-1.5 py-0.5 rounded-full bg-gray-200/80 dark:bg-white/10 text-[10px] tabular-nums">
            {savedQueriesCount}
          </span>
        </button>
      )}

      <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

      <button onClick={onOpenFile} title="Abrir arquivo .sql" className={iconButton}>
        <FolderOpen className="w-4 h-4" />
      </button>
      <button onClick={onSave} title="Salvar em arquivo .sql (Ctrl+S)" className={iconButton}>
        <Save className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">
        Limite
        <select
          value={maxRows}
          onChange={(event) => onMaxRowsChange(Number(event.target.value))}
          title="Máximo de linhas exibidas por resultado (as demais são contadas, mas não carregadas)"
          className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs px-2 outline-none focus:border-cyan-500 dark:[color-scheme:dark]"
        >
          {ROW_LIMITS.map((limit) => (
            <option key={limit} value={limit}>
              {limit.toLocaleString('pt-BR')} linhas
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
            {status.label}
          </span>
        )}
      </div>
    </div>
  );
};

export default QueryToolbar;
