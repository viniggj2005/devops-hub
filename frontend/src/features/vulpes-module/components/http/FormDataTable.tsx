import React from 'react';
import toast from 'react-hot-toast';
import { FileUp, Trash2 } from 'lucide-react';
import { cellInputClass } from '../editors/KeyValueTable';
import { requireToken } from '../../actions/ActionHelpers';
import { VulpesServices } from '../../services/VulpesServices';
import { emptyFormField } from '../../functions/RequestDefaults';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import type { FormField } from '../../../../interfaces/VulpesInterfaces';

interface FormDataTableProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

const FormDataTable: React.FC<FormDataTableProps> = ({ fields, onChange }) => {
  const displayRows = [...fields, emptyFormField()];

  const updateRow = (rowIndex: number, patch: Partial<FormField>) => {
    if (rowIndex === fields.length) {
      onChange([...fields, { ...emptyFormField(), ...patch }]);
      return;
    }
    onChange(fields.map((field, index) => (index === rowIndex ? { ...field, ...patch } : field)));
  };

  const chooseFile = async (rowIndex: number) => {
    try {
      const path = await VulpesServices.chooseRequestFile(requireToken());
      if (path) updateRow(rowIndex, { filePath: path, kind: 'file' });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_84px_1.4fr_1fr_28px] bg-gray-50 dark:bg-white/5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
        <span />
        <span className="px-2 py-1.5">Chave</span>
        <span className="px-2 py-1.5 border-l border-gray-200 dark:border-white/10">Tipo</span>
        <span className="px-2 py-1.5 border-l border-gray-200 dark:border-white/10">Valor</span>
        <span className="px-2 py-1.5 border-l border-gray-200 dark:border-white/10">Content-Type</span>
        <span />
      </div>
      {displayRows.map((field, rowIndex) => {
        const isGhost = rowIndex === fields.length;
        return (
          <div
            key={rowIndex}
            className={`grid grid-cols-[28px_1fr_84px_1.4fr_1fr_28px] items-center border-t border-gray-200 dark:border-white/10 group ${field.enabled || isGhost ? '' : 'opacity-50'}`}
          >
            <span className="flex justify-center">
              {!isGhost && (
                <input
                  type="checkbox"
                  checked={field.enabled}
                  onChange={(event) => updateRow(rowIndex, { enabled: event.target.checked })}
                  className="accent-amber-500 cursor-pointer"
                />
              )}
            </span>
            <input
              value={field.key}
              placeholder="Chave"
              spellCheck={false}
              onChange={(event) => updateRow(rowIndex, { key: event.target.value })}
              className={cellInputClass}
            />
            <select
              value={field.kind}
              onChange={(event) => updateRow(rowIndex, { kind: event.target.value as FormField['kind'] })}
              className="h-full bg-transparent border-l border-gray-200 dark:border-white/10 px-1.5 text-xs text-gray-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="text">Texto</option>
              <option value="file">Arquivo</option>
            </select>
            {field.kind === 'file' ? (
              <button
                type="button"
                title={field.filePath || 'Selecionar arquivo'}
                onClick={() => chooseFile(rowIndex)}
                className="h-full flex items-center gap-1.5 px-2 border-l border-gray-200 dark:border-white/10 text-xs text-left text-gray-600 dark:text-zinc-300 hover:bg-amber-500/5 truncate"
              >
                <FileUp className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                <span className="truncate">{field.filePath ? fileName(field.filePath) : 'Selecionar arquivo…'}</span>
              </button>
            ) : (
              <input
                value={field.value}
                placeholder="Valor"
                spellCheck={false}
                onChange={(event) => updateRow(rowIndex, { value: event.target.value })}
                className={`${cellInputClass} border-l border-gray-200 dark:border-white/10`}
              />
            )}
            <input
              value={field.contentType}
              placeholder="automático"
              spellCheck={false}
              onChange={(event) => updateRow(rowIndex, { contentType: event.target.value })}
              className={`${cellInputClass} border-l border-gray-200 dark:border-white/10`}
            />
            <span className="flex justify-center">
              {!isGhost && (
                <button
                  type="button"
                  title="Remover"
                  onClick={() => onChange(fields.filter((_, index) => index !== rowIndex))}
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
  );
};

export default FormDataTable;
