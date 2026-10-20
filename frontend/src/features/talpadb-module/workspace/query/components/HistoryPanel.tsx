import React from 'react';
import { CheckCircle2, CircleX, Copy, CornerUpLeft } from 'lucide-react';
import { formatDuration } from '../../../functions/TreatmentFunctions';
import { copyToClipboard } from '../../../../shared/functions/clipboard';
import type { QueryHistoryEntry } from '../../../../../interfaces/TalpadbInterfaces';

interface HistoryPanelProps {
  entries: QueryHistoryEntry[];
  onLoad: (sql: string) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ entries, onLoad }) => {
  if (!entries.length) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
        As consultas executadas nesta aba aparecem aqui.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto divide-y divide-gray-100 dark:divide-white/5">
      {entries.map((entry) => (
        <div key={entry.id} className="group px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs">
            {entry.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <CircleX className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span className="font-medium text-gray-700 dark:text-zinc-200">
              {new Date(entry.executedAt).toLocaleTimeString('pt-BR')}
            </span>
            <span className="text-gray-400">· {formatDuration(entry.durationMs)}</span>
            <span
              className={`truncate ${entry.success ? 'text-gray-500 dark:text-zinc-400' : 'text-rose-600 dark:text-rose-400'}`}
            >
              · {entry.summary}
            </span>
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                title="Copiar SQL"
                onClick={() => copyToClipboard(entry.sql, 'SQL copiado')}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                title="Abrir no editor"
                onClick={() => onLoad(entry.sql)}
                className="p-1 rounded-md text-gray-400 hover:text-cyan-700 hover:bg-cyan-500/10 dark:hover:text-cyan-300"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <pre className="mt-1.5 pl-6 text-[11px] font-mono text-gray-600 dark:text-zinc-400 whitespace-pre-wrap break-all line-clamp-3">
            {entry.sql}
          </pre>
        </div>
      ))}
    </div>
  );
};

export default HistoryPanel;
