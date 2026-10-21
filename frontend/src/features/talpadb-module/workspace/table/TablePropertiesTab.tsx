import toast from 'react-hot-toast';
import { useTalpadbStore } from '../../TalpadbStore';
import SqlEditor from '../query/components/SqlEditor';
import IndexesEditor from './components/IndexesEditor';
import ColumnsEditor from './components/ColumnsEditor';
import { useExplorerStore } from '../explorer/ExplorerStore';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import AlterPreviewModal from './components/AlterPreviewModal';
import { TalpadbServices } from '../../services/TalpadbServices';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import { FormatBytes } from '../../../shared/functions/TreatmentFunction';
import ConstraintsEditor from './components/ConstraintsEditor';
import { bodyCell, fieldClass, headerCell, tableHead } from './constants/TableStyles';
import { engineInfo, engineOf } from '../../functions/DatabaseEngines';
import { buildViewDataSql, errorMessage, formatNumber, storedIdentifier } from '../../functions/TreatmentFunctions';
import type { TableDetails, TableDraft, WorkspaceTab } from '../../../../interfaces/TalpadbInterfaces';
import {
  buildAlterScript,
  createTableDraft,
  isColumnDraftComplete,
  isConstraintDraftComplete,
} from '../../functions/TableAlterScript';
import {
  Eye,
  Copy,
  Link2,
  Rows3,
  Table2,
  Undo2,
  ScanEye,
  Loader2,
  KeyRound,
  RefreshCw,
  FileCode2,
  ScrollText,
} from 'lucide-react';

type Section = 'columns' | 'indexes' | 'constraints' | 'triggers' | 'sql';

const kindLabels: Record<string, string> = {
  r: 'Tabela',
  p: 'Tabela particionada',
  f: 'Tabela estrangeira',
  v: 'View',
  m: 'View materializada',
};

const formatExecutionError = (error: { message: string; detail: string; hint: string }) =>
  [error.message, error.detail, error.hint].filter(Boolean).join(' — ');

