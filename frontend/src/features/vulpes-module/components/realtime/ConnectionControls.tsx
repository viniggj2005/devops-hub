import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Loader2, Plug, Unplug } from 'lucide-react';
import type { ConnectionStatus } from '../../../../interfaces/VulpesInterfaces';
import { primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';

const statusStyles: Record<ConnectionStatus, string> = {
  idle: 'bg-gray-400',
  closed: 'bg-gray-400',
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500 animate-pulse',
};

export const isConnectionActive = (status: ConnectionStatus) => status === 'connected' || status === 'connecting';

export const ConnectionBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const { dictionary } = useTranslation();

  return (
    <span className="flex items-center gap-1.5 px-2 text-[11px] font-semibold text-gray-500 dark:text-zinc-400 whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full ${statusStyles[status]}`} />
      {dictionary.vulpes.realtime.status[status]}
    </span>
  );
};

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
  connectLabel,
  disconnectLabel,
}) => {
  const { dictionary } = useTranslation();
  const realtimeTexts = dictionary.vulpes.realtime;

  if (status === 'connecting') {
    return (
      <button type="button" onClick={onDisconnect} className={secondaryButtonClass}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {dictionary.app.common.cancel}
      </button>
    );
  }
  if (status === 'connected') {
    return (
      <button type="button" onClick={onDisconnect} className={secondaryButtonClass}>
        <Unplug className="w-3.5 h-3.5" />
        {disconnectLabel ?? realtimeTexts.disconnect}
      </button>
    );
  }
  return (
    <button type="button" onClick={onConnect} className={primaryButtonClass}>
      <Plug className="w-3.5 h-3.5" />
      {connectLabel ?? realtimeTexts.connect}
    </button>
  );
};
