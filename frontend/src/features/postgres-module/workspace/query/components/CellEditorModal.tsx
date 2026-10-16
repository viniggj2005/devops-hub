import { Modal } from '../../../../shared/components/modals/Modal';
import { Braces, Check, PencilLine, RotateCcw } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { QueryCell, QueryColumn } from '../../../../../interfaces/PostgresInterfaces';

type EditMode = 'value' | 'null' | 'default';

export interface CellEditTarget {
  rowRef: number;
  rowLabel: string;
  modified: boolean;
  isNewRow: boolean;
  column: QueryColumn;
  columnIndex: number;
  value: QueryCell | undefined;
  original: QueryCell | undefined;
}

interface CellEditorModalProps {
  onClose: () => void;
  onReset: () => void;
  target: CellEditTarget | null;
  onApply: (value: QueryCell) => void;
}

const isJsonType = (dataType: string) => dataType === 'json' || dataType === 'jsonb';
const isBooleanType = (dataType: string) => dataType === 'bool' || dataType === 'boolean';

const prettyJson = (value: string) => {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

const initialDraft = (target: CellEditTarget) => {
  if (target.value === null || target.value === undefined) return '';
  return target.column.dataType === 'jsonb' ? prettyJson(target.value) : target.value;
};

const initialMode = (target: CellEditTarget): EditMode =>
  target.value === undefined ? 'default' : target.value === null ? 'null' : 'value';

const CellEditorModal: React.FC<CellEditorModalProps> = ({ target, onApply, onReset, onClose }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<EditMode>('value');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);
    setMode(initialMode(target));
    setDraft(initialDraft(target));
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, [target]);

  const modes = useMemo<{ id: EditMode; label: string }[]>(
    () => [
      { id: 'value', label: 'Valor' },
      { id: 'null', label: 'NULL' },
      ...(target?.isNewRow ? [{ id: 'default' as EditMode, label: 'DEFAULT' }] : []),
    ],
    [target?.isNewRow]
  );

  if (!target) return null;

  const dataType = target.column.dataType;
  const unchanged = mode === initialMode(target) && (mode !== 'value' || draft === initialDraft(target));

  const apply = () => {
    if (unchanged) {
      onClose();
      return;
    }
    if (mode === 'default') {
      onReset();
      return;
    }
    if (mode === 'null') {
      onApply(null);
      return;
    }
    if (isJsonType(dataType)) {
      try {
        JSON.parse(draft);
      } catch (parseError) {
        setError(`JSON inválido: ${(parseError as Error).message}`);
        return;
      }
    }
    onApply(draft);
  };

  const modeButton = (active: boolean) =>
    `px-3 h-7 rounded-md text-xs font-semibold transition-colors ${
      active
        ? 'bg-white dark:bg-zinc-800 text-cyan-700 dark:text-cyan-300 shadow-sm'
        : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
    }`;

  const secondaryButton =
    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10';

  return (
    <Modal
      isOpen
      size="lg"
      onClose={onClose}
      title={target.column.name}
      description={`${dataType} · ${target.rowLabel}`}
      icon={<PencilLine className="w-5 h-5 text-cyan-500" />}
      footer={
        <>
          {target.modified && (
            <button onClick={onReset} className={`${secondaryButton} mr-auto`} title="Descartar a alteração pendente desta célula">
              <RotateCcw className="w-4 h-4" />
              {target.isNewRow ? 'Usar DEFAULT' : 'Restaurar original'}
            </button>
          )}
          <button onClick={onClose} className={secondaryButton}>
            Cancelar
          </button>
          <button
            onClick={apply}
            title="Aplicar (Ctrl+Enter)"
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700"
          >
            <Check className="w-4 h-4" />
            Aplicar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-white/5">
            {modes.map((option) => (
              <button key={option.id} onClick={() => setMode(option.id)} className={modeButton(mode === option.id)}>
                {option.label}
              </button>
            ))}
          </div>
          {isBooleanType(dataType) &&
            ['true', 'false'].map((booleanValue) => (
              <button
                key={booleanValue}
                onClick={() => {
                  setMode('value');
                  setDraft(booleanValue);
                }}
                className={`px-3 h-7 rounded-md text-xs font-mono font-semibold border transition-colors ${
                  mode === 'value' && draft === booleanValue
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {booleanValue}
              </button>
            ))}
          {isJsonType(dataType) && mode === 'value' && (
            <button
              onClick={() => {
                setDraft(prettyJson(draft));
                setError(null);
              }}
              className="ml-auto flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <Braces className="w-3.5 h-3.5" /> Formatar
            </button>
          )}
        </div>

        {mode === 'value' ? (
          <textarea
            ref={textareaRef}
            value={draft}
            spellCheck={false}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
            className="w-full min-h-[180px] max-h-[50vh] resize-y rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 px-3 py-2.5 text-sm font-mono text-gray-800 dark:text-zinc-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          />
        ) : (
          <div className="min-h-[120px] flex items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-white/10 text-sm italic text-gray-400 dark:text-zinc-500">
            {mode === 'null' ? 'A célula ficará NULL.' : 'A coluna usará o valor padrão (DEFAULT) da tabela.'}
          </div>
        )}

        <div className="flex items-start justify-between gap-3 text-[11px] text-gray-400 dark:text-zinc-500">
          <span className="min-w-0 truncate">
            {target.modified && !target.isNewRow && (
              <>
                Valor no banco:{' '}
                <span className="font-mono text-gray-500 dark:text-zinc-400">
                  {target.original === null ? 'NULL' : target.original}
                </span>
              </>
            )}
          </span>
          {mode === 'value' && <span className="flex-shrink-0">{draft.length.toLocaleString('pt-BR')} caracteres · Ctrl+Enter aplica</span>}
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
};

export default CellEditorModal;
