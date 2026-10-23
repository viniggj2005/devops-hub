import { VolumeListResponse } from '../../../../interfaces/VolumeInterfaces';
import * as volumeModels from '../../../../../bindings/github.com/docker/docker/api/types/volume/models';
import {
  ListVolumes,
  CreateVolume,
  DeleteVolume,
  InspectVolume,
} from '../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';

export const VolumeService = {
  async listVolumes(clientId: number): Promise<VolumeListResponse> {
    const response = await ListVolumes(clientId);
    return JSON.parse(response ?? '{}');
  },

  async deleteVolume(clientId: number, volumeName: string): Promise<void> {
    await DeleteVolume(clientId, volumeName);
  },

  async inspectVolume(clientId: number, volumeName: string): Promise<string> {
    return await InspectVolume(clientId, volumeName);
  },

  async createVolume(
    clientId: number,
    options: { Name: string; Driver?: string; DriverOpts?: Record<string, string>; Labels?: Record<string, string> }
  ): Promise<string> {
    const createOptions = new volumeModels.CreateOptions({
      Name: options.Name,
      Driver: options.Driver ?? 'local',
      Labels: options.Labels ?? {},
      DriverOpts: options.DriverOpts ?? {},
    });
    const result = await CreateVolume(clientId, createOptions);
    return typeof result === 'string' ? result : JSON.stringify(result);
  },
};
