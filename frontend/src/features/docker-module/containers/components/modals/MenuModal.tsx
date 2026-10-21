import toast from 'react-hot-toast';
import ContainerStatsModal from './ContainerStatsModal';
import React, { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../../shared/functions/ErrorMessage';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { FmtName } from '../../../../../features/shared/functions/TreatmentFunction';
import InspectModal from '../../../../../features/shared/components/modals/InspectModal';
import { ContainerProps } from '../../../../../interfaces/ContainerInterfaces';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';
import { BookSearch, ChartSpline, ClipboardList, RotateCcw, SquareTerminal, Trash2 } from 'lucide-react';
import { ContainerInspect, ContainerRemove, ContainerRestart } from '../../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';

const ContainersMenuModal: React.FC<ContainerProps> = ({
  id,
  name,
  isOpen,
  onDeleted,
  onOpenLogs,
  setMenuModal,
  onOpenTerminal,
}) => {
  const confirmToast = useConfirmToast();
  const { selectedCredentialId } = useDockerClient();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [inspectContent, setInspectContent] = useState<string | null>(null);

  const ensureClient = () => {
    if (selectedCredentialId == null) {
      toast.error('Escolha uma credencial Docker para executar esta ação.');
      return null;
    }
    return selectedCredentialId;
  };

  const handleInspect = async () => {
    try {
      const clientId = ensureClient();
      if (clientId == null) return;
      const result = await ContainerInspect(clientId, id);
      setInspectContent(
        typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2)
      );
      setMenuModal(false);
      setIsInspectOpen(true);
    } catch (error: any) {
      toast.error(errorMessage(error));
    }
  };

  const handleRestart = async () => {
    try {
      const clientId = ensureClient();
      if (clientId == null) return;
      setMenuModal(false);
      await ContainerRestart(clientId, id);
      toast.success(`Container ${FmtName([name])} reiniciado!`);
    } catch (error: any) {
      toast.error(errorMessage(error));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setMenuModal(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen, setMenuModal]);

  const handleDelete = () => {
    const clientId = ensureClient();
    if (clientId == null) return;
    setMenuModal(false);
    confirmToast({
      id,
      title: 'Excluir container?',
      message: `Tem certeza que deseja remover ${FmtName([name])}? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        const currentClientId = ensureClient();
        if (currentClientId == null) return;
        await ContainerRemove(currentClientId, id);
        onDeleted?.();
      },
    });
  };

  if (!isOpen && !isInspectOpen && !isStatsOpen) return null;

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    danger = false,
  }: {
    icon: any;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all cursor-pointer ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white'
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${
          danger ? 'opacity-100' : 'text-gray-400 group-hover:text-gray-600 dark:text-zinc-500 dark:group-hover:text-zinc-300'
        }`}
      />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      {isOpen && (
        <div
          ref={modalRef}
          className="absolute bottom-full right-0 mb-2 min-w-[190px] origin-bottom-right rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-1.5 shadow-2xl z-50"
        >
          <div className="flex flex-col gap-0.5">
            <MenuItem
              icon={SquareTerminal}
              label="Terminal"
              onClick={() => {
                onOpenTerminal();
                setMenuModal(false);
              }}
            />
            <MenuItem
              icon={ClipboardList}
              label="Ver Logs"
              onClick={() => {
                onOpenLogs();
                setMenuModal(false);
              }}
            />
            <MenuItem
              icon={ChartSpline}
              label="Estatísticas"
              onClick={() => {
                setMenuModal(false);
                setIsStatsOpen(true);
              }}
            />
            <MenuItem
              icon={BookSearch}
              label="Inspecionar"
              onClick={handleInspect}
            />

            <div className="my-1 h-px bg-gray-100 dark:bg-white/5" />

            <MenuItem
              icon={RotateCcw}
              label="Reiniciar"
              onClick={handleRestart}
            />
            <MenuItem
              icon={Trash2}
              label="Excluir"
              onClick={handleDelete}
              danger
            />
          </div>
        </div>
      )}

      {isInspectOpen && (
        <InspectModal
          title="Inspect do container"
          name={`${FmtName([name])}`}
          data={inspectContent}
          onClose={() => setIsInspectOpen(false)}
        />
      )}

      {isStatsOpen && (
        <ContainerStatsModal id={id} name={FmtName([name])} onClose={() => setIsStatsOpen(false)} />
      )}
    </>
  );
};

export default ContainersMenuModal;
