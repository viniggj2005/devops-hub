import React, { useState } from 'react';
import { cellInputClass } from './KeyValueTable';
import { Eye, EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react';
import type { Variable } from '../../../../interfaces/VulpesInterfaces';

interface VariablesTableProps {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
}

const emptyVariable = (): Variable => ({ key: '', value: '', secret: false, enabled: true });

const VariablesTable: React.FC<VariablesTableProps> = ({ variables, onChange }) => {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const displayRows = [...variables, emptyVariable()];

  const updateRow = (rowIndex: number, patch: Partial<Variable>) => {
    if (rowIndex === variables.length) {
      onChange([...variables, { ...emptyVariable(), ...patch }]);
      return;
    }
    onChange(variables.map((variable, index) => (index === rowIndex ? { ...variable, ...patch } : variable)));
  };

  const toggleReveal = (rowIndex: number) =>
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });

  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_1.6fr_64px] bg-gray-50 dark:bg-white/5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
        <span />
        <span className="px-2 py-1.5">Variável</span>
        <span className="px-2 py-1.5 border-l border-gray-200 dark:border-white/10">Valor</span>
        <span />
      </div>
      {displayRows.map((variable, rowIndex) => {
        const isGhost = rowIndex === variables.length;
        const masked = variable.secret && !revealed.has(rowIndex);
        return (
          <div
            key={rowIndex}
            className={`grid grid-cols-[28px_1fr_1.6fr_64px] items-center border-t border-gray-200 dark:border-white/10 group ${variable.enabled || isGhost ? '' : 'opacity-50'}`}
          >
            <span className="flex justify-center">
              {!isGhost && (
                <input
                  type="checkbox"
                  checked={variable.enabled}
                  onChange={(event) => updateRow(rowIndex, { enabled: event.target.checked })}
                  className="accent-amber-500 cursor-pointer"
                />
              )}
            </span>
            <input
              value={variable.key}
              spellCheck={false}
              placeholder="nomeDaVariavel"
              onChange={(event) => updateRow(rowIndex, { key: event.target.value })}
              className={cellInputClass}
            />
            <div className="flex items-center border-l border-gray-200 dark:border-white/10">
              <input
                value={variable.value}
                spellCheck={false}
                placeholder="valor"
                autoComplete="off"
                type={masked ? 'password' : 'text'}
                onChange={(event) => updateRow(rowIndex, { value: event.target.value })}
                className={cellInputClass}
              />
              {variable.secret && (
                <button
                  type="button"
                  onClick={() => toggleReveal(rowIndex)}
                  title={masked ? 'Mostrar valor' : 'Ocultar valor'}
                  className="p-1 mr-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                >
                  {masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <span className="flex justify-center gap-0.5">
              {!isGhost && (
                <>
                  <button
                    type="button"
                    onClick={() => updateRow(rowIndex, { secret: !variable.secret })}
                    title={variable.secret ? 'Valor secreto (oculto na tela)' : 'Marcar como secreto'}
                    className={`p-1 rounded transition-colors ${variable.secret ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                  >
                    {variable.secret ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    title="Remover"
                    onClick={() => onChange(variables.filter((_, index) => index !== rowIndex))}
                    className="p-1 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default VariablesTable;
