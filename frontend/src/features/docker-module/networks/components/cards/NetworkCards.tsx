import iziToast from 'izitoast';
import { Copy, Info, Trash2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { NetworkService } from '../../services/NetworkService';
import { FmtAgo } from '../../../../../features/shared/functions/TreatmentFunction';
import { NetworkItem } from '../../../../../interfaces/NetworkInterfaces';
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
  EnableIPv4,
  EnableIPv6,
}) => {
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isInspectLoading, setIsInspectLoading] = useState(false);
  const [inspectData, setInspectData] = useState<string | null>(null);
  const confirmToast = useConfirmToast();
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  const handleOpenInspect = useCallback(async () => {
    try {
      setIsInspectLoading(true);
      const data = await NetworkService.InspectNetwork(clientId, Id);
      const formattedData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      setInspectData(formattedData);
      setIsInspectOpen(true);
    } catch (error) {
      iziToast.error({ title: 'Erro', message: 'Erro ao buscar dados de inspeção.', position: 'bottomRight' });
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
      title: 'Rede removida com sucesso!',
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
      <div className="group relative flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white" title={Name}>
                {Name}
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:border-white/5 dark:bg-white/5 dark:text-gray-400">
                <span className="opacity-50">Driver:</span> {Driver}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:border-white/5 dark:bg-white/5 dark:text-gray-400">
                <span className="opacity-50">Scope:</span> {Scope}
              </span>
            </div>
          </div>

          <div className="flex gap-1">
            <button
              onClick={handleOpenInspect}
              disabled={isInspectLoading}
              title="Inspecionar rede"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={() => copyToClipboard(Id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
              title="Copiar ID"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              title="Remover rede"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 dark:border-white/5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Subnet</p>
            <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300 font-mono" title={mainSubnet}>{mainSubnet}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Gateway</p>
            <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300 font-mono" title={mainGateway}>{mainGateway}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Configuração</p>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className={Internal ? "text-emerald-500" : "text-gray-400"}>{Internal ? 'Internal' : 'External'}</span>
              <span>•</span>
              <span className={Attachable ? "text-emerald-500" : "text-gray-400"}>{Attachable ? 'Attachable' : 'Non-attachable'}</span>
              <span>•</span>
              <span className={Ingress ? "text-purple-500" : "text-gray-400"}>{Ingress ? 'Ingres' : 'No Ingress'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Criado</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{createdTimestamp ? FmtAgo(createdTimestamp) : '—'}</p>
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
      )
      }
    </>
  );
};

export default NetworkCards;
