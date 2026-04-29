import React, { useState } from 'react';
import LogsModal from '../modals/LogsModal';
import StatusBadge from '../badges/StatusBadge';
import ContainersMenuModal from '../modals/MenuModal';
import { FmtAgo } from '../../../../../features/shared/functions/TreatmentFunction';
import EditContainerNameModal from '../modals/EditContainerNameModal';
import { ContainerCardProps } from '../../../../../interfaces/ContainerInterfaces';
import { Copy, EllipsisVertical, LoaderCircle, MoveRight, Pause, Pencil, Play, Square } from 'lucide-react';


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

  return (
    <div className="group relative flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl">

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white" title={name}>
              {name}
            </h3>

            {!isEditing && (
              <button
                onClick={onOpenEdit}
                className="opacity-0 transition-opacity group-hover:opacity-100 text-gray-400 hover:text-blue-500"
                title="Renomear container"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600 dark:border-white/5 dark:bg-white/5 dark:text-gray-400"
              title={container.Image}
            >
              <span className="truncate">{container.Image}</span>
            </span>
          </div>

          {isEditing && (
            <div className="absolute left-0 top-0 z-10 w-full p-2">
              <div className="rounded-lg bg-white p-4 shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10">
                <EditContainerNameModal
                  name={name}
                  id={container.Id}
                  handleRename={onRename}
                  setEditNameModal={onCloseEdit}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          <StatusBadge state={container.State} title={container.Status || container.State} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-2">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Criado</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{FmtAgo(container.Created)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Status</p>
          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300" title={container.Status}>{container.Status || '—'}</p>
        </div>
      </div>

      {container?.Ports && container.Ports.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Portas</p>
          <div className="flex flex-wrap gap-2">
            {container.Ports.map((port) => (
              <div
                key={`${port.IP}-${port.PrivatePort}-${port.Type ?? ''}`}
                className="flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-mono text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
              >
                <span className="opacity-75">{port.PrivatePort}</span>
                <MoveRight className="text-gray-400" />
                <span className="font-semibold text-blue-600 dark:text-blue-400">{port.PublicPort}</span>
                <span className="text-[9px] uppercase opacity-50">/{port.Type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/5">

        <div className="flex gap-1">
          <button
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
            className={`group/btn flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 ${container.State === 'running'
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'
              }`}
            title={container.State === 'running' ? 'Parar' : 'Iniciar'}
          >
            {loading ? <LoaderCircle className="animate-spin" /> : container.State === 'running' ? <Square size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={() => onTogglePause(container.Id, container.State)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-600 transition-all hover:bg-amber-100 hover:text-amber-600 active:scale-95 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-400"
            title={container.State === 'paused' ? 'Retomar' : 'Pausar'}
          >
            {container.State === 'paused' ? <Play size={18} /> : <Pause size={18} />}
          </button>

          <button
            onClick={() => navigator.clipboard.writeText(container.Id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-600 transition-all hover:bg-blue-100 hover:text-blue-600 active:scale-95 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-400"
            title="Copiar ID"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className="relative flex items-center gap-1">
          <button
            onClick={() => (isOpened ? onCloseMenu() : onOpenMenu())}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <EllipsisVertical size={18} />
          </button>

          {isOpened && (
            <ContainersMenuModal
              id={container.Id}
              isOpen={!!isOpened}
              onDeleted={onDeleted}
              onOpenLogs={onOpenLogs}
              setMenuModal={onCloseMenu}
              onOpenTerminal={onOpenTerminal}
              name={container.Names?.[0] ?? name}
            />
          )}
        </div>
      </div>

      {isSeeing && <LogsModal id={container.Id} setLogsModal={onCloseLogs} />}
    </div>
  );
};

export default ContainerCard;
