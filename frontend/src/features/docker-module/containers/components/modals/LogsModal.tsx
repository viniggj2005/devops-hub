import iziToast from 'izitoast';
import { Search } from 'lucide-react';
import 'izitoast/dist/css/iziToast.min.css';
import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { LogsProps } from '../../../../../interfaces/ContainerInterfaces';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ContainerLogs } from '../../../../../../wailsjs/go/dockerHandlers/DockerSdkHandlerStruct';

const LogsModal: React.FC<LogsProps> = ({ id, setLogsModal }) => {
  const firstScrollDone = useRef(false);
  const [filter, setFilter] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [containerLogs, setContainerLogs] = useState<string>('');
  const { selectedCredentialId } = useDockerClient();

  useEffect(() => {
    (async () => {
      if (selectedCredentialId == null) {
        iziToast.error({
          title: 'Credencial não selecionada',
          message: 'Escolha uma credencial Docker para visualizar os logs.',
          position: 'bottomRight',
        });
        setLogsModal(false);
        return;
      }
      try {
        const containerLogs = await ContainerLogs(selectedCredentialId, id);
        iziToast.success({
          message: 'Logs buscados com sucesso!',
          position: 'bottomRight',
        });
        setContainerLogs(containerLogs ?? '');
      } catch (error: any) {
        iziToast.error({
          title: 'Erro',
          message: error?.message ?? String(error),
          position: 'bottomRight',
        });
      }
    })();
  }, [id, selectedCredentialId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || firstScrollDone.current) return;
    if (containerLogs) {
      el.scrollTop = el.scrollHeight;
      firstScrollDone.current = true;
    }
  }, [containerLogs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLogsModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setLogsModal]);

  const display = filter
    ? containerLogs
      .split(/<br\s*\/?>/i)
      .filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
      .join('<br>')
    : containerLogs;

  const closeOnBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setLogsModal(false);
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => setLogsModal(false)}
      title="Logs do contêiner"
      description={id.slice(0, 12)}
      icon={<span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />}
      size="lg"
      className="h-[min(80vh,650px)]"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="relative w-full">
            <Search className="pointer-events-none z-10 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrar logs..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border backdrop-blur-sm transition-all outline-none bg-white/80 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20"
              autoFocus
            />
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 rounded-xl bg-gray-50 dark:bg-zinc-950 font-mono text-xs border border-gray-200 dark:border-white/5 text-gray-700 dark:text-gray-300"
          dangerouslySetInnerHTML={{ __html: display }}
        />
      </div>
    </Modal>
  );
};

export default LogsModal;
