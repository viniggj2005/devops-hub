import { useAuth } from '../../../../contexts/AuthContext';
import { TalpadbServices } from '../../services/TalpadbServices';
import { FormatBytes } from '../../../shared/functions/TreatmentFunction';
import { DashboardChart, type DashboardSample } from './components/DashboardChart';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import { errorMessage, formatNumber, formatSeconds } from '../../functions/TreatmentFunctions';
import {
  Activity,
  Ban,
  Database,
  Gauge,
  Loader2,
  Power,
  RefreshCw,
  Users,
  Zap,
} from 'lucide-react';
import type {
  DatabaseStat,
  WorkspaceTab,
  ServerSession,
  ServerDashboard,
} from '../../../../interfaces/TalpadbInterfaces';

const MAX_SAMPLES = 60;
const REFRESH_INTERVAL = 3000;

type CounterKey =
  | 'xactCommit'
  | 'xactRollback'
  | 'tupInserted'
  | 'tupUpdated'
  | 'tupDeleted'
  | 'tupFetched'
  | 'tupReturned'
  | 'blocksRead'
  | 'blocksHit';

const counterKeys: CounterKey[] = [
  'xactCommit',
  'xactRollback',
  'tupInserted',
  'tupUpdated',
  'tupDeleted',
  'tupFetched',
  'tupReturned',
  'blocksRead',
  'blocksHit',
];

const sumCounters = (databases: DatabaseStat[]) =>
  Object.fromEntries(
    counterKeys.map((key) => [key, databases.reduce((sum, database) => sum + database[key], 0)])
  ) as Record<CounterKey, number>;

const isClientSession = (session: ServerSession) =>
  session.backendType ? session.backendType === 'client backend' : session.database !== null;

const sessionCounts = (sessions: ServerSession[]) => {
  const clients = sessions.filter(isClientSession);
  return {
    total: clients.length,
    active: clients.filter((session) => session.state === 'active').length,
    idle: clients.filter((session) => session.state === 'idle').length,
    idleInTransaction: clients.filter((session) => session.state?.startsWith('idle in transaction'))
      .length,
  };
};

const stateBadge = (state: string | null) => {
  if (state === 'active') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (state === 'idle in transaction (aborted)')
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-400';
  if (state?.startsWith('idle in transaction'))
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  return 'bg-gray-500/10 text-gray-500 dark:text-gray-400';
};

const cacheHitRatio = (hit: number, read: number) =>
  hit + read > 0 ? `${((hit / (hit + read)) * 100).toFixed(1)}%` : '—';

const headerCell = 'text-left font-semibold px-3 py-2 whitespace-nowrap';
const bodyCell = 'px-3 py-2 align-top border-t border-gray-100 dark:border-white/5';

