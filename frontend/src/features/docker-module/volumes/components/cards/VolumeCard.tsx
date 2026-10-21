import React, { useCallback, useState } from 'react';
import { VolumeService } from '../../services/VolumeService';
import { Copy, HardDrive, Info, Trash2 } from 'lucide-react';
import { VolumeItem } from '../../../../../interfaces/VolumeInterfaces';
import { copyToClipboard } from '../../../../../features/shared/functions/clipboard';
import InspectModal from '../../../../../features/shared/components/modals/InspectModal';
import { FormatBytes } from '../../../../../features/shared/functions/TreatmentFunction';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';

interface VolumeCardProps extends VolumeItem {
  clientId: number;
  onDeleted?: (name: string) => void;
}

const VolumeCard: React.FC<VolumeCardProps> = ({
  Name,
  Scope,
  Driver,
  clientId,
  UsageData,
  onDeleted,
  CreatedAt,
  Mountpoint,
}) => {
  const confirmToast = useConfirmToast();
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isInspectLoading, setIsInspectLoading] = useState(false);
  const [inspectData, setInspectData] = useState<string | null>(null);

  const handleOpenInspect = useCallback(async () => {
    try {
      setIsInspectLoading(true);
      const data = await VolumeService.inspectVolume(clientId, Name);
      const formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      setInspectData(formatted);
      setIsInspectOpen(true);
    } catch (error) {
      console.error(error);
      setInspectData('Erro ao buscar dados de inspeção.');
      setIsInspectOpen(true);
    } finally {
      setIsInspectLoading(false);
    }
  }, [clientId, Name]);

  const handleCloseInspect = useCallback(() => {
    setIsInspectOpen(false);
  }, []);

  const handleDelete = useCallback(async () => {
    confirmToast({
      id: `delete-volume-${Name}`,
      title: 'Remover volume?',
      message: `Tem certeza que deseja remover o volume "${Name}"?\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        setDeleteLoading(true);
        try {
          await VolumeService.deleteVolume(clientId, Name);
          onDeleted?.(Name);
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  }, [clientId, Name, onDeleted, confirmToast]);

  const createdDate = CreatedAt ? new Date(CreatedAt) : null;
  const createdLabel = createdDate ? createdDate.toLocaleString('pt-BR') : '—';

  return (
    <>
      <div className="group relative flex flex-col gap-4 rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/60 p-5 shadow-sm transition-all hover:border-blue-500/30 dark:hover:border-white/15">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white" title={Name}>
                {Name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center rounded-md border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400">
                  Driver: {Driver}
                </span>
                <span className="inline-flex items-center rounded-md border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400">
                  Scope: {Scope}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleOpenInspect}
              disabled={isInspectLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
              title="Inspecionar volume"
            >
              <Info className="h-4 w-4" />
            </button>
            {Mountpoint && (
              <button
                type="button"
                onClick={() => copyToClipboard(Mountpoint, 'Ponto de montagem copiado')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
                title="Copiar ponto de montagem"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer"
              title="Excluir volume"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 dark:border-white/[0.05]">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Tamanho
            </p>
            <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              {UsageData?.Size ? FormatBytes(UsageData.Size) : '—'}
              {UsageData?.RefCount !== undefined && (
                <span className="ml-1 text-[11px] text-gray-400 dark:text-zinc-500 font-normal">
                  • {UsageData.RefCount} refs
                </span>
              )}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Criado em
            </p>
            <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              {createdLabel}
            </p>
          </div>
        </div>

        <div className="space-y-1 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-100 dark:border-white/[0.05] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            Ponto de Montagem
          </p>
          <p className="break-all font-mono text-[11px] text-gray-600 dark:text-zinc-400">
            {Mountpoint ?? '—'}
          </p>
        </div>
      </div>

      {isInspectOpen && (
        <InspectModal
          title="Inspect Volume"
          name={Name}
          data={inspectData || ''}
          onClose={handleCloseInspect}
        />
      )}
    </>
  );
};

export default VolumeCard;
