import { ListVolumes } from '../../../../../wailsjs/go/handlers/DockerSdkHandlerStruct';
import { VolumeListResponse } from '../../../../interfaces/VolumeInterfaces';

const getSdkHandler = () => (window as any)?.go?.handlers?.DockerSdkHandlerStruct;

export const VolumeService = {
  async listVolumes(clientId: number): Promise<VolumeListResponse> {
    const response = await ListVolumes(clientId);
    return JSON.parse(response ?? '{}');
  },

  async deleteVolume(clientId: number, volumeName: string): Promise<void> {
    const sdk = getSdkHandler();
    if (!sdk?.DeleteVolume) {
      throw new Error('Função DeleteVolume não disponível');
    }
    await sdk.DeleteVolume(clientId, volumeName);
  },

  async inspectVolume(clientId: number, volumeName: string): Promise<string> {
    const sdk = getSdkHandler();
    if (!sdk?.InspectVolume) {
      throw new Error('Função InspectVolume não disponível');
    }
    return sdk.InspectVolume(clientId, volumeName);
  },

  async createVolume(
    clientId: number,
    options: { Name: string; Driver?: string; DriverOpts?: Record<string, string>; Labels?: Record<string, string> }
  ): Promise<string> {
    const sdk = getSdkHandler();
    if (!sdk?.CreateVolume) {
      throw new Error('Função CreateVolume não disponível');
    }
    const result = await sdk.CreateVolume(clientId, options);
    return typeof result === 'string' ? result : JSON.stringify(result);
  },
};
