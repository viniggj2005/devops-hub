import iziToast from 'izitoast';
import ContainerStatsModal from './ContainerStatsModal';
import React, { useEffect, useRef, useState } from 'react';
import { FmtName } from '../../../../../features/shared/functions/TreatmentFunction';
import InspectModal from '../../../../../features/shared/components/modals/InspectModal';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ContainerProps } from '../../../../../interfaces/ContainerInterfaces';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';
import { BookSearch, ChartSpline, ClipboardList, RotateCcw, SquareTerminal, Trash2 } from 'lucide-react';
import { ContainerRemove, ContainerInspect, ContainerRestart } from '../../../../../../wailsjs/go/dockerHandlers/DockerSdkHandlerStruct';

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
      iziToast.error({
        title: 'Credencial não selecionada',
        message: 'Escolha uma credencial Docker para executar esta ação.',
        position: 'bottomRight',
      });
      return null;
    }
    return selectedCredentialId;
  };

  const handleInspect = async () => {
    try {
      const clientId = ensureClient();
      if (clientId == null) return;
      const inspectContent = await ContainerInspect(clientId, id);
      setInspectContent(
        typeof inspectContent === 'string'
          ? inspectContent
          : JSON.stringify(inspectContent, null, 2)
      );
      iziToast.success({
        title: 'Sucesso!',
        message: 'Dados inspecionados com sucesso!',
        position: 'bottomRight',
      });
      setIsInspectOpen(true);
    } catch (error: any) {
      iziToast.error({ title: 'Erro', message: String(error), position: 'bottomRight' });
    }
  };

  const handleRestart = async () => {
    try {
      const clientId = ensureClient();
      if (clientId == null) return;
      await ContainerRestart(clientId, id);
      iziToast.success({ title: 'Reiniciado', message: `Container ${name} reiniciado!`, position: 'bottomRight' });
      setMenuModal?.(false);
    } catch (error: any) {
      iziToast.error({ title: 'Erro', message: String(error), position: 'bottomRight' });
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
    confirmToast({
      id,
      title: `Excluir container?`,
      message: `Tem certeza que deseja remover ${name}? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        const clientId = ensureClient();
        if (clientId == null) return;
        await ContainerRemove(clientId, id);
        onDeleted?.();
        setMenuModal?.(false);
      },
    });
  };

  if (!isOpen) return null;

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    danger = false
  }: { icon: any, label: string, onClick: () => void, danger?: boolean }) => (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all
        ${danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
        }`}
    >
      <Icon className={`h-4 w-4 ${danger ? 'opacity-100' : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`} />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <div
        ref={modalRef}
        className="absolute bottom-full right-0 mb-2 min-w-[200px] origin-bottom-right rounded-xl border border-gray-100 bg-white/90 p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 dark:border-white/5 dark:bg-[#1e293b]/90 z-50"
      >
        <div className="flex flex-col gap-0.5">
          <MenuItem
            icon={SquareTerminal}
            label="Terminal"
            onClick={() => { onOpenTerminal(); setMenuModal(false); }}
          />
          <MenuItem
            icon={ClipboardList}
            label="Ver Logs"
            onClick={onOpenLogs}
          />
          <MenuItem
            icon={ChartSpline}
            label="Estatísticas"
            onClick={() => setIsStatsOpen(true)}
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

      {isInspectOpen && (
        <InspectModal
          title="Inspect do container"
          name={`${FmtName([name])}`}
          data={inspectContent}
          onClose={() => setIsInspectOpen(false)}
        />
      )}

      {isStatsOpen && (
        <ContainerStatsModal id={id} name={name} onClose={() => setIsStatsOpen(false)} />
      )}
    </>
  );
};

export default ContainersMenuModal;
