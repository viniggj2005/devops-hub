import iziToast from 'izitoast';
import {
  ContainerStop,
  ContainerExec,
  TerminalWrite,
  ContainerStart,
  ContainersList,
  ContainerPause,
  TerminalResize,
  ContainerRename,
  ContainerUnPause,
} from '../../../../../wailsjs/go/handlers/DockerSdkHandlerStruct';
import { ContainerItem } from '../../../../interfaces/ContainerInterfaces';

export const getContainers = async (clientId: number): Promise<ContainerItem[]> => {
  try {
    const response = await ContainersList(clientId);
    return response || [];
  } catch (error: any) {
    iziToast.error({ title: 'Erro', message: error, position: 'bottomRight' });
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
    iziToast.error({ title: 'Erro', message: error, position: 'bottomRight' });
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
    iziToast.error({ title: 'Erro', message: error, position: 'bottomRight' });
    throw error;
  }
};

export const startContainer = async (
  clientId: number,
  id: string
): Promise<void> => {
  try {
    await ContainerStart(clientId, id);
    iziToast.success({
      title: 'Sucesso',
      message: 'Container iniciado com sucesso',
      position: 'bottomRight',
    });
  } catch (error: any) {
    iziToast.error({ title: 'Erro', message: error, position: 'bottomRight' });
    throw error;
  }
};

export const stopContainer = async (
  clientId: number,
  id: string
): Promise<void> => {
  try {
    await ContainerStop(clientId, id);
    iziToast.success({
      title: 'Sucesso',
      message: 'Container parado com sucesso',
      position: 'bottomRight',
    });
  } catch (error: any) {
    iziToast.error({ title: 'Erro', message: error, position: 'bottomRight' });
    throw error;
  }
};

export const containerExec = async (
  clientId: number,
  id: string
): Promise<void> => {
  try {
    await ContainerExec(clientId, id);
  } catch (error: any) {
    throw error;
  }
};

export const terminalWrite = async (id: string, data: string): Promise<void> => {
  try {
    await TerminalWrite(id, data);
  } catch (error: any) {
    throw error;
  }
};

export const terminalResize = async (
  clientId: number,
  id: string,
  cols: number,
  rows: number
): Promise<void> => {
  try {
    await TerminalResize(clientId, id, cols, rows);
  } catch (error: any) {
    throw error;
  }
};
