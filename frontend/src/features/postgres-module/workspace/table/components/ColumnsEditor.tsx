import React from 'react';
import { KeyRound, Link2, Plus, Trash2, Undo2 } from 'lucide-react';
import type { ColumnDraft } from '../../../../../interfaces/PostgresInterfaces';
import { columnStatus, createColumnDraft } from '../../../functions/TableAlterScript';
import { addButton, editCell, fieldClass, headerCell, iconButton, rowStatusClass, tableHead } from '../constants/TableStyles';

const commonTypes = [
  'text',
  'uuid',
  'date',
  'json',
  'jsonb',
  'bytea',
  'serial',
  'bigint',
  'integer',
  'boolean',
  'smallint',
  'bigserial',
  'timestamp',
  'timestamptz',
  'numeric(12,2)',
  'varchar(255)',
  'double precision',
];

interface ColumnsEditorProps {
  columns: ColumnDraft[];
  onChange: (columns: ColumnDraft[]) => void;
}

const ColumnsEditor: React.FC<ColumnsEditorProps> = ({ columns, onChange }) => {
  const update = (id: string, changes: Partial<ColumnDraft>) =>
    onChange(columns.map((column) => (column.id === id ? { ...column, ...changes } : column)));

  const remove = (column: ColumnDraft) => {
    if (column.original) update(column.id, { dropped: !column.dropped });
    else onChange(columns.filter((item) => item.id !== column.id));
  };

  return (
    <>
      <datalist id="postgres-column-types">
        {commonTypes.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      <table className="w-full text-sm">
        <thead className={tableHead}>
          <tr>
            <th className={headerCell}>Nome</th>
            <th className={headerCell}>Tipo</th>
            <th className={`${headerCell} text-center`}>Not null</th>
            <th className={headerCell}>Padrão</th>
            <th className={headerCell}>Comentário</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="text-gray-700 dark:text-zinc-300">
          {columns.map((column) => {
            const status = columnStatus(column);
            const original = column.original;
            const disabled = column.dropped;
            const defaultLocked = Boolean(original?.identity || original?.generated);
            return (
              <tr key={column.id} className={rowStatusClass[status]}>
                <td className={editCell}>
                  <div className="flex items-center gap-1.5">
                    {original?.isPrimaryKey && <KeyRound className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />}
                    {original?.isForeignKey && <Link2 className="w-3.5 h-3.5 flex-shrink-0 text-sky-500" />}
                    <input
                      value={column.name}
                      disabled={disabled}
                      placeholder="nome_da_coluna"
                      autoFocus={!original && !column.name}
                      onChange={(event) => update(column.id, { name: event.target.value })}
                      className={`${fieldClass} font-medium ${disabled ? 'line-through' : ''}`}
                    />
                  </div>
                </td>
                <td className={editCell}>
                  <input
                    value={column.dataType}
                    disabled={disabled}
                    list="postgres-column-types"
                    onChange={(event) => update(column.id, { dataType: event.target.value })}
                    className={`${fieldClass} font-mono min-w-[140px]`}
                  />
                </td>
                <td className={`${editCell} text-center`}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={column.notNull}
                    className="accent-cyan-600 w-4 h-4"
                    onChange={(event) => update(column.id, { notNull: event.target.checked })}
                  />
                </td>
                <td className={editCell}>
                  <input
                    value={column.defaultValue}
                    disabled={disabled || defaultLocked}
                    placeholder={defaultLocked ? (original?.identity ? 'identity' : 'gerada') : 'sem padrão'}
                    title={defaultLocked ? 'Colunas identity/geradas não aceitam DEFAULT' : 'Expressão SQL, ex.: now(), 0, \'ativo\''}
                    onChange={(event) => update(column.id, { defaultValue: event.target.value })}
                    className={`${fieldClass} font-mono`}
                  />
                </td>
                <td className={editCell}>
                  <input
                    value={column.comment}
                    disabled={disabled}
                    onChange={(event) => update(column.id, { comment: event.target.value })}
                    className={fieldClass}
                  />
                </td>
                <td className={editCell}>
                  <button
                    onClick={() => remove(column)}
                    title={column.dropped ? 'Restaurar coluna' : original ? 'Excluir coluna' : 'Remover coluna nova'}
                    className={`${iconButton} ${column.dropped ? 'hover:text-cyan-600' : 'hover:text-rose-500'}`}
                  >
                    {column.dropped ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button onClick={() => onChange([...columns, createColumnDraft()])} className={addButton}>
        <Plus className="w-4 h-4" /> Adicionar coluna
      </button>
    </>
  );
};

export default ColumnsEditor;