const TablePropertiesTab: React.FC<{ tab: WorkspaceTab }> = ({ tab }) => {
  const { token } = useAuth();
  const updateTab = useTalpadbStore((state) => state.updateTab);
  const openQueryTab = useTalpadbStore((state) => state.openQueryTab);
  const engine = useTalpadbStore((state) => engineOf(state.connections.find((connection) => connection.id === tab.connectionId)));
  const info = engineInfo(engine);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draft, setDraft] = useState<TableDraft | null>(null);
  const [section, setSection] = useState<Section>('columns');
  const [details, setDetails] = useState<TableDetails | null>(null);

  const load = async (objectName = tab.objectName as string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await TalpadbServices.getTableDetails(
        token,
        tab.connectionId,
        tab.database,
        tab.schema as string,
        objectName
      );
      setDetails(loaded);
      setDraft(createTableDraft(loaded));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const script = useMemo(() => (details && draft ? buildAlterScript(details, draft, engine) : ''), [details, draft, engine]);

  if (loading && !details) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando propriedades…
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400 max-w-lg break-words">{error}</p>
        <button
          onClick={() => load()}
          className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-sm font-semibold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!details || !draft) return null;

  const isView = details.kind === 'v' || details.kind === 'm';
  const editable = details.kind === 'r' || details.kind === 'p';
  const hasChanges = editable && script !== '';
  const KindIcon = details.kind === 'v' ? Eye : details.kind === 'm' ? ScanEye : Table2;
  const incomplete =
    !draft.name.trim() ||
    draft.columns.some((column) => !isColumnDraftComplete(column)) ||
    draft.newIndexes.some((index) => !index.columns.trim()) ||
    draft.newConstraints.some((constraint) => !isConstraintDraftComplete(constraint));

  const sections: { id: Section; label: string; count?: number }[] = [
    { id: 'columns', label: 'Colunas', count: details.columns.length },
    ...(!isView || details.kind === 'm'
      ? [{ id: 'indexes' as Section, label: 'Índices', count: details.indexes.length }]
      : []),
    ...(!isView
      ? [{ id: 'constraints' as Section, label: 'Constraints', count: details.constraints.length }]
      : []),
    { id: 'triggers', label: 'Triggers', count: details.triggers.length },
    { id: 'sql', label: 'SQL' },
  ];
  const stats = [
    { label: 'Linhas (estimativa)', value: formatNumber(details.estimatedRows) },
    { label: 'Tamanho total', value: FormatBytes(details.totalSizeBytes) || '0 B' },
    { label: 'Dados', value: FormatBytes(details.tableSizeBytes) || '0 B' },
    { label: 'Índices', value: FormatBytes(details.indexSizeBytes) || '0 B' },
  ];

  const changeDraft = (changes: Partial<TableDraft>) => setDraft((current) => (current ? { ...current, ...changes } : current));

  const refreshExplorer = () => {
    if (!token) return;
    const { nodes, refresh } = useExplorerStore.getState();
    const schemaNode = Object.values(nodes).find(
      (node) =>
        node.kind === 'schema' &&
        node.schema === details.schema &&
        node.database === tab.database &&
        node.connectionId === tab.connectionId
    );
    if (schemaNode) refresh(token, schemaNode.id);
    else TalpadbServices.invalidateCompletion(tab.connectionId, tab.database);
  };

  const apply = async () => {
    if (!token || !script) return;
    setApplying(true);
    let sessionId: string | null = null;
    try {
      const session = await TalpadbServices.openQuerySession(token, tab.connectionId, tab.database);
      sessionId = session.sessionId;
      const executable = engine === 'sqlite' ? `BEGIN;\n${script}\nCOMMIT;` : script;
      const execution = await TalpadbServices.executeQuery(token, sessionId, executable, 1);
      if (execution.error) throw new Error(formatExecutionError(execution.error));

      const newName = storedIdentifier(draft.name.trim(), engine);
      const renamed = newName !== details.name;
      if (renamed) {
        updateTab(tab.id, {
          title: newName,
          objectName: newName,
          key: `table:${tab.connectionId}:${tab.database}:${tab.schema}:${newName}`,
        });
      }
      toast.success(`Tabela alterada: ${details.schema}.${newName}`);
      setPreviewOpen(false);
      refreshExplorer();
      await load(newName);
    } catch (applyError) {
      toast.error(
        `${info.supportsAtomicAlter ? 'Nada foi alterado' : 'Erro ao alterar (comandos anteriores ao erro já foram aplicados)'}: ${errorMessage(applyError)}`
      );
    } finally {
      if (sessionId) TalpadbServices.closeQuerySession(token, sessionId).catch(() => undefined);
      setApplying(false);
    }
  };

  const actionButton =
    'flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0">
                <KindIcon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {details.schema}.{details.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  {kindLabels[details.kind] ?? details.kind}
                  {details.owner && ` · dono ${details.owner}`} · {tab.database} @{' '}
                  {tab.connectionName}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={actionButton}
                onClick={() =>
                  openQueryTab({
                    connectionId: tab.connectionId,
                    database: tab.database,
                    sql: buildViewDataSql(details.schema, details.name, engine),
                    autoRun: true,
                    title: details.name,
                  })
                }
              >
                <Rows3 className="w-4 h-4" /> Ver dados
              </button>
              <button
                className={actionButton}
                onClick={() =>
                  openQueryTab({
                    connectionId: tab.connectionId,
                    database: tab.database,
                    sql: details.ddl,
                    title: `${details.name} (DDL)`,
                  })
                }
              >
                <FileCode2 className="w-4 h-4" /> Abrir SQL no editor
              </button>
              <button
                className={actionButton}
                onClick={() => load()}
                disabled={loading || hasChanges}
                title={hasChanges ? 'Aplique ou descarte as alterações antes de atualizar' : 'Recarregar do servidor'}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.03] px-4 py-3"
              >
                <p className="text-[11px] uppercase tracking-wider text-gray-400">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {editable ? (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Nome da tabela</span>
                <input
                  value={draft.name}
                  onChange={(event) => changeDraft({ name: event.target.value })}
                  className={`${fieldClass} h-9 text-sm font-medium`}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Comentário</span>
                <input
                  value={draft.comment}
                  disabled={engine === 'sqlite'}
                  placeholder={engine === 'sqlite' ? 'SQLite não guarda comentários' : 'Sem comentário'}
                  onChange={(event) => changeDraft({ comment: event.target.value })}
                  className={`${fieldClass} h-9 text-sm`}
                />
              </label>
            </div>
          ) : (
            details.comment && (
              <p className="text-sm text-gray-600 dark:text-zinc-300 rounded-xl border-l-4 border-cyan-500 bg-cyan-500/5 px-4 py-3">
                {details.comment}
              </p>
            )
          )}

          <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-white/5">
            {sections.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${
                  section === item.id
                    ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {item.label}
                {item.count !== undefined && <span className="ml-1.5 text-xs opacity-60">{item.count}</span>}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
            {section === 'columns' &&
              (editable ? (
                <ColumnsEditor engine={engine} columns={draft.columns} onChange={(columns) => changeDraft({ columns })} />
              ) : (
                <table className="w-full text-sm">
                  <thead className={tableHead}>
                    <tr>
                      <th className={headerCell}>#</th>
                      <th className={headerCell}>Nome</th>
                      <th className={headerCell}>Tipo</th>
                      <th className={headerCell}>Nulo</th>
                      <th className={headerCell}>Padrão</th>
                      <th className={headerCell}>Comentário</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-zinc-300">
                    {details.columns.map((column) => (
                      <tr key={column.name} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <td className={`${bodyCell} text-gray-400 tabular-nums`}>{column.position}</td>
                        <td className={`${bodyCell} font-medium`}>
                          <span className="inline-flex items-center gap-1.5">
                            {column.isPrimaryKey && <KeyRound className="w-3.5 h-3.5 text-amber-500" />}
                            {column.isForeignKey && <Link2 className="w-3.5 h-3.5 text-sky-500" />}
                            {column.name}
                          </span>
                        </td>
                        <td className={`${bodyCell} font-mono text-xs`}>{column.dataType}</td>
                        <td className={bodyCell}>{column.notNull ? 'não' : 'sim'}</td>
                        <td className={`${bodyCell} font-mono text-xs break-all`}>{column.defaultValue ?? ''}</td>
                        <td className={`${bodyCell} text-xs text-gray-500`}>{column.comment ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}

            {section === 'indexes' && (
              <IndexesEditor
                readOnly={!editable}
                showMethod={info.supportsIndexMethods}
                indexes={details.indexes}
                newIndexes={draft.newIndexes}
                droppedIndexes={draft.droppedIndexes}
                onNewIndexesChange={(newIndexes) => changeDraft({ newIndexes })}
                onDroppedIndexesChange={(droppedIndexes) => changeDraft({ droppedIndexes })}
              />
            )}

            {section === 'constraints' && (
              <ConstraintsEditor
                readOnly={!editable || !info.supportsConstraintChanges}
                constraints={details.constraints}
                newConstraints={draft.newConstraints}
                droppedConstraints={draft.droppedConstraints}
                onNewConstraintsChange={(newConstraints) => changeDraft({ newConstraints })}
                onDroppedConstraintsChange={(droppedConstraints) => changeDraft({ droppedConstraints })}
              />
            )}

            {section === 'triggers' && (
              <table className="w-full text-sm">
                <thead className={tableHead}>
                  <tr>
                    <th className={headerCell}>Nome</th>
                    <th className={headerCell}>Definição</th>
                    <th className={headerCell}>Ativo</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-zinc-300">
                  {details.triggers.map((trigger) => (
                    <tr key={trigger.name}>
                      <td className={`${bodyCell} font-medium`}>{trigger.name}</td>
                      <td className={`${bodyCell} font-mono text-xs break-all`}>{trigger.definition}</td>
                      <td className={`${bodyCell} text-xs`}>{trigger.enabled ? 'sim' : 'não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {section === 'triggers' && details.triggers.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400">Nada cadastrado.</p>
            )}

            {section === 'sql' && (
              <div className="relative h-[60vh]">
                <SqlEditor engine={engine} initialValue={details.ddl} key={details.ddl} readOnly />
                <button
                  onClick={() => copyToClipboard(details.ddl, 'SQL copiado')}
                  className="absolute top-3 right-4 flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white/90 dark:bg-zinc-800/90 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-300 shadow"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {hasChanges && (
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-t border-gray-200 dark:border-white/5 bg-amber-500/5">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {script.split('\n').length} {script.split('\n').length === 1 ? 'comando pendente' : 'comandos pendentes'}
          </span>
          {incomplete && (
            <span className="text-xs text-rose-600 dark:text-rose-400">
              Preencha nome e tipo das colunas novas e as definições de índices/constraints.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setDraft(createTableDraft(details))} disabled={applying} className={actionButton}>
              <Undo2 className="w-4 h-4" /> Descartar
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              disabled={incomplete || applying}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ScrollText className="w-4 h-4" /> Revisar e aplicar
            </button>
          </div>
        </div>
      )}

      <AlterPreviewModal
        script={script}
        isOpen={previewOpen}
        applying={applying}
        onApply={apply}
        onClose={() => setPreviewOpen(false)}
        onOpenInEditor={() => {
          setPreviewOpen(false);
          openQueryTab({
            connectionId: tab.connectionId,
            database: tab.database,
            sql: engine === 'oracle' ? script : `BEGIN;\n${script}\nCOMMIT;`,
            title: `${details.name} (ALTER)`,
          });
        }}
      />
    </div>
  );
};

export default TablePropertiesTab;
