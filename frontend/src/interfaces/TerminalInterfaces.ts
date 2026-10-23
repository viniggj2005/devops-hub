import type * as ferretshellDtos from '../../bindings/docker-manager-go/src/ferretshell/dtos/models';
import type { SplitDropZone, SplitLayout } from './SplitInterfaces';
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

export type LocalShellKind = 'cmd' | 'wsl' | 'unix' | 'gitbash' | 'powershell';

export interface LocalShell {
  id: string;
  name: string;
  isDefault: boolean;
  kind: LocalShellKind;
}

export interface TerminalInstance {
  id: string;
  title: string;
  containerId?: string;
  localShell?: LocalShell;
  containerName?: string;
  config?: SSHConnectionDto;
}

export type TerminalLayout = SplitLayout;

export type TerminalDropZone = SplitDropZone;

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
  adoptTabs: (tabs: TerminalTab[], activeTabId: string | null) => void;
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
