import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Plus, Trash2, Undo2, X } from 'lucide-react';
import { generateId } from '../../../functions/TreatmentFunctions';
import { addButton, bodyCell, editCell, fieldClass, headerCell, iconButton, rowStatusClass, tableHead } from '../constants/TableStyles';
import type { ConstraintDraft, ConstraintDraftType, ConstraintInfo } from '../../../../../interfaces/TalpadbInterfaces';

export const constraintLabels: Record<string, string> = {
  p: 'PRIMARY KEY',
  u: 'UNIQUE',
  f: 'FOREIGN KEY',
  c: 'CHECK',
  x: 'EXCLUDE',
  t: 'TRIGGER',
};

const draftTypes: ConstraintDraftType[] = ['p', 'u', 'f', 'c'];

interface ConstraintsEditorProps {
  readOnly: boolean;
  constraints: ConstraintInfo[];
  droppedConstraints: string[];
  newConstraints: ConstraintDraft[];
  onNewConstraintsChange: (constraints: ConstraintDraft[]) => void;
  onDroppedConstraintsChange: (quotedNames: string[]) => void;
}

const ConstraintsEditor: React.FC<ConstraintsEditorProps> = ({
  readOnly,
  constraints,
  newConstraints,
  droppedConstraints,
  onNewConstraintsChange,
  onDroppedConstraintsChange,
}) => {
  const { dictionary, formatMessage } = useTranslation();
  const commonTexts = dictionary.talpadb.common;
  const editorTexts = dictionary.talpadb.tableEditors;
  const toggleDropped = (quotedName: string) =>
    onDroppedConstraintsChange(
      droppedConstraints.includes(quotedName)
        ? droppedConstraints.filter((name) => name !== quotedName)
        : [...droppedConstraints, quotedName]
    );

  const updateNew = (id: string, changes: Partial<ConstraintDraft>) =>
    onNewConstraintsChange(newConstraints.map((constraint) => (constraint.id === id ? { ...constraint, ...changes } : constraint)));

  const addConstraint = () =>
    onNewConstraintsChange([
      ...newConstraints,
      { id: generateId(), name: '', type: 'u', columns: '', expression: '', references: '' },
    ]);

  return (
    <>
      <table className="w-full text-sm">
        <thead className={tableHead}>
          <tr>
            <th className={headerCell}>{commonTexts.name}</th>
            <th className={headerCell}>{commonTexts.type}</th>
            <th className={headerCell}>{commonTexts.definition}</th>
            {!readOnly && <th className="w-10" />}
          </tr>
        </thead>
        <tbody className="text-gray-700 dark:text-zinc-300">
          {constraints.map((constraint) => {
            const dropped = droppedConstraints.includes(constraint.quotedName);
            return (
              <tr key={constraint.name} className={rowStatusClass[dropped ? 'dropped' : 'unchanged']}>
                <td className={`${bodyCell} font-medium ${dropped ? 'line-through' : ''}`}>{constraint.name}</td>
                <td className={`${bodyCell} text-xs whitespace-nowrap`}>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-semibold">
                    {constraintLabels[constraint.type] ?? constraint.type}
                  </span>
                </td>
                <td className={`${bodyCell} font-mono text-xs break-all`}>{constraint.definition}</td>
                {!readOnly && <td className={editCell}>
                  <button
                    disabled={!constraint.isLocal}
                    onClick={() => toggleDropped(constraint.quotedName)}
                    title={!constraint.isLocal ? editorTexts.inheritedConstraint : dropped ? editorTexts.keepConstraint : editorTexts.dropConstraint}
                    className={`${iconButton} ${dropped ? 'hover:text-cyan-600' : 'hover:text-rose-500'}`}
                  >
                    {dropped ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </td>}
              </tr>
            );
          })}
          {!readOnly && newConstraints.map((constraint) => (
            <tr key={constraint.id} className={rowStatusClass.new}>
              <td className={editCell}>
                <input
                  value={constraint.name}
                  placeholder={editorTexts.automatic}
                  onChange={(event) => updateNew(constraint.id, { name: event.target.value })}
                  className={fieldClass}
                />
              </td>
              <td className={editCell}>
                <select
                  value={constraint.type}
                  onChange={(event) => updateNew(constraint.id, { type: event.target.value as ConstraintDraftType })}
                  className={`${fieldClass} w-36 dark:[color-scheme:dark]`}
                >
                  {draftTypes.map((type) => (
                    <option key={type} value={type}>
                      {constraintLabels[type]}
                    </option>
                  ))}
                </select>
              </td>
              <td className={editCell}>
                {constraint.type === 'c' ? (
                  <input
                    autoFocus
                    value={constraint.expression}
                    placeholder={editorTexts.checkPlaceholder}
                    onChange={(event) => updateNew(constraint.id, { expression: event.target.value })}
                    className={`${fieldClass} font-mono`}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={constraint.columns}
                      placeholder={editorTexts.constraintColumnsPlaceholder}
                      onChange={(event) => updateNew(constraint.id, { columns: event.target.value })}
                      className={`${fieldClass} font-mono`}
                    />
                    {constraint.type === 'f' && (
                      <>
                        <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">REFERENCES</span>
                        <input
                          value={constraint.references}
                          placeholder={editorTexts.referencesPlaceholder}
                          onChange={(event) => updateNew(constraint.id, { references: event.target.value })}
                          className={`${fieldClass} font-mono`}
                        />
                      </>
                    )}
                  </div>
                )}
              </td>
              <td className={editCell}>
                <button
                  title={editorTexts.removeNewConstraint}
                  onClick={() => onNewConstraintsChange(newConstraints.filter((item) => item.id !== constraint.id))}
                  className={`${iconButton} hover:text-rose-500`}
                >
                  <X className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {constraints.length === 0 && newConstraints.length === 0 && (
        <p className="px-4 py-6 text-sm text-gray-400">{commonTexts.nothingRegistered}</p>
      )}
      {!readOnly && (
        <button onClick={addConstraint} className={addButton}>
          <Plus className="w-4 h-4" /> {editorTexts.addConstraint}
        </button>
      )}
    </>
  );
};

export default ConstraintsEditor;
