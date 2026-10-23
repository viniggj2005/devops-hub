import toast from 'react-hot-toast';
import React, { useCallback, useState } from 'react';
import { Copy, Info, Network, Trash2 } from 'lucide-react';
import { NetworkService } from '../../services/NetworkService';
import { NetworkItem } from '../../../../../interfaces/NetworkInterfaces';
import { copyToClipboard } from '../../../../../features/shared/functions/clipboard';
import { FmtAgo } from '../../../../../features/shared/functions/TreatmentFunction';
import InspectModal from '../../../../../features/shared/components/modals/InspectModal';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';

interface NetworkCardProps extends NetworkItem {
  clientId: number;
  onDeleted?: (networkId: string) => void;
}

const NetworkCards: React.FC<NetworkCardProps> = ({
  Id,
  Name,
  IPAM,
  Scope,
  Driver,
  Created,
  Ingress,
  clientId,
  Internal,
  onDeleted,
  Attachable,
}) => {
  const confirmToast = useConfirmToast();
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isInspectLoading, setIsInspectLoading] = useState(false);
  const [inspectData, setInspectData] = useState<string | null>(null);

  const handleOpenInspect = useCallback(async () => {
    try {
      setIsInspectLoading(true);
      const data = await NetworkService.InspectNetwork(clientId, Id);
      const formattedData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      setInspectData(formattedData);
      setIsInspectOpen(true);
    } catch {
      toast.error('Erro ao buscar dados de inspeção.');
    } finally {
      setIsInspectLoading(false);
    }
  }, [clientId, Id]);

  const handleCloseInspect = useCallback(() => {
    setIsInspectOpen(false);
  }, []);

  const handleDelete = useCallback(() => {
    confirmToast({
      id: Id,
      title: 'Remover rede?',
      message: `Deseja remover a rede "${Name}"?`,
      onConfirm: async () => {
        setDeleteLoading(true);
        try {
          await NetworkService.deleteNetwork(clientId, Id);
          onDeleted?.(Id);
        } catch (error) {
          throw error instanceof Error ? error : new Error('Erro ao remover a rede.');
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  }, [Id, Name, clientId, confirmToast, onDeleted]);

  const mainSubnet = IPAM?.Config?.[0]?.Subnet ?? '—';
  const mainGateway = IPAM?.Config?.[0]?.Gateway ?? '—';
  const createdTimestamp = Created ? new Date(Created).getTime() : undefined;

  return (
    <>
      <div className="group relative flex flex-col gap-4 rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/60 p-5 shadow-sm transition-all hover:border-blue-500/30 dark:hover:border-white/15">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Network className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white" title={Name}>
                  {Name}
                </h3>
                <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">
                  {Id.slice(0, 12)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400">
                  Driver: {Driver}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400">
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
              title="Inspecionar rede"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(Id.slice(0, 12), 'ID da rede copiado')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
              title="Copiar ID"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer"
              title="Remover rede"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 dark:border-white/[0.05]">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Subnet
            </p>
            <p className="truncate text-xs font-semibold text-gray-700 dark:text-zinc-300 font-mono" title={mainSubnet}>
              {mainSubnet}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Gateway
            </p>
            <p className="truncate text-xs font-semibold text-gray-700 dark:text-zinc-300 font-mono" title={mainGateway}>
              {mainGateway}
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Propriedades
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-600 dark:text-zinc-400">
              <span className={Internal ? 'text-emerald-500 font-medium' : ''}>
                {Internal ? 'Internal' : 'External'}
              </span>
              <span>•</span>
              <span className={Attachable ? 'text-blue-500 font-medium' : ''}>
                {Attachable ? 'Attachable' : 'Non-attachable'}
              </span>
              {Ingress && (
                <>
                  <span>•</span>
                  <span className="text-purple-500 font-medium">Ingress</span>
                </>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Criado
            </p>
            <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              {createdTimestamp ? FmtAgo(createdTimestamp) : '—'}
            </p>
          </div>
        </div>
      </div>

      {isInspectOpen && (
        <InspectModal
          title="Inspect Network"
          name={Name}
          data={inspectData || ''}
          onClose={handleCloseInspect}
        />
      )}
    </>
  );
};

export default NetworkCards;
