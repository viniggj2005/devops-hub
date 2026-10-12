import React from 'react';
import { connectionLabel } from '../../functions/TreatmentFunctions';
import type { PostgresConnection } from '../../../../interfaces/PostgresInterfaces';
import { Activity, FileCode2, Loader2, Pencil, Plug, Server, Trash2, Zap } from 'lucide-react';

interface ConnectionCardProps {
  connection: PostgresConnection;
  testing: boolean;
  onConnect: (connection: PostgresConnection) => void;
  onQuery: (connection: PostgresConnection) => void;
  onDashboard: (connection: PostgresConnection) => void;
  onTest: (connection: PostgresConnection) => void;
  onEdit: (connection: PostgresConnection) => void;
  onRemove: (connection: PostgresConnection) => void;
}

const sslBadge = (sslMode: string) => {
  if (sslMode === 'disable')
    return { label: 'sem SSL', className: 'bg-gray-500/10 text-gray-500 dark:text-gray-400' };
  if (sslMode === 'prefer' || sslMode === 'allow')
    return { label: 'SSL opcional', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' };
  return { label: 'SSL', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
};

const actionClass =
  'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all disabled:opacity-50';

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  testing,
  onConnect,
  onQuery,
  onDashboard,
  onTest,
  onEdit,
  onRemove,
}) => {
  const badge = sslBadge(connection.sslMode);

  return (
    <div className="group mb-2 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          <Server className="h-6 w-6" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white truncate">
              {connectionLabel(connection)}
            </h3>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="font-mono text-sm text-gray-500 dark:text-gray-400 truncate">
            {connection.username}@{connection.host}:{connection.port}/{connection.database}
          </div>
        </div>
      </div>

      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onConnect(connection)}
          title="Conectar e explorar"
          className={`${actionClass} hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-400`}
        >
          <Plug className="h-5 w-5" />
        </button>
        <button
          onClick={() => onQuery(connection)}
          title="Nova query"
          className={`${actionClass} hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white`}
        >
          <FileCode2 className="h-5 w-5" />
        </button>
        <button
          onClick={() => onDashboard(connection)}
          title="Dashboard do servidor"
          className={`${actionClass} hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/10 dark:hover:text-violet-400`}
        >
          <Activity className="h-5 w-5" />
        </button>
        <button
          onClick={() => onTest(connection)}
          disabled={testing}
          title="Testar conexão"
          className={`${actionClass} hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400`}
        >
          {testing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
        </button>
        <button
          onClick={() => onEdit(connection)}
          title="Editar conexão"
          className={`${actionClass} hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400`}
        >
          <Pencil className="h-5 w-5" />
        </button>
        <button
          onClick={() => onRemove(connection)}
          title="Excluir conexão"
          className={`${actionClass} hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400`}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default ConnectionCard;
