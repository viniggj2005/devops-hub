export interface Port {
  IP?: string;
  Type: string;
  PrivatePort: number;
  PublicPort?: number;
}

export interface NetworkSettings {
  Networks?: Partial<Record<string, { IPAddress?: string } | null>>;
}

export interface ContainerItem {
  Id: string;
  Image: string;
  State: string;
  Ports?: Port[];
  Names: string[];
  Status?: string;
  ImageID?: string;
  Command?: string;
  Created?: number;
  Labels?: Partial<Record<string, string>>;
  NetworkSettings?: NetworkSettings | null;
}
export interface ContainerStatsProps {
  id: string;
  name: string;
  onClose: () => void;
}

export interface EditContainerNameModalProps {
  id: string;
  name: string;
  setEditNameModal: (state: boolean) => void;
  handleRename: (newName: string, id: string) => void;
}

export interface ContainerProps {
  id: string;
  name: string;
  isOpen: boolean;
  onOpenLogs: () => void;
  onDeleted?: () => void;
  setMenuModal: (state: boolean) => void;
  onOpenTerminal: () => void;
}

export interface StatsPayload {
  pids: number;
  time: number;
  osType: string;
  txBytes: number;
  rxBytes: number;
  memoryUsage: number;
  memoryLimit: number;
  containerId: string;
  cpuPercentage: number;
  memoryPercentage: number;
}

export interface LogsProps {
  id: string;
  setLogsModal: (state: boolean) => void;
}

export interface ContainerCardProps {
  container: ContainerItem;
  name: string;
  isSeeing: boolean;
  isOpened: boolean;
  isEditing: boolean;
  onOpenLogs: () => void;
  onOpenMenu: () => void;
  onOpenEdit: () => void;
  onCloseLogs: () => void;
  onCloseMenu: () => void;
  onCloseEdit: () => void;
  onDeleted: () => Promise<void>;
  onRename: (name: string, id: string) => Promise<void>;
  onTogglePause: (id: string, state: string) => Promise<void>;
  onStart: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onOpenTerminal: () => void;
}

interface Point {
  time: number;
  value: number;
}

export interface CpuChartsProps {
  points: Point[];
}

export interface MemoryChartsProps {
  limitMB?: number;
  percentPoints: Point[];
  usageMBPoints: Point[];
}

export interface CreateContainerPortMapping {
  hostPort: string;
  containerPort: string;
}

export interface CreateContainerEnvVar {
  key: string;
  value: string;
}

export interface CreateContainerVolumeMapping {
  hostPath: string;
  containerPath: string;
}
