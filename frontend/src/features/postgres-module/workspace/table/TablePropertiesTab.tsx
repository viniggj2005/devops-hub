import React, { useEffect, useState } from 'react';
import { usePostgresStore } from '../../PostgresStore';
import SqlEditor from '../query/components/SqlEditor';
import { useAuth } from '../../../../contexts/AuthContext';
import { PostgresServices } from '../../services/PostgresServices';
import { FormatBytes } from '../../../shared/functions/TreatmentFunction';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import { buildViewDataSql, errorMessage, formatNumber } from '../../functions/TreatmentFunctions';
import type { TableDetails, WorkspaceTab } from '../../../../interfaces/PostgresInterfaces';
import {
  Copy,
  Eye,
  FileCode2,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Rows3,
  ScanEye,
  Table2,
} from 'lucide-react';

type Section = 'columns' | 'indexes' | 'constraints' | 'triggers' | 'sql';

const kindLabels: Record<string, string> = {
  r: 'Tabela',
  p: 'Tabela particionada',
  f: 'Tabela estrangeira',
  v: 'View',
  m: 'View materializada',
};

const constraintLabels: Record<string, string> = {
  p: 'PRIMARY KEY',
  u: 'UNIQUE',
  f: 'FOREIGN KEY',
  c: 'CHECK',
  x: 'EXCLUDE',
  t: 'TRIGGER',
};

const headerCell = 'text-left font-semibold px-3 py-2 whitespace-nowrap';
const bodyCell = 'px-3 py-2 align-top border-t border-gray-100 dark:border-white/5';

const TablePropertiesTab: React.FC<{ tab: WorkspaceTab }> = ({ tab }) => {
  const { token } = useAuth();
  const openQueryTab = usePostgresStore((state) => state.openQueryTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('columns');
  const [details, setDetails] = useState<TableDetails | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setDetails(
        await PostgresServices.getTableDetails(
          token,
          tab.connectionId,
          tab.database,
          tab.schema as string,
          tab.objectName as string
        )
      );
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
          onClick={load}
          className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-sm font-semibold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!details) return null;

  const isView = details.kind === 'v' || details.kind === 'm';
  const KindIcon = details.kind === 'v' ? Eye : details.kind === 'm' ? ScanEye : Table2;
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

  const actionButton =
    'flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors';

  return (
    <div className="h-full overflow-auto">
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
                {kindLabels[details.kind] ?? details.kind} · dono {details.owner} · {tab.database} @{' '}
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
                  sql: buildViewDataSql(details.schema, details.name),
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
            <button className={actionButton} onClick={load} disabled={loading}>
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
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {details.comment && (
          <p className="text-sm text-gray-600 dark:text-zinc-300 rounded-xl border-l-4 border-cyan-500 bg-cyan-500/5 px-4 py-3">
            {details.comment}
          </p>
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
              {item.count !== undefined && (
                <span className="ml-1.5 text-xs opacity-60">{item.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
          {section === 'columns' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.03] text-[11px] uppercase tracking-wider text-gray-400">
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
                    <td className={`${bodyCell} font-mono text-xs`}>
                      {column.dataType}
                      {column.identity && (
                        <span className="ml-2 text-[10px] uppercase text-violet-500">
                          identity {column.identity === 'a' ? 'always' : 'by default'}
                        </span>
                      )}
                      {column.generated && (
                        <span className="ml-2 text-[10px] uppercase text-violet-500">gerada</span>
                      )}
                    </td>
                    <td className={bodyCell}>{column.notNull ? 'não' : 'sim'}</td>
                    <td className={`${bodyCell} font-mono text-xs break-all`}>
                      {column.defaultValue ?? ''}
                    </td>
                    <td className={`${bodyCell} text-xs text-gray-500`}>{column.comment ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === 'indexes' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.03] text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className={headerCell}>Nome</th>
                  <th className={headerCell}>Definição</th>
                  <th className={headerCell}>Tipo</th>
                  <th className={headerCell}>Tamanho</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-zinc-300">
                {details.indexes.map((index) => (
                  <tr key={index.name}>
                    <td className={`${bodyCell} font-medium`}>{index.name}</td>
                    <td className={`${bodyCell} font-mono text-xs break-all`}>
                      {index.definition}
                    </td>
                    <td className={`${bodyCell} text-xs whitespace-nowrap`}>
                      {index.isPrimary ? 'PRIMARY' : index.isUnique ? 'UNIQUE' : '—'}
                    </td>
                    <td className={`${bodyCell} text-xs tabular-nums whitespace-nowrap`}>
                      {FormatBytes(index.sizeBytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === 'constraints' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.03] text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className={headerCell}>Nome</th>
                  <th className={headerCell}>Tipo</th>
                  <th className={headerCell}>Definição</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-zinc-300">
                {details.constraints.map((constraint) => (
                  <tr key={constraint.name}>
                    <td className={`${bodyCell} font-medium`}>{constraint.name}</td>
                    <td className={`${bodyCell} text-xs whitespace-nowrap`}>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-semibold">
                        {constraintLabels[constraint.type] ?? constraint.type}
                      </span>
                    </td>
                    <td className={`${bodyCell} font-mono text-xs break-all`}>
                      {constraint.definition}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === 'triggers' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.03] text-[11px] uppercase tracking-wider text-gray-400">
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
                    <td className={`${bodyCell} font-mono text-xs break-all`}>
                      {trigger.definition}
                    </td>
                    <td className={`${bodyCell} text-xs`}>{trigger.enabled ? 'sim' : 'não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section !== 'sql' && section !== 'columns' && sectionIsEmpty(details, section) && (
            <p className="px-4 py-6 text-sm text-gray-400">Nada cadastrado.</p>
          )}

          {section === 'sql' && (
            <div className="relative h-[60vh]">
              <SqlEditor initialValue={details.ddl} key={details.ddl} readOnly />
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
  );
};

function sectionIsEmpty(details: TableDetails, section: Section) {
  if (section === 'indexes') return details.indexes.length === 0;
  if (section === 'constraints') return details.constraints.length === 0;
  if (section === 'triggers') return details.triggers.length === 0;
  return false;
}

export default TablePropertiesTab;
