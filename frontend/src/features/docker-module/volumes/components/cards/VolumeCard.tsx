import React, { useCallback, useState } from 'react';
import { HardDrive, Info, Trash2 } from 'lucide-react';
import { VolumeService } from '../../services/VolumeService';
import { VolumeItem } from '../../../../../interfaces/VolumeInterfaces';
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
      setInspectData(data);
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
      title: 'Remover Volume?',
      message: `Tem certeza que deseja remover o volume "${Name}"?\nEsta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          setDeleteLoading(true);
          await VolumeService.deleteVolume(clientId, Name);
          onDeleted?.(Name);
        } catch (error) {
          console.error(error);
          alert('Erro ao remover volume. Verifique os logs.');
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  }, [clientId, Name, onDeleted, confirmToast]);

  const createdDate = CreatedAt ? new Date(CreatedAt) : null;
  const createdLabel = createdDate ? createdDate.toLocaleString() : '—';

  return (
    <>
      <div className="group relative flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl">

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
              <HardDrive className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white" title={Name}>
                {Name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-white/5 dark:bg-white/5 dark:text-gray-400">
                  {Driver}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-white/5 dark:bg-white/5 dark:text-gray-400">
                  {Scope}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-1">
            <button
              onClick={handleOpenInspect}
              disabled={isInspectLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
              title="Inspecionar"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 dark:border-white/5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Tamanho</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {UsageData?.Size ? FormatBytes(UsageData.Size) : '—'}
              {UsageData?.RefCount !== undefined && (
                <span className="ml-1 text-xs text-gray-400 font-normal">• {UsageData.RefCount} refs</span>
              )}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Criado em</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{createdLabel}</p>
          </div>
        </div>

        <div className="space-y-1 rounded-lg bg-gray-50 p-3 dark:bg-black/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Ponto de Montagem</p>
          <p className="break-all font-mono text-[10px] text-gray-600 dark:text-gray-400">
            {Mountpoint ?? '—'}
          </p>
        </div>

      </div>
      {isInspectOpen && (
        <InspectModal title="Inspect Volume" name={Name} data={inspectData || ''} onClose={handleCloseInspect} />
      )}
    </>
  );
};

export default VolumeCard;
