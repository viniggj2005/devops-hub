import React from 'react';
import { Activity, Cpu, Image, MemoryStick } from 'lucide-react';
import * as dockerDtos from '../../../../../../bindings/docker-manager-go/src/dockermanager/dtos/models';

interface StatsGridProps {
  info: dockerDtos.SystemInfoDto | null;
}

const StatsGrid: React.FC<StatsGridProps> = ({ info }) => {
  const memoryGb = info?.MemTotal ? (info.MemTotal / (1024 * 1024 * 1024)).toFixed(1) : '0.0';

  const stats = [
    {
      icon: Activity,
      label: 'Containers Ativos',
      value: info?.ContainersRunning ?? 0,
      accent: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      subtitle: info
        ? `${info.Containers} total • ${info.ContainersPaused} pausados • ${info.ContainersStopped} parados`
        : 'Aguardando conexão',
    },
    {
      icon: Image,
      label: 'Imagens Locais',
      value: info?.Images ?? 0,
      accent: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      subtitle: 'Disponíveis no host',
    },
    {
      icon: Cpu,
      label: 'CPUs do Host',
      value: info?.NCPU ?? 0,
      accent: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      subtitle: info?.Architecture ? `Arquitetura ${info.Architecture}` : 'Núcleos lógicos',
    },
    {
      icon: MemoryStick,
      value: `${memoryGb} GB`,
      label: 'Memória Total',
      accent: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      subtitle: info?.OperatingSystem || 'RAM alocada no daemon',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-gray-200 dark:border-white/[0.07] p-5 flex flex-col justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                {stat.label}
              </span>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${stat.accent}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {stat.value}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1 truncate">
                {stat.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;
