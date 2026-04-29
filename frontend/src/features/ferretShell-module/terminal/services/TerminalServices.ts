import { normalizeKey } from '../functions/TreatmentFunctions';
import type { CreateSshConnectionInterface, SSHConnectionDto, SshDto } from '../../../../interfaces/TerminalInterfaces';
import { GetById, DeleteConnection, CreateSshConnection, UpdateSshConnection, FindAllConnectionByUser } from '../../../../../wailsjs/go/ferretShellHandlers/SshHandlerStruct';

export function toSshConn(dto: SshDto): SSHConnectionDto {
  return {
    Cols: 0,
    Rows: 0,
    Timeout: 0,
    Password: dto.password ?? '',
    Host: dto.host,
    KnownHostsPath: '',
    Port: dto.port ?? 22,
    User: dto.systemUser,
    KeyPath: dto.keyPath ?? '',
    InsecureIgnoreHostKey: true,
    Passphrase: dto.passphrase ?? '',
    SshSessionId: '',
    Key: Array.from(normalizeKey(dto.key)),
  };
}
export const TerminalServices = {
  async updateSshConnection(token: string, id: number, body: CreateSshConnectionInterface) {
    if (body.userId == null) throw new Error('userId é obrigatório');
    const payload = {
      key: body.key,
      host: body.host,
      alias: body.alias,
      userId: body.userId,
      password: body.password,
      systemUser: body.systemUser,
      knownHosts: body.knownHosts,
      port: body.port ?? undefined,
    };
    return UpdateSshConnection(token, id, payload);
  },

  async createSshConnection(token: string, body: CreateSshConnectionInterface) {
    if (body.userId == null) throw new Error('userId é obrigatório');
    const payload = {
      key: body.key,
      host: body.host,
      alias: body.alias,
      userId: body.userId,
      password: body.password,
      systemUser: body.systemUser,
      knownHosts: body.knownHosts,
      port: body.port ?? undefined,
    };
    console.log(payload);
    return CreateSshConnection(token, payload);
  },

  async findAllByUser(userId: number, token: string): Promise<SshDto[]> {
    if (!Number.isFinite(userId)) throw new Error('userId inválido');
    const connectionsList = await FindAllConnectionByUser(token, userId);
    return Array.isArray(connectionsList) ? (connectionsList as SshDto[]) : [];
  },

  async getById(token: string, id: number): Promise<SshDto> {
    const connectionObject = await GetById(token, Number(id));
    return connectionObject as SshDto;
  },

  async deleteConnection(token: string, id: number): Promise<void> {
    return await DeleteConnection(token, Number(id));
  },
};
