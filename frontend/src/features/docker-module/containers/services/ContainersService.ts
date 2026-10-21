import toast from 'react-hot-toast';
import {
  ContainerStop,
  ContainerExec,
  TerminalWrite,
  TerminalClose,
  ContainerStart,
  ContainersList,
  ContainerPause,
  TerminalResize,
  ContainerRename,
  ContainerUnPause,
} from '../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { ContainerItem } from '../../../../interfaces/ContainerInterfaces';

export const getContainers = async (clientId: number): Promise<ContainerItem[]> => {
  try {
    const response = await ContainersList(clientId);
    return response || [];
  } catch (error: any) {
    toast.error(errorMessage(error));
    throw error;
  }
};

export const renameContainer = async (
  clientId: number,
  id: string,
  name: string
): Promise<void> => {
  try {
    await ContainerRename(clientId, id, name);
  } catch (error: any) {
    toast.error(errorMessage(error));
    throw error;
  }
};

export const toggleContainerState = async (
  clientId: number,
  id: string,
  state: string
): Promise<void> => {
  try {
    if (state === 'paused') await ContainerUnPause(clientId, id);
    else if (state === 'running') await ContainerPause(clientId, id);
  } catch (error: any) {
    toast.error(errorMessage(error));
    throw error;
  }
};

export const startContainer = async (
  clientId: number,
  id: string
): Promise<void> => {
  try {
    await ContainerStart(clientId, id);
    toast.success('Container iniciado com sucesso');
  } catch (error: any) {
    toast.error(errorMessage(error));
    throw error;
  }
};

export const stopContainer = async (
  clientId: number,
  id: string
): Promise<void> => {
  try {
    await ContainerStop(clientId, id);
    toast.success('Container parado com sucesso');
  } catch (error: any) {
    toast.error(errorMessage(error));
    throw error;
  }
};

export const containerExec = async (
  clientId: number,
  id: string
): Promise<void> => {
  await ContainerExec(clientId, id);
};

export const terminalWrite = async (id: string, data: string): Promise<void> => {
  await TerminalWrite(id, data);
};

export const terminalResize = async (
  clientId: number,
  id: string,
  cols: number,
  rows: number
): Promise<void> => {
  await TerminalResize(clientId, id, cols, rows);
};

export const terminalClose = async (id: string): Promise<void> => {
  await TerminalClose(id);
};
