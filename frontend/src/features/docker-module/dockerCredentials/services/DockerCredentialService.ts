import { mapCredential, toBase64 } from '../functions/treatmentFunctions';
import { AddDockerClient } from '../../../../../wailsjs/go/dockerHandlers/DockerSdkHandlerStruct';
import { DockerCredentialSummary, CreateDockerCredentialPayload } from '../../../../interfaces/DockerCredentialInterfaces';
import { FindAllByUser, CreateDockerConnection, DeleteDockerConnection } from '../../../../../wailsjs/go/dockerHandlers/DockerHandlerStruct';

export const DockerCredentialService = {
  async create(token: string, payload: CreateDockerCredentialPayload): Promise<void> {
    const body = {
      url: payload.url,
      alias: payload.alias,
      userId: payload.userId,
      ca: toBase64(payload.ca),
      key: toBase64(payload.key),
      cert: toBase64(payload.cert),
      description: payload.description,
    };
    await CreateDockerConnection(token, body);
  },

  async list(token: string, userId: number): Promise<DockerCredentialSummary[]> {
    const response = await FindAllByUser(token, userId);
    if (!Array.isArray(response)) return [];
    return response
      .map(mapCredential)
      .filter((credential): credential is DockerCredentialSummary => Boolean(credential));
  },
  async delete(token: string, credentialId: number): Promise<void> {
    await DeleteDockerConnection(token, credentialId);
  },

  async connect(credentialId: number): Promise<void> {
    await AddDockerClient(credentialId);
  },
};
