import React from 'react';
import type { TxStatus } from '../../../../../interfaces/TalpadbInterfaces';
import { FolderOpen, Gauge, ListTree, Loader2, Play, Save, Square } from 'lucide-react';

export const ROW_LIMITS = [100, 500, 1000, 5000, 10000, 50000];

interface QueryToolbarProps {
  running: boolean;
  maxRows: number;
  txStatus: TxStatus | null;
  canAnalyze: boolean;
  onRun: () => void;
  onCancel: () => void;
  onExplain: (analyze: boolean) => void;
  onOpenFile: () => void;
  onSave: () => void;
  onMaxRowsChange: (value: number) => void;
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
  'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

const QueryToolbar: React.FC<QueryToolbarProps> = ({
  running,
  maxRows,
  txStatus,
  canAnalyze,
  onRun,
  onCancel,
  onExplain,
  onOpenFile,
  onSave,
  onMaxRowsChange,
}) => {
  const status = txStatus ? txStatusStyles[txStatus] : null;

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

      <button onClick={onOpenFile} title="Abrir arquivo .sql" className={iconButton}>
        <FolderOpen className="w-4 h-4" />
      </button>
      <button onClick={onSave} title="Salvar em arquivo (Ctrl+S)" className={iconButton}>
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
