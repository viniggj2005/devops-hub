import React, { useMemo, useState } from 'react';
import RichMessage from '../../../../i18n/RichMessage';
import { useTranslation } from '../../../../i18n/useTranslation';
import { copyToClipboard } from '../../../../shared/functions/clipboard';
import {
  Eye,
  Copy,
  Plus,
  Save,
  Trash2,
  Eraser,
  Braces,
  Sparkles,
  Bookmark,
} from 'lucide-react';
import {
  formatVariableSqlValue,
  interpolateSqlVariables,
  extractSqlVariableIndices,
} from '../functions/QueryVariables';
import type {
  QueryVariable,
  QueryVariableType,
} from '../../../../../interfaces/TalpadbInterfaces';

interface VariablesPanelProps {
  sqlText: string;
  savingQuery: boolean;
  savedQueryName: string;
  variables: QueryVariable[];
  onOpenSavedTab: () => void;
  onSaveWithName: (name: string) => void;
  onChangeVariables: (nextVariables: QueryVariable[]) => void;
}

const VARIABLE_TYPE_OPTIONS: QueryVariableType[] = ['auto', 'text', 'number', 'boolean', 'null', 'raw'];

const toolButtonClass =
  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-[11px] font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap';

const VariablesPanel: React.FC<VariablesPanelProps> = ({
  sqlText,
  variables,
  savingQuery,
  onOpenSavedTab,
  onSaveWithName,
  savedQueryName,
  onChangeVariables,
}) => {
  const [showPreview, setShowPreview] = useState(true);
  const { dictionary, formatMessage } = useTranslation();
  const variableTexts = dictionary.talpadb.variables;
  const [nameDraft, setNameDraft] = useState(savedQueryName);

  React.useEffect(() => {
    setNameDraft(savedQueryName);
  }, [savedQueryName]);

  const detectedIndices = useMemo(() => extractSqlVariableIndices(sqlText), [sqlText]);
  const detectedIndexSet = useMemo(() => new Set<number>(detectedIndices), [detectedIndices]);

  const resolvedSqlPreview = useMemo(
    () => interpolateSqlVariables(sqlText, variables),
    [sqlText, variables]
  );

  const nextAvailableIndex = useMemo(
    () => (variables.length > 0 ? Math.max(...variables.map((item) => item.index)) + 1 : 1),
    [variables]
  );

  const handleUpdateValue = (variableIndex: number, nextValue: string) => {
    const existsInList = variables.some((entry) => entry.index === variableIndex);
    if (!existsInList) {
      const nextEntry: QueryVariable = {
        index: variableIndex,
        value: nextValue,
        type: 'auto',
      };
      onChangeVariables(
        [...variables, nextEntry].sort(
          (firstItem, secondItem) => firstItem.index - secondItem.index
        )
      );
      return;
    }

    onChangeVariables(
      variables.map((entry): QueryVariable =>
        entry.index === variableIndex
          ? {
              ...entry,
              value: nextValue,
              type: entry.type === 'null' && nextValue !== '' ? 'auto' : entry.type,
            }
          : entry
      )
    );
  };

  const handleUpdateType = (variableIndex: number, nextType: QueryVariableType) => {
    onChangeVariables(
      variables.map((entry): QueryVariable =>
        entry.index === variableIndex ? { ...entry, type: nextType } : entry
      )
    );
  };

  const handleAddNextVariable = () => {
    onChangeVariables([
      ...variables,
      { index: nextAvailableIndex, value: '', type: 'auto' },
    ]);
  };

  const handleRemoveVariable = (variableIndex: number) => {
    if (detectedIndexSet.has(variableIndex)) {
      onChangeVariables(
        variables.map((entry): QueryVariable =>
          entry.index === variableIndex ? { ...entry, value: '', type: 'auto' } : entry
        )
      );
      return;
    }
    onChangeVariables(variables.filter((entry) => entry.index !== variableIndex));
  };

  const handleClearAllValues = () => {
    onChangeVariables(
      variables
        .filter((entry) => detectedIndexSet.has(entry.index))
        .map((entry): QueryVariable => ({
          ...entry,
          value: '',
          type: 'auto',
        }))
    );
  };

  const handleSaveSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nameDraft.trim()) return;
    onSaveWithName(nameDraft.trim());
  };

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-white/5 bg-gray-50/60 dark:bg-zinc-950/30 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddNextVariable}
            className={toolButtonClass}
          >
            <Plus className="h-3.5 w-3.5 text-cyan-500" />
            {formatMessage(variableTexts.addVariable, { index: nextAvailableIndex })}
          </button>

          {variables.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllValues}
              title={variableTexts.clearHint}
              className={toolButtonClass}
            >
              <Eraser className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-400" />
              {variableTexts.clear}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPreview((previous) => !previous)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap ${
              showPreview
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                : 'border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {variableTexts.previewSql}
          </button>
        </div>

        <form
          onSubmit={handleSaveSubmit}
          className="flex flex-1 items-center justify-end gap-1.5 min-w-[260px] max-w-xl"
        >
          <div className="relative flex-1 max-w-xs">
            <Bookmark className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder={variableTexts.saveNamePlaceholder}
              className="h-7 w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 pl-8 pr-2.5 text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingQuery || !nameDraft.trim() || !sqlText.trim()}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 text-[11px] font-bold text-white shadow-sm shadow-cyan-500/15 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            {savingQuery ? dictionary.talpadb.common.saving : dictionary.talpadb.common.save}
          </button>
          <button
            type="button"
            onClick={onOpenSavedTab}
            className={toolButtonClass}
          >
            {dictionary.talpadb.toolbar.saved}
          </button>
        </form>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row min-h-0">
        <div className="flex-1 overflow-auto p-3">
          {variables.length === 0 ? (
            <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.01] p-6 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="max-w-md">
                <p className="font-semibold text-gray-800 dark:text-zinc-200">
                  {variableTexts.emptyTitle}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                  <RichMessage
                    template={variableTexts.emptyHint}
                    values={{
                      first: <code className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono font-semibold text-amber-600 dark:text-amber-400">$1</code>,
                      second: <code className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono font-semibold text-amber-600 dark:text-amber-400">$2</code>,
                      example: <code className="font-mono text-gray-700 dark:text-zinc-300">WHERE id = $1</code>,
                    }}
                  />
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddNextVariable}
                className={`${toolButtonClass} mt-1`}
              >
                <Plus className="h-3.5 w-3.5 text-cyan-500" />
                {variableTexts.addFirst}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {variables.map((variableItem) => {
                const isUsedInSql = detectedIndexSet.has(variableItem.index);
                const formattedPreview = formatVariableSqlValue(variableItem, false);

                return (
                  <div
                    key={variableItem.index}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200/80 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.02] px-3 py-2 transition-colors hover:border-gray-300 dark:hover:border-white/15"
                  >
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <span className="inline-flex min-w-[34px] items-center justify-center rounded-lg bg-amber-500/15 px-2 py-1 font-mono text-xs font-bold text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30">
                        ${variableItem.index}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isUsedInSql
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-gray-200/70 dark:bg-white/5 text-gray-500 dark:text-zinc-400'
                        }`}
                        title={
                          isUsedInSql
                            ? variableTexts.detectedHint
                            : variableTexts.extraHint
                        }
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isUsedInSql ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-zinc-500'
                          }`}
                        />
                        {isUsedInSql ? variableTexts.inQuery : variableTexts.extra}
                      </span>
                    </div>

                    <select
                      value={variableItem.type}
                      onChange={(event) =>
                        handleUpdateType(
                          variableItem.index,
                          event.target.value as QueryVariableType
                        )
                      }
                      className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-2.5 text-xs font-medium text-gray-700 dark:text-zinc-200 outline-none focus:border-cyan-500 dark:[color-scheme:dark]"
                    >
                      {VARIABLE_TYPE_OPTIONS.map((variableType) => (
                        <option key={variableType} value={variableType}>
                          {variableTexts.types[variableType]}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      disabled={variableItem.type === 'null'}
                      value={variableItem.type === 'null' ? 'NULL' : variableItem.value}
                      onChange={(event) =>
                        handleUpdateValue(variableItem.index, event.target.value)
                      }
                      placeholder={formatMessage(variableTexts.valuePlaceholder, { index: variableItem.index })}
                      className="h-8 min-w-[160px] flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/90 px-3 font-mono text-xs text-gray-800 dark:text-zinc-100 placeholder:font-sans placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <div
                      title={formatMessage(variableTexts.substitutedValue, { value: formattedPreview })}
                      className="flex items-center gap-1.5 max-w-[200px] truncate rounded-lg border border-gray-200/60 dark:border-white/5 bg-gray-100/80 dark:bg-black/30 px-2.5 py-1 font-mono text-[11px] text-gray-500 dark:text-zinc-400"
                    >
                      <Braces className="h-3 w-3 flex-shrink-0 text-cyan-500" />
                      <span className="truncate text-cyan-700 dark:text-cyan-300">
                        {formattedPreview}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveVariable(variableItem.index)}
                      title={isUsedInSql ? variableTexts.clearValue : variableTexts.remove}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showPreview && (
          <div className="flex w-full flex-col border-t border-gray-200 dark:border-white/5 bg-gray-50/40 dark:bg-zinc-950/30 md:w-2/5 md:border-l md:border-t-0 min-h-0">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/5 px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
              <span>{variableTexts.resolvedSql}</span>
              <button
                type="button"
                disabled={!resolvedSqlPreview.trim()}
                onClick={() => copyToClipboard(resolvedSqlPreview, variableTexts.resolvedCopied)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-200/60 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-40 transition-colors"
              >
                <Copy className="h-3 w-3 text-cyan-500" />
                {dictionary.talpadb.common.copy}
              </button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-gray-800 dark:text-zinc-200">
              {resolvedSqlPreview.trim() || variableTexts.resolvedEmpty}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default VariablesPanel;
