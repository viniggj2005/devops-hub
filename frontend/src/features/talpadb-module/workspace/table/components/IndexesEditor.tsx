import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Plus, Trash2, Undo2, X } from 'lucide-react';
import { FormatBytes } from '../../../../shared/functions/TreatmentFunction';
import { generateId } from '../../../functions/TreatmentFunctions';
import type { IndexDraft, IndexInfo } from '../../../../../interfaces/TalpadbInterfaces';
import { addButton, bodyCell, editCell, fieldClass, headerCell, iconButton, rowStatusClass, tableHead } from '../constants/TableStyles';

const indexMethods = ['btree', 'hash', 'gin', 'gist', 'brin'];

interface IndexesEditorProps {
  readOnly: boolean;
  showMethod: boolean;
  indexes: IndexInfo[];
  droppedIndexes: string[];
  newIndexes: IndexDraft[];
  onNewIndexesChange: (indexes: IndexDraft[]) => void;
  onDroppedIndexesChange: (quotedNames: string[]) => void;
}

const IndexesEditor: React.FC<IndexesEditorProps> = ({
  indexes,
  readOnly,
  showMethod,
  newIndexes,
  droppedIndexes,
  onNewIndexesChange,
  onDroppedIndexesChange,
}) => {
  const { dictionary, formatMessage } = useTranslation();
  const commonTexts = dictionary.talpadb.common;
  const editorTexts = dictionary.talpadb.tableEditors;
  const toggleDropped = (quotedName: string) =>
    onDroppedIndexesChange(
      droppedIndexes.includes(quotedName)
        ? droppedIndexes.filter((name) => name !== quotedName)
        : [...droppedIndexes, quotedName]
    );

  const updateNew = (id: string, changes: Partial<IndexDraft>) =>
    onNewIndexesChange(newIndexes.map((index) => (index.id === id ? { ...index, ...changes } : index)));

  const addIndex = () =>
    onNewIndexesChange([...newIndexes, { id: generateId(), name: '', columns: '', method: 'btree', unique: false }]);

  return (
    <>
      <table className="w-full text-sm">
        <thead className={tableHead}>
          <tr>
            <th className={headerCell}>{commonTexts.name}</th>
            <th className={headerCell}>{commonTexts.definition}</th>
            <th className={headerCell}>{commonTexts.type}</th>
            <th className={headerCell}>{editorTexts.size}</th>
            {!readOnly && <th className="w-10" />}
          </tr>
        </thead>
        <tbody className="text-gray-700 dark:text-zinc-300">
          {indexes.map((index) => {
            const dropped = droppedIndexes.includes(index.quotedName);
            return (
              <tr key={index.name} className={rowStatusClass[dropped ? 'dropped' : 'unchanged']}>
                <td className={`${bodyCell} font-medium ${dropped ? 'line-through' : ''}`}>{index.name}</td>
                <td className={`${bodyCell} font-mono text-xs break-all`}>{index.definition}</td>
                <td className={`${bodyCell} text-xs whitespace-nowrap`}>
                  {index.isPrimary ? 'PRIMARY' : index.isUnique ? 'UNIQUE' : '—'}
                </td>
                <td className={`${bodyCell} text-xs tabular-nums whitespace-nowrap`}>{FormatBytes(index.sizeBytes)}</td>
                {!readOnly && <td className={editCell}>
                  <button
                    disabled={index.constraintBacked}
                    onClick={() => toggleDropped(index.quotedName)}
                    title={
                      index.constraintBacked
                        ? editorTexts.constraintBackedIndex
                        : dropped
                          ? editorTexts.keepIndex
                          : editorTexts.dropIndex
                    }
                    className={`${iconButton} ${dropped ? 'hover:text-cyan-600' : 'hover:text-rose-500'}`}
                  >
                    {dropped ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </td>}
              </tr>
            );
          })}
          {!readOnly && newIndexes.map((index) => (
            <tr key={index.id} className={rowStatusClass.new}>
              <td className={editCell}>
                <input
                  value={index.name}
                  placeholder={editorTexts.automatic}
                  onChange={(event) => updateNew(index.id, { name: event.target.value })}
                  className={fieldClass}
                />
              </td>
              <td className={editCell}>
                <input
                  autoFocus
                  value={index.columns}
                  placeholder={editorTexts.indexColumnsPlaceholder}
                  onChange={(event) => updateNew(index.id, { columns: event.target.value })}
                  className={`${fieldClass} font-mono`}
                />
              </td>
              <td className={editCell}>
                <div className="flex items-center gap-2">
                  {showMethod && (
                    <select
                      value={index.method}
                      onChange={(event) => updateNew(index.id, { method: event.target.value })}
                      className={`${fieldClass} w-24 dark:[color-scheme:dark]`}
                    >
                      {indexMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={index.unique}
                      className="accent-cyan-600"
                      onChange={(event) => updateNew(index.id, { unique: event.target.checked })}
                    />
                    {editorTexts.unique}
                  </label>
                </div>
              </td>
              <td className={editCell} />
              <td className={editCell}>
                <button
                  title={editorTexts.removeNewIndex}
                  onClick={() => onNewIndexesChange(newIndexes.filter((item) => item.id !== index.id))}
                  className={`${iconButton} hover:text-rose-500`}
                >
                  <X className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {indexes.length === 0 && newIndexes.length === 0 && (
        <p className="px-4 py-6 text-sm text-gray-400">{commonTexts.nothingRegistered}</p>
      )}
      {!readOnly && (
        <button onClick={addIndex} className={addButton}>
          <Plus className="w-4 h-4" /> {editorTexts.addIndex}
        </button>
      )}
    </>
  );
};

export default IndexesEditor;
