import React, { useState } from 'react';
import LogsModal from '../modals/LogsModal';
import StatusBadge from '../badges/StatusBadge';
import ContainersMenuModal from '../modals/MenuModal';
import EditContainerNameModal from '../modals/EditContainerNameModal';
import { copyToClipboard } from '../../../../../features/shared/functions/clipboard';
import { FmtAgo } from '../../../../../features/shared/functions/TreatmentFunction';
import { ContainerCardProps } from '../../../../../interfaces/ContainerInterfaces';
import { Copy, EllipsisVertical, LoaderCircle, MoveRight, Pause, Pencil, Play, Square, SquareTerminal } from 'lucide-react';

const ContainerCard: React.FC<ContainerCardProps> = ({
  name,
  onStop,
  onStart,
  onRename,
  isSeeing,
  isOpened,
  container,
  isEditing,
  onDeleted,
  onOpenLogs,
  onOpenMenu,
  onOpenEdit,
  onCloseLogs,
  onCloseMenu,
  onCloseEdit,
  onTogglePause,
  onOpenTerminal,
}) => {
  const [loading, setLoading] = useState(false);
  const canPauseOrResume = container.State === 'running' || container.State === 'paused';

  return (
    <div className="group relative flex flex-col gap-4 rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/60 p-5 shadow-sm transition-all hover:border-blue-500/30 dark:hover:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold tracking-tight text-gray-900 dark:text-white" title={name}>
              {name}
            </h3>

            <button
              type="button"
              onClick={onOpenEdit}
              className="opacity-0 transition-opacity group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 cursor-pointer"
              title="Renomear container"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[11px] font-mono text-gray-600 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400"
              title={container.Image}
            >
              <span className="truncate">{container.Image}</span>
            </span>
            <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">
              {container.Id.slice(0, 12)}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <StatusBadge state={container.State} title={container.Status || container.State} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-2 border-t border-gray-100 dark:border-white/[0.05]">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            Criado
          </p>
          <p className="text-xs font-medium text-gray-700 dark:text-zinc-300">
            {FmtAgo(container.Created)}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            Status
          </p>
          <p className="truncate text-xs font-medium text-gray-700 dark:text-zinc-300" title={container.Status}>
            {container.Status || '—'}
          </p>
        </div>
      </div>

      {container?.Ports && container.Ports.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-100 pt-3 dark:border-white/[0.05]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            Portas Mapeadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {container.Ports.map((port, index) => (
              <div
                key={`${port.IP ?? ''}-${port.PublicPort ?? ''}-${port.PrivatePort}-${port.Type ?? ''}-${index}`}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[11px] font-mono text-gray-600 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400"
              >
                <span className="opacity-75">{port.PrivatePort}</span>
                {port.PublicPort && (
                  <>
                    <MoveRight className="w-3 h-3 text-gray-400" />
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{port.PublicPort}</span>
                  </>
                )}
                <span className="text-[9px] uppercase opacity-50">/{port.Type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3.5 dark:border-white/[0.05]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                if (container.State === 'running') await onStop(container.Id);
                else await onStart(container.Id);
              } finally {
                setLoading(false);
              }
            }}
            className={`flex h-8 px-2.5 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              container.State === 'running'
                ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400'
                : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
            }`}
            title={container.State === 'running' ? 'Parar container' : 'Iniciar container'}
          >
            {loading ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            ) : container.State === 'running' ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Parar</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Iniciar</span>
              </>
            )}
          </button>

          {canPauseOrResume && (
            <button
              type="button"
              onClick={() => onTogglePause(container.Id, container.State)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-all hover:bg-amber-500/15 hover:text-amber-600 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-400 cursor-pointer"
              title={container.State === 'paused' ? 'Retomar container' : 'Pausar container'}
            >
              {container.State === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}

          {container.State === 'running' && (
            <button
              type="button"
              onClick={onOpenTerminal}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-all hover:bg-blue-500/15 hover:text-blue-600 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-400 cursor-pointer"
              title="Abrir terminal interativo"
            >
              <SquareTerminal className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => copyToClipboard(container.Id.slice(0, 12), 'ID do container copiado')}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-all hover:bg-blue-500/15 hover:text-blue-600 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-400 cursor-pointer"
            title="Copiar ID"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => (isOpened ? onCloseMenu() : onOpenMenu())}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
            title="Mais opções"
          >
            <EllipsisVertical className="w-4 h-4" />
          </button>

          <ContainersMenuModal
            id={container.Id}
            isOpen={Boolean(isOpened)}
            onDeleted={onDeleted}
            onOpenLogs={onOpenLogs}
            setMenuModal={onCloseMenu}
            onOpenTerminal={onOpenTerminal}
            name={container.Names?.[0] ?? name}
          />
        </div>
      </div>

      {isEditing && (
        <EditContainerNameModal
          name={name}
          id={container.Id}
          handleRename={onRename}
          setEditNameModal={onCloseEdit}
        />
      )}

      {isSeeing && <LogsModal id={container.Id} setLogsModal={onCloseLogs} />}
    </div>
  );
};

export default ContainerCard;
