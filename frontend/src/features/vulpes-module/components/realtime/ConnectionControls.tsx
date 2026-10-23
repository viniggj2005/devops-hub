import React from 'react';
import { Loader2, Plug, Unplug } from 'lucide-react';
import type { ConnectionStatus } from '../../../../interfaces/VulpesInterfaces';
import { primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';

const statusStyles: Record<ConnectionStatus, { label: string; className: string }> = {
  idle: { label: 'Desconectado', className: 'bg-gray-400' },
  closed: { label: 'Encerrado', className: 'bg-gray-400' },
  connected: { label: 'Conectado', className: 'bg-emerald-500' },
  connecting: { label: 'Conectando', className: 'bg-amber-500 animate-pulse' },
};

export const isConnectionActive = (status: ConnectionStatus) => status === 'connected' || status === 'connecting';

export const ConnectionBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => (
  <span className="flex items-center gap-1.5 px-2 text-[11px] font-semibold text-gray-500 dark:text-zinc-400 whitespace-nowrap">
    <span className={`w-2 h-2 rounded-full ${statusStyles[status].className}`} />
    {statusStyles[status].label}
  </span>
);

interface ConnectButtonProps {
  status: ConnectionStatus;
  connectLabel?: string;
  disconnectLabel?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({
  status,
  onConnect,
  onDisconnect,
  connectLabel = 'Conectar',
  disconnectLabel = 'Desconectar',
}) => {
  if (status === 'connecting') {
    return (
      <button type="button" onClick={onDisconnect} className={secondaryButtonClass}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cancelar
      </button>
    );
  }
  if (status === 'connected') {
    return (
      <button type="button" onClick={onDisconnect} className={secondaryButtonClass}>
        <Unplug className="w-3.5 h-3.5" />
        {disconnectLabel}
      </button>
    );
  }
  return (
    <button type="button" onClick={onConnect} className={primaryButtonClass}>
      <Plug className="w-3.5 h-3.5" />
      {connectLabel}
    </button>
  );
};
