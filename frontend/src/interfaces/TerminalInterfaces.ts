import type {ferretshellDtos } from '../../wailsjs/go/models';
export type SSHConnectionDto = ferretshellDtos.SSHConnectionDto;

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

export type TerminalLayout = 'vertical' | 'horizontal' | 'grid';

export type TerminalDropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface TerminalTab {
  id: string;
  title: string;
  instances: TerminalInstance[];
  preferredLayout?: TerminalLayout;
}

export interface TerminalStateProps {
  open: boolean;
  tabs: TerminalTab[];
  broadcastActive: boolean;
  activeTabId: string | null;
  draggingTabId: string | null;
  viewMode: 'page' | 'terminal';
  close: () => void;
  closeTab: (tabId: string) => void;
  setBroadcastActive: (value: boolean) => void;
  setActiveTab: (tabId: string | null) => void;
  setDraggingTabId: (tabId: string | null) => void;
  setViewMode: (mode: 'page' | 'terminal') => void;
  detachInstance: (tabId: string, instanceId: string) => void;
  removeInstance: (tabId: string, instanceId: string) => void;
  createTab: (instance: Omit<TerminalInstance, 'id'>) => void;
  mergeTabInto: (sourceTabId: string, targetTabId: string, dropZone: TerminalDropZone) => void;
}


export interface SshConnectionCardProps {
  connection: SshDto;
  handleConnect: (id: number) => void;
  handleEdit: (connection: SshDto) => void;
  handleRemove: (id: number, alias: string) => void;
}
