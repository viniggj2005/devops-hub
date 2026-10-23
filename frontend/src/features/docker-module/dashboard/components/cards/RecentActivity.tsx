import React from 'react';
import { Server } from 'lucide-react';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import * as dockerDtos from '../../../../../../bindings/docker-manager-go/src/dockermanager/dtos/models';

interface RecentActivityProps {
  info: dockerDtos.SystemInfoDto | null;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ info }) => {
  const { connecting, dockerClientId } = useDockerClient();

  const isConnected = Boolean(dockerClientId && info);

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-gray-200 dark:border-white/[0.07] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Telemetria do Daemon
          </h2>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            connecting
              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              : isConnected
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connecting ? 'bg-amber-400 animate-pulse' : isConnected ? 'bg-emerald-500' : 'bg-zinc-500'
            }`}
          />
          {connecting ? 'Conectando' : isConnected ? 'Daemon Ativo' : 'Desconectado'}
        </span>
      </div>

      {info ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-100 dark:border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Host Name
            </p>
            <p className="text-xs font-mono font-semibold text-gray-800 dark:text-zinc-200 mt-1 truncate" title={info.Name}>
              {info.Name || '—'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-100 dark:border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Engine Version
            </p>
            <p className="text-xs font-mono font-semibold text-gray-800 dark:text-zinc-200 mt-1 truncate">
              {info.ServerVersion ? `v${info.ServerVersion}` : '—'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-100 dark:border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Sistema Operacional
            </p>
            <p className="text-xs font-mono font-semibold text-gray-800 dark:text-zinc-200 mt-1 truncate" title={info.OperatingSystem}>
              {info.OperatingSystem || '—'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-100 dark:border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              ID do Sistema
            </p>
            <p className="text-xs font-mono font-semibold text-gray-800 dark:text-zinc-200 mt-1 truncate" title={info.ID}>
              {info.ID || '—'}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {connecting
            ? 'Aguardando resposta do servidor Docker...'
            : 'Selecione uma credencial Docker ativa no topo da página para carregar os detalhes do daemon.'}
        </p>
      )}
    </div>
  );
};

export default RecentActivity;
