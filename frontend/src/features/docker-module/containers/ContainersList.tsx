import iziToast from 'izitoast';
import ContainerCard from './components/cards/ContainerCard';
import { FmtName } from '../../shared/functions/TreatmentFunction';
import { ContainerItem } from '../../../interfaces/ContainerInterfaces';
import { useDockerClient } from '../../../contexts/DockerClientContext';
import { useTerminalStore } from '../../ferretShell-module/terminal/TerminalStore';
import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { getContainers, stopContainer, startContainer, renameContainer, toggleContainerState } from './services/ContainersService';

export interface ContainersListFetchRef {
  refresh: () => Promise<void>;
}

const ContainersListView = forwardRef<ContainersListFetchRef>((_, ref) => {
  const timerRef = useRef<number | null>(null);
  const [LogsModalId, setLogsModalId] = useState<string | null>(null);
  const [MenuModalId, setMenuModalId] = useState<string | null>(null);
  const [containers, setcontainers] = useState<ContainerItem[] | null>(null);
  const [editNameModalId, setEditNameModalId] = useState<string | null>(null);
  const { dockerClientId, loading: credentialsLoading, connecting } = useDockerClient();

  const fetchContainers = useCallback(async () => {
    if (dockerClientId == null) {
      setcontainers(null);
      return;
    }
    const containersList = await getContainers(dockerClientId);
    setcontainers(containersList);
  }, [dockerClientId]);

  useImperativeHandle(ref, () => ({
    refresh: fetchContainers
  }));

  const handleRename = async (name: string, id: string) => {
    if (dockerClientId == null) return;
    await renameContainer(dockerClientId, id, name);
    await fetchContainers();
    setEditNameModalId(null);
  };

  const changeContainerStage = async (id: string, state: string) => {
    if (dockerClientId == null) return;
    await toggleContainerState(dockerClientId, id, state);
    await fetchContainers();
  };

  useEffect(() => {
    if (dockerClientId == null) {
      setcontainers(null);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    fetchContainers();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(fetchContainers, 2000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [fetchContainers, dockerClientId]);

  useEffect(() => {
    if (credentialsLoading) {
      iziToast.info({
        title: 'Carregando',
        message: 'Carregando credenciais...',
        position: 'bottomRight',
      });
    } else if (dockerClientId == null) {
      if (!connecting) {
        iziToast.warning({
          title: 'Atenção',
          message: 'Selecione uma credencial Docker para visualizar os containers.',
          position: 'bottomRight',
        });
      }
    } else if (connecting) {
      iziToast.info({
        title: 'Conectando',
        message: 'Conectando ao daemon Docker remoto...',
        position: 'bottomRight',
      });
    } else if (!containers) {
      iziToast.info({
        title: 'Buscando',
        message: 'Buscando contêineres...',
        position: 'bottomRight',
      });
    } else if (containers.length === 0) {
      iziToast.info({
        title: 'Vazio',
        message: 'Nenhum container encontrado.',
        position: 'bottomRight',
      });
    }
  }, [credentialsLoading, dockerClientId, connecting, containers]);

  const handleStart = async (id: string) => {
    if (dockerClientId == null) return;
    await startContainer(dockerClientId, id);
    await fetchContainers();
  };

  const handleStop = async (id: string) => {
    if (dockerClientId == null) return;
    await stopContainer(dockerClientId, id);
    await fetchContainers();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {containers &&
        containers.length > 0 &&
        containers.map((container) => {
          const name = FmtName(container.Names);
          const isSeeing = LogsModalId === container.Id;
          const isOpened = MenuModalId === container.Id;
          const isEditing = editNameModalId === container.Id;

          return (
            <ContainerCard
              name={name}
              isSeeing={isSeeing}
              isOpened={isOpened}
              container={container}
              isEditing={isEditing}
              onRename={handleRename}
              onStart={handleStart}
              onStop={handleStop}
              onTogglePause={changeContainerStage}
              onCloseLogs={() => setLogsModalId(null)}
              onCloseMenu={() => setMenuModalId(null)}
              onCloseEdit={() => setEditNameModalId(null)}
              onOpenLogs={() => setLogsModalId(container.Id)}
              onOpenMenu={() => setMenuModalId(container.Id)}
              onOpenEdit={() => setEditNameModalId(container.Id)}
              onOpenTerminal={() => {
                useTerminalStore.getState().createTab({ 
                  title: `Exec: ${container.Names[0] || 'Container'}`, 
                  containerId: container.Id, 
                  containerName: container.Names[0] || 'Container' 
                });
              }}
              onDeleted={async () => {
                await fetchContainers();
                setMenuModalId(null);
              }}
            />
          );


        })}

      <footer className="mt-6 text-xs text-gray-500 dark:text-zinc-400">
        Atualiza a cada 2s. Clique em “Atualizar” para forçar agora.
      </footer>
    </div>
  );
});

export default ContainersListView;
