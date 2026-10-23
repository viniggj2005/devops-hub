import React, { useState } from 'react';
import { ListPlus, Table2, Trash2 } from 'lucide-react';
import { emptyKeyValue } from '../../functions/RequestDefaults';
import type { KeyValue } from '../../../../interfaces/VulpesInterfaces';

interface KeyValueTableProps {
  rows: KeyValue[];
  fixedKeys?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  showDescription?: boolean;
  onChange: (rows: KeyValue[]) => void;
}

export const cellInputClass =
  'w-full min-w-0 bg-transparent px-2 py-1.5 text-xs font-mono text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:bg-amber-500/5 disabled:opacity-60';

const toBulkText = (rows: KeyValue[]) =>
  rows.map((row) => `${row.enabled ? '' : '//'}${row.key}:${row.value}`).join('\n');

const fromBulkText = (text: string, previous: KeyValue[]): KeyValue[] =>
  text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const enabled = !line.trimStart().startsWith('//');
      const content = enabled ? line : line.trimStart().slice(2);
      const separator = content.indexOf(':');
      const key = (separator < 0 ? content : content.slice(0, separator)).trim();
      const value = separator < 0 ? '' : content.slice(separator + 1).trim();
      const description = previous.find((row) => row.key === key)?.description ?? '';
      return { key, value, enabled, description };
    });

const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  onChange,
  fixedKeys = false,
  keyPlaceholder = 'Chave',
  valuePlaceholder = 'Valor',
  showDescription = true,
}) => {
  const [bulkText, setBulkText] = useState<string | null>(null);
  const displayRows = fixedKeys ? rows : [...rows, emptyKeyValue()];
  const gridColumns = showDescription ? 'grid-cols-[28px_1fr_1.4fr_1fr_28px]' : 'grid-cols-[28px_1fr_1.6fr_28px]';

  const updateRow = (rowIndex: number, patch: Partial<KeyValue>) => {
    if (rowIndex === rows.length) {
      onChange([...rows, { ...emptyKeyValue(), ...patch }]);
      return;
    }
    onChange(rows.map((row, index) => (index === rowIndex ? { ...row, ...patch } : row)));
  };

  const removeRow = (rowIndex: number) => onChange(rows.filter((_, index) => index !== rowIndex));

  const toggleBulk = () => {
    if (bulkText === null) {
      setBulkText(toBulkText(rows));
      return;
    }
    onChange(fromBulkText(bulkText, rows));
    setBulkText(null);
  };

  return (
    <div className="space-y-2">
      {!fixedKeys && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleBulk}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold text-gray-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {bulkText === null ? <ListPlus className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {bulkText === null ? 'Edição em massa' : 'Edição em tabela'}
          </button>
        </div>
      )}

      {bulkText !== null ? (
        <textarea
          value={bulkText}
          spellCheck={false}
          onChange={(event) => setBulkText(event.target.value)}
          onBlur={() => onChange(fromBulkText(bulkText, rows))}
          placeholder={'chave:valor\n//desabilitada:valor'}
          className="w-full min-h-[180px] rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-950 p-3 text-xs font-mono text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500"
        />
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className={`grid ${gridColumns} bg-gray-50 dark:bg-white/5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500`}>
            <span />
            <span className="px-2 py-1.5">{keyPlaceholder}</span>
            <span className="px-2 py-1.5 border-l border-gray-200 dark:border-white/10">{valuePlaceholder}</span>
            {showDescription && <span className="px-2 py-1.5 border-l border-gray-200 dark:border-white/10">Descrição</span>}
            <span />
          </div>
          {displayRows.map((row, rowIndex) => {
            const isGhost = !fixedKeys && rowIndex === rows.length;
            return (
              <div
                key={rowIndex}
                className={`grid ${gridColumns} items-center border-t border-gray-200 dark:border-white/10 group ${row.enabled || isGhost ? '' : 'opacity-50'}`}
              >
                <span className="flex justify-center">
                  {!isGhost && (
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => updateRow(rowIndex, { enabled: event.target.checked })}
                      className="accent-amber-500 cursor-pointer"
                    />
                  )}
                </span>
                <input
                  value={row.key}
                  disabled={fixedKeys}
                  spellCheck={false}
                  placeholder={keyPlaceholder}
                  onChange={(event) => updateRow(rowIndex, { key: event.target.value })}
                  className={cellInputClass}
                />
                <input
                  value={row.value}
                  spellCheck={false}
                  placeholder={valuePlaceholder}
                  onChange={(event) => updateRow(rowIndex, { value: event.target.value })}
                  className={`${cellInputClass} border-l border-gray-200 dark:border-white/10`}
                />
                {showDescription && (
                  <input
                    value={row.description}
                    placeholder="Descrição"
                    onChange={(event) => updateRow(rowIndex, { description: event.target.value })}
                    className={`${cellInputClass} border-l border-gray-200 dark:border-white/10 font-sans`}
                  />
                )}
                <span className="flex justify-center">
                  {!isGhost && !fixedKeys && (
                    <button
                      type="button"
                      title="Remover"
                      onClick={() => removeRow(rowIndex)}
                      className="p-1 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KeyValueTable;
