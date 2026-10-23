import React from 'react';
import { AlertTriangle, Loader2, Send } from 'lucide-react';
import { secondaryButtonClass } from '../editors/FormStyles';
import type { HeaderEntry } from '../../../../interfaces/VulpesInterfaces';

export const ResponseLoading: React.FC<{ label: string; onCancel?: () => void }> = ({ label, onCancel }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-zinc-400">
    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
    <span className="text-xs font-semibold">{label}</span>
    {onCancel && (
      <button type="button" onClick={onCancel} className={secondaryButtonClass}>
        Cancelar
      </button>
    )}
  </div>
);

export const ResponseError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex-1 overflow-auto p-4">
    <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-rose-600 dark:text-rose-400">Não foi possível concluir</p>
        <p className="text-xs text-rose-700/90 dark:text-rose-300/90 whitespace-pre-wrap break-words mt-1">{message}</p>
      </div>
    </div>
  </div>
);

export const ResponseEmpty: React.FC<{ hint: string }> = ({ hint }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
      <Send className="w-5 h-5 text-amber-500" />
    </div>
    <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-xs">{hint}</p>
  </div>
);

export const HeadersTable: React.FC<{ headers: HeaderEntry[]; emptyLabel: string }> = ({ headers, emptyLabel }) => {
  if (!headers.length) return <p className="p-4 text-xs text-gray-500 dark:text-zinc-400">{emptyLabel}</p>;
  return (
    <table className="w-full text-xs">
      <tbody>
        {headers.map((header, index) => (
          <tr key={`${header.key}-${index}`} className="border-b border-gray-100 dark:border-white/5 align-top">
            <td className="px-4 py-1.5 font-semibold text-gray-700 dark:text-zinc-300 whitespace-nowrap w-1/3">{header.key}</td>
            <td className="px-4 py-1.5 font-mono text-gray-600 dark:text-zinc-400 break-all select-text">{header.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
