import React, { useMemo, useState } from 'react';
import type { SavedQuery } from '../../../../../interfaces/TalpadbInterfaces';
import { ConfirmModal } from '../../../../shared/components/modals/ConfirmModal';
import {
  Play,
  Save,
  Search,
  Trash2,
  Bookmark,
  FolderOpen,
} from 'lucide-react';

interface SavedQueriesPanelProps {
  sqlText: string;
  loading: boolean;
  savingQuery: boolean;
  savedQueryName: string;
  savedQueries: SavedQuery[];
  activeSavedQueryId: number | null;
  onSaveWithName: (name: string) => void;
  onDeleteSavedQuery: (id: number) => Promise<void> | void;
  onSelectSavedQuery: (savedQuery: SavedQuery, runImmediately: boolean) => void;
}

const SavedQueriesPanel: React.FC<SavedQueriesPanelProps> = ({
  loading,
  sqlText,
  savingQuery,
  savedQueries,
  onSaveWithName,
  savedQueryName,
  onDeleteSavedQuery,
  activeSavedQueryId,
  onSelectSavedQuery,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [deletingQuery, setDeletingQuery] = useState(false);
  const [nameDraft, setNameDraft] = useState(savedQueryName);
  const [pendingDeleteQuery, setPendingDeleteQuery] = useState<SavedQuery | null>(null);

  React.useEffect(() => {
    setNameDraft(savedQueryName);
  }, [savedQueryName]);

  const filteredQueries = useMemo(() => {
    const normalizedFilter = searchFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return savedQueries;
    }
    return savedQueries.filter(
      (queryItem) =>
        queryItem.name.toLowerCase().includes(normalizedFilter) ||
        queryItem.sql.toLowerCase().includes(normalizedFilter)
    );
  }, [savedQueries, searchFilter]);

  const handleSaveSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nameDraft.trim()) return;
    onSaveWithName(nameDraft.trim());
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteQuery || deletingQuery) return;
    setDeletingQuery(true);
    try {
      await onDeleteSavedQuery(pendingDeleteQuery.id);
      setPendingDeleteQuery(null);
    } finally {
      setDeletingQuery(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-white/5 bg-gray-50/60 dark:bg-zinc-950/30 px-3 py-2 flex-shrink-0">
        <form
          onSubmit={handleSaveSubmit}
          className="flex flex-1 flex-wrap items-center gap-2 min-w-[240px]"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700 dark:text-zinc-200 whitespace-nowrap">
            <Bookmark className="h-3.5 w-3.5 text-cyan-500" />
            Salvar atual:
          </span>
          <input
            type="text"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="Dê apenas um nome para salvar a query e suas variáveis..."
            className="h-7 min-w-[200px] max-w-md flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={savingQuery || !nameDraft.trim() || !sqlText.trim()}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 text-[11px] font-bold text-white shadow-sm shadow-cyan-500/15 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            {savingQuery ? 'Salvando...' : 'Salvar Query'}
          </button>
        </form>

        {savedQueries.length > 0 && (
          <div className="relative min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Buscar query salva..."
              className="h-7 w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 pl-8 pr-2.5 text-xs text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-cyan-500"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-400 dark:text-zinc-500">
            Carregando queries salvas...
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.01] p-6 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
              <Bookmark className="h-4 w-4" />
            </div>
            <p className="font-semibold text-gray-800 dark:text-zinc-200">
              {savedQueries.length === 0
                ? 'Nenhuma query salva nesta conexão'
                : 'Nenhuma query encontrada para o filtro'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              Monte seu SQL com <code className="font-mono font-semibold text-amber-500">$1</code>,{' '}
              <code className="font-mono font-semibold text-amber-500">$2</code>, preencha as variáveis e digite um nome acima para salvar.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredQueries.map((savedItem) => {
              const isCurrentActive = activeSavedQueryId === savedItem.id;
              const variableList = Array.isArray(savedItem.variables)
                ? savedItem.variables
                : [];

              return (
                <div
                  key={savedItem.id}
                  className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
                    isCurrentActive
                      ? 'border-cyan-500/40 bg-cyan-500/[0.04]'
                      : 'border-gray-200/80 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/15'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-zinc-100">
                        {savedItem.name}
                      </span>
                      {isCurrentActive && (
                        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                          Aberta na aba
                        </span>
                      )}
                      {savedItem.databaseName && (
                        <span className="rounded-md bg-gray-200/70 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:text-zinc-400">
                          {savedItem.databaseName}
                        </span>
                      )}
                      {variableList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {variableList.map((variableEntry) => (
                            <span
                              key={variableEntry.index}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20"
                            >
                              <strong>${variableEntry.index}</strong>
                              <span className="max-w-[90px] truncate opacity-85">
                                ={variableEntry.type === 'null' ? 'NULL' : variableEntry.value || "''"}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectSavedQuery(savedItem, false)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-2.5 text-[11px] font-semibold text-gray-700 dark:text-zinc-200 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
                      >
                        <FolderOpen className="h-3.5 w-3.5 text-cyan-500" />
                        Carregar
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectSavedQuery(savedItem, true)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-500"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        Executar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteQuery(savedItem)}
                        title="Excluir query salva"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <pre className="max-h-16 overflow-hidden text-ellipsis whitespace-pre-wrap rounded-lg border border-gray-200/60 dark:border-white/5 bg-white/80 dark:bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-gray-600 dark:text-zinc-300">
                    {savedItem.sql}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteQuery)}
        onClose={() => {
          if (!deletingQuery) setPendingDeleteQuery(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Excluir query salva"
        message={
          pendingDeleteQuery
            ? `Tem certeza que deseja excluir a query salva "${pendingDeleteQuery.name}" e suas variáveis? Esta ação não pode ser desfeita.`
            : ''
        }
        type="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        isLoading={deletingQuery}
      />
    </div>
  );
};

export default SavedQueriesPanel;