const ServerDashboardTab: React.FC<{ tab: WorkspaceTab; active: boolean }> = ({ tab, active }) => {
  const { token } = useAuth();
  const confirmToast = useConfirmToast();
  const loadingRef = useRef(false);
  const previousRef = useRef<{ sampledAt: number; counters: Record<CounterKey, number> } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [samples, setSamples] = useState<DashboardSample[]>([]);
  const [showBackground, setShowBackground] = useState(false);
  const [dashboard, setDashboard] = useState<ServerDashboard | null>(null);
  const [sizes, setSizes] = useState<Record<string, number | null>>({});

  const refresh = useCallback(
    async (includeSizes: boolean) => {
      if (!token || loadingRef.current) return;
      loadingRef.current = true;
      try {
        const data = await TalpadbServices.getServerDashboard(
          token,
          tab.connectionId,
          includeSizes
        );
        setDashboard(data);
        setError(null);
        if (includeSizes)
          setSizes(
            Object.fromEntries(
              data.databases.map((database) => [database.name, database.sizeBytes])
            )
          );

        const counters = sumCounters(data.databases);
        const previous = previousRef.current;
        previousRef.current = { sampledAt: data.sampledAt, counters };
        if (!previous) return;

        // Contadores do pg_stat_database são cumulativos: a taxa vem da diferença entre amostras.
        const seconds = Math.max(0.001, data.sampledAt - previous.sampledAt);
        const rate = (key: CounterKey) =>
          Math.max(0, (counters[key] - previous.counters[key]) / seconds);
        const counts = sessionCounts(data.sessions);
        setSamples((current) =>
          [
            ...current,
            {
              time: data.sampledAt * 1000,
              ...counts,
              commits: rate('xactCommit'),
              rollbacks: rate('xactRollback'),
              inserted: rate('tupInserted'),
              updated: rate('tupUpdated'),
              deleted: rate('tupDeleted'),
              fetched: rate('tupFetched'),
              returned: rate('tupReturned'),
              blocksRead: rate('blocksRead'),
              blocksHit: rate('blocksHit'),
            },
          ].slice(-MAX_SAMPLES)
        );
      } catch (refreshError) {
        setError(errorMessage(refreshError));
      } finally {
        loadingRef.current = false;
      }
    },
    [token, tab.connectionId]
  );

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || !active) return;
    const timer = window.setInterval(() => refresh(false), REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [autoRefresh, active, refresh]);

  const sessions = useMemo(
    () =>
      (dashboard?.sessions ?? [])
        .filter((session) => showBackground || isClientSession(session))
        .sort(
          (first, second) => Number(second.state === 'active') - Number(first.state === 'active')
        ),
    [dashboard, showBackground]
  );

  const signalBackend = (session: ServerSession, terminate: boolean) => {
    if (!token) return;
    confirmToast({
      id: `pg-signal-${session.pid}`,
      title: terminate
        ? `Sessão ${session.pid} encerrada`
        : `Consulta da sessão ${session.pid} cancelada`,
      message: terminate
        ? `Encerrar a conexão ${session.pid} (${session.user ?? '?'}@${session.database ?? '?'})?`
        : `Cancelar a consulta em execução na sessão ${session.pid}?`,
      onConfirm: async () => {
        const signaled = terminate
          ? await TalpadbServices.terminateBackend(token, tab.connectionId, session.pid)
          : await TalpadbServices.cancelBackend(token, tab.connectionId, session.pid);
        if (!signaled)
          throw new Error('O servidor não sinalizou o processo (ele pode já ter terminado).');
        refresh(false);
      },
    });
  };

  if (!dashboard) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        {error ? (
          <>
            <p className="text-sm text-rose-600 dark:text-rose-400 max-w-lg break-words">{error}</p>
            <button
              onClick={() => refresh(true)}
              className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-sm font-semibold"
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando dashboard…
          </span>
        )}
      </div>
    );
  }

  const counts = sessionCounts(dashboard.sessions);
  const counters = sumCounters(dashboard.databases);
  const lastSample = samples[samples.length - 1];
  const stats = [
    {
      label: 'Sessões ativas',
      value: `${counts.active} / ${counts.total}`,
      icon: Users,
      color: 'from-emerald-400 to-emerald-600',
    },
    {
      label: 'Conexões',
      value: `${dashboard.sessions.length} / ${dashboard.maxConnections}`,
      icon: Activity,
      color: 'from-cyan-400 to-cyan-600',
    },
    {
      label: 'Transações/s',
      value: lastSample ? (lastSample.commits + lastSample.rollbacks).toFixed(1) : '—',
      icon: Zap,
      color: 'from-orange-400 to-orange-600',
    },
    {
      label: 'Cache hit',
      value: cacheHitRatio(counters.blocksHit, counters.blocksRead),
      icon: Gauge,
      color: 'from-purple-400 to-purple-600',
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              {tab.connectionName}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                PostgreSQL {dashboard.serverVersion}
              </span>
              {dashboard.inRecovery && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  réplica (somente leitura)
                </span>
              )}
            </h2>
            <p
              className="text-sm text-gray-500 dark:text-zinc-400 truncate"
              title={dashboard.version}
            >
              No ar há {formatSeconds(dashboard.uptimeSeconds)} · usuário {dashboard.currentUser}
              {dashboard.isSuperuser ? ' (superusuário)' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-xs text-rose-500 max-w-xs truncate" title={error}>
                {error}
              </span>
            )}
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="h-4 w-4 accent-cyan-600"
              />
              Atualizar a cada {REFRESH_INTERVAL / 1000}s
            </label>
            <button
              onClick={() => refresh(true)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] p-5"
            >
              <div
                className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}
              >
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 dark:text-white/70 text-sm">{stat.label}</p>
                <p className="text-gray-900 dark:text-white text-2xl font-bold tabular-nums">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DashboardChart
            title="Sessões"
            samples={samples}
            series={[
              { key: 'total', label: 'Total', color: '#06b6d4' },
              { key: 'active', label: 'Ativas', color: '#10b981' },
              { key: 'idle', label: 'Ociosas', color: '#a1a1aa' },
              { key: 'idleInTransaction', label: 'Ociosas em transação', color: '#f59e0b' },
            ]}
          />
          <DashboardChart
            title="Transações por segundo"
            decimals={1}
            samples={samples}
            series={[
              { key: 'commits', label: 'Commits', color: '#3b82f6' },
              { key: 'rollbacks', label: 'Rollbacks', color: '#f43f5e' },
            ]}
          />
          <DashboardChart
            title="Tuplas escritas por segundo"
            decimals={1}
            samples={samples}
            series={[
              { key: 'inserted', label: 'Inseridas', color: '#10b981' },
              { key: 'updated', label: 'Atualizadas', color: '#f59e0b' },
              { key: 'deleted', label: 'Removidas', color: '#f43f5e' },
            ]}
          />
          <DashboardChart
            title="Blocos lidos por segundo"
            decimals={1}
            samples={samples}
            series={[
              { key: 'blocksHit', label: 'Cache (shared buffers)', color: '#8b5cf6' },
              { key: 'blocksRead', label: 'Disco', color: '#f97316' },
            ]}
          />
        </div>

        <section className="rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
            <Database className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-100">Bancos de dados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className={headerCell}>Nome</th>
                  <th className={headerCell}>Tamanho</th>
                  <th className={headerCell}>Conexões</th>
                  <th className={headerCell}>Commits</th>
                  <th className={headerCell}>Rollbacks</th>
                  <th className={headerCell}>Cache hit</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-zinc-300 tabular-nums">
                {dashboard.databases.map((database) => (
                  <tr key={database.name} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <td className={`${bodyCell} font-medium`}>{database.name}</td>
                    <td className={bodyCell}>
                      {sizes[database.name] != null
                        ? FormatBytes(sizes[database.name] as number)
                        : '—'}
                    </td>
                    <td className={bodyCell}>{formatNumber(database.connections)}</td>
                    <td className={bodyCell}>{formatNumber(database.xactCommit)}</td>
                    <td className={bodyCell}>{formatNumber(database.xactRollback)}</td>
                    <td className={bodyCell}>
                      {cacheHitRatio(database.blocksHit, database.blocksRead)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
            <Users className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-100">
              Sessões ({sessions.length})
            </h3>
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showBackground}
                onChange={(event) => setShowBackground(event.target.checked)}
                className="h-4 w-4 accent-cyan-600"
              />
              Mostrar processos em segundo plano
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className={headerCell}>PID</th>
                  <th className={headerCell}>Usuário</th>
                  <th className={headerCell}>Banco</th>
                  <th className={headerCell}>Aplicação</th>
                  <th className={headerCell}>Cliente</th>
                  <th className={headerCell}>Estado</th>
                  <th className={headerCell}>Espera</th>
                  <th className={headerCell}>Duração</th>
                  <th className={headerCell}>Consulta</th>
                  <th className={headerCell} />
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-zinc-300">
                {sessions.map((session) => {
                  const duration =
                    session.state === 'active'
                      ? session.querySeconds
                      : session.state?.startsWith('idle in transaction')
                        ? session.transactionSeconds
                        : null;
                  return (
                    <tr key={session.pid} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className={`${bodyCell} tabular-nums`}>
                        {session.pid}
                        {session.isCurrent && (
                          <span className="ml-1 text-[10px] text-cyan-500">(esta)</span>
                        )}
                      </td>
                      <td className={bodyCell}>{session.user ?? '—'}</td>
                      <td className={bodyCell}>{session.database ?? '—'}</td>
                      <td
                        className={`${bodyCell} max-w-[160px] truncate`}
                        title={session.applicationName}
                      >
                        {session.applicationName || session.backendType || '—'}
                      </td>
                      <td className={`${bodyCell} whitespace-nowrap`}>
                        {session.clientAddress ?? 'local'}
                      </td>
                      <td className={bodyCell}>
                        {session.state ? (
                          <span
                            className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-semibold ${stateBadge(session.state)}`}
                          >
                            {session.state}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`${bodyCell} text-xs whitespace-nowrap`}>
                        {session.waitEvent ?? ''}
                      </td>
                      <td className={`${bodyCell} whitespace-nowrap tabular-nums`}>
                        {formatSeconds(duration)}
                      </td>
                      <td className={`${bodyCell} max-w-[420px]`}>
                        <code
                          className="block truncate text-xs text-gray-600 dark:text-zinc-400"
                          title={session.query ?? ''}
                        >
                          {session.query ?? ''}
                        </code>
                      </td>
                      <td className={`${bodyCell} whitespace-nowrap`}>
                        {!session.isCurrent && isClientSession(session) && (
                          <div className="flex gap-1">
                            <button
                              title="Cancelar consulta (pg_cancel_backend)"
                              disabled={session.state !== 'active'}
                              onClick={() => signalBackend(session, false)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              title="Encerrar sessão (pg_terminate_backend)"
                              onClick={() => signalBackend(session, true)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-500/10"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ServerDashboardTab;
