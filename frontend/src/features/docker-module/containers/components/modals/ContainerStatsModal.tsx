import { CPUChart } from '../charts/CpuChart';
import { MemoryChart } from '../charts/MemoryChart';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { EventsOn } from '../../../../../../wailsjs/runtime/runtime';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BytesToMB } from '../../../../../features/shared/functions/TreatmentFunction';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ContainerStatsProps, StatsPayload } from '../../../../../interfaces/ContainerInterfaces';
import { StartContainerStats, StopContainerStats } from '../../../../../../wailsjs/go/handlers/DockerSdkHandlerStruct';

const maxPoints = 10;

const ContainerStatsModal: React.FC<ContainerStatsProps> = ({ id, name, onClose }) => {
  const memoryLimitMBRef = useRef<number | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [cpuSeries, setCpuSeries] = useState<{ time: number; value: number }[]>([]);
  const [memoryPercentageSeries, setMemPctSeries] = useState<{ time: number; value: number }[]>([]);
  const [memoryUsageMBSeries, setMemUsageMBSeries] = useState<{ time: number; value: number }[]>(
    []
  );
  const { selectedCredentialId } = useDockerClient();

  useEffect(() => {
    const offStats = EventsOn('container:stats', (stats: StatsPayload) => {
      if (stats.containerId !== id) return;
      setStats(stats);

      const time = new Date(stats.time).getTime();
      setCpuSeries((serie) => {
        const next = [...serie, { time, value: Number(stats.cpuPercentage) }];
        return next.length > maxPoints ? next.slice(-maxPoints) : next;
      });
      setMemPctSeries((serie) => {
        const next = [...serie, { time, value: Number(stats.memoryPercentage) }];
        return next.length > maxPoints ? next.slice(-maxPoints) : next;
      });
      setMemUsageMBSeries((serie) => {
        const next = [...serie, { time, value: BytesToMB(stats.memoryUsage) }];
        return next.length > maxPoints ? next.slice(-maxPoints) : next;
      });
      if (!memoryLimitMBRef.current) memoryLimitMBRef.current = BytesToMB(stats.memoryLimit);
    });

    const offErr = EventsOn('container:stats:error', (event: any) => {
      if (event?.containerId === id) console.error('stats error:', event.error);
    });

    if (selectedCredentialId != null) {
      StartContainerStats(selectedCredentialId, id);
    }

    return () => {
      if (selectedCredentialId != null) {
        StopContainerStats(selectedCredentialId, id);
      }
      offStats();
      offErr();
    };
  }, [id, selectedCredentialId]);

  const header = useMemo(() => {
    if (!stats) return null;
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
    return {
      cpu: stats.cpuPercentage.toFixed(1),
      memoryUsage: mb(stats.memoryUsage),
      memoryLimit: mb(stats.memoryLimit),
      memoryPercentage: stats.memoryPercentage.toFixed(1),
      rx: mb(stats.rxBytes),
      tx: mb(stats.txBytes),
      pids: stats.pids,
      t: new Date(stats.time),
    };
  }, [stats]);

  if (selectedCredentialId == null) {
    return null;
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Métricas do contêiner"
      description={name}
      icon={<span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />}
      size="lg"
      className="h-fit min-h-[600px]"
    >
      <div className="grid grid-rows-[auto,1fr] h-full gap-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {header ? (
            <>
              <div className="rounded-lg border border-gray-300 dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl p-3">
                <div className="font-medium">CPU</div>
                <div className="text-2xl">{header.cpu}%</div>
              </div>
              <div className="rounded-lg border border-gray-300 dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl p-3">
                <div className="font-medium">Memória</div>
                <div className="text-2xl">
                  {header.memoryUsage} / {header.memoryLimit} MB ({header.memoryPercentage}%)
                </div>
              </div>
              <div className="rounded-lg border border-gray-300 dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl p-3">
                <div className="font-medium">Rede</div>
                <div>
                  RX {header.rx} MB · TX {header.tx} MB
                </div>
              </div>
              <div className="rounded-lg border border-gray-300 dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl p-3">
                <div className="font-medium">PIDs</div>
                <div>{header.pids}</div>
              </div>
            </>
          ) : (
            <div className="col-span-2 text-gray-500">Coletando métricas…</div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-auto">
          <div className="rounded-xl border border-gray-300 dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl p-3 pb-8 max-h-[280px]">
            <div className="mb-2 text-sm">CPU em tempo real</div>
            <CPUChart points={cpuSeries} />
          </div>

          <div className="rounded-xl border border-gray-300 dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl p-3 pb-8 max-h-[280px]">
            <div className="mb-2 text-sm">
              Memória em tempo real
            </div>
            <MemoryChart
              percentPoints={memoryPercentageSeries}
              usageMBPoints={memoryUsageMBSeries}
              limitMB={memoryLimitMBRef.current ?? undefined}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 place-items-center mt-2">
          <div className="rounded-xl border border-gray-300 dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl p-2 px-4 w-fit h-fit text-xs text-black dark:text-white">
            {header
              ? new Date(header.t).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })
              : 'aguardando primeiras amostras'}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ContainerStatsModal;
