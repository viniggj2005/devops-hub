import type { dtos, ferretShellDtos } from '../../wailsjs/go/models';
export type SSHConnectionDto = ferretShellDtos.SSHConnectionDto;

export interface TerminalProps {
  id?: string;
  open: boolean;
  title?: string;
  onClose: () => void;
  configure?: SSHConnectionDto;
  minimized?: boolean;
  onMinimize?: (value: boolean) => void;
}

export interface TerminalHeaderProps {
  title: string;
  docked: boolean;
  maximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMax: () => void;
  onToggleDock: () => void;
}

export interface CreateSshConnectionInterface {
  host: string;
  key?: string;
  port?: number;
  alias?: string;
  userId?: number;
  systemUser: string;
  password?: string;
  knownHosts?: string;
}

export interface EditSshConnectionModalProps extends ModalProps {
  connection: SshDto | null;
}
export interface EditSshConnectionFormProps {
  id: number;
  onSuccess?: () => void;
  connection: CreateSshConnectionInterface;
}

export interface SshDto {
  id: number;
  host: string;
  port: number;
  alias?: string;
  systemUser: string;
  keyPath?: string | null;
  passphrase?: string | null;
  password?: string | null;
  key?: number[] | string | null;
  knownHostsData?: string | null;
}

export interface ConnectionProps {
  token: string;
  onConnect: (id: number) => void;
}

export interface OpenTerminalProps {
  id: number;
  autoOpen?: boolean;
  onClose?: () => void;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export interface TerminalInstance {
  id: string;
  title: string;
  config?: SSHConnectionDto;
  containerId?: string;
  containerName?: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  instances: TerminalInstance[];
  preferredLayout?: 'vertical' | 'horizontal' | 'grid';
}

export interface TerminalStateProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  viewMode: 'page' | 'terminal';
  broadcastActive: boolean;
  setBroadcastActive: (value: boolean) => void;
  setViewMode: (mode: 'page' | 'terminal') => void;

  createTab: (instance: Omit<TerminalInstance, 'id'>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  addInstanceToTab: (tabId: string, instance: Omit<TerminalInstance, 'id'>, index?: number, layout?: 'vertical' | 'horizontal' | 'grid') => void;
  removeInstance: (tabId: string, instanceId: string) => void;
  setLayout: (tabId: string, layout: 'vertical' | 'horizontal' | 'grid') => void;

  open: boolean;
  close: () => void;
}


export interface SshConnectionCardProps {
  connection: SshDto;
  handleConnect: (id: number) => void;
  handleEdit: (connection: SshDto) => void;
  handleRemove: (id: number, alias: string) => void;
}
