import React from 'react';
import { CheckCircle2, Loader2, Server } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import * as ferretshellDtos from '../../../../../bindings/docker-manager-go/src/ferretshell/dtos/models';

interface SftpSidebarProps {
    connecting: boolean;
    activeConnectionId: number | null;
    connectingConnectionId: number | null;
    connections: ferretshellDtos.SshDto[];
    onConnect: (connection: ferretshellDtos.SshDto) => void;
}

const SftpSidebar: React.FC<SftpSidebarProps> = ({
    onConnect,
    connecting,
    connections,
    activeConnectionId,
    connectingConnectionId,
}) => {
    const { dictionary } = useTranslation();
    const sftpTexts = dictionary.ferretShell.sftp;
    return (
        <div className="w-64 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-gray-400">{sftpTexts.connections}</h3>
                {connecting && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {sftpTexts.connecting}
                    </span>
                )}
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
                {connections.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 italic">{sftpTexts.noConnections}</div>
                ) : (
                    connections.map(connection => {
                        const isConnectingThis = connecting && connectingConnectionId === connection.id;
                        const isConnectedThis = !isConnectingThis && activeConnectionId === connection.id;

                        return (
                            <button
                                key={connection.id}
                                onClick={() => onConnect(connection)}
                                disabled={connecting}
                                className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${
                                    isConnectingThis
                                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300 ring-2 ring-purple-500/30 animate-pulse'
                                        : isConnectedThis
                                          ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 ring-2 ring-purple-500/30'
                                          : 'border-transparent hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-zinc-400 disabled:opacity-50'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {isConnectingThis ? (
                                            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-purple-500" />
                                        ) : isConnectedThis ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                        ) : (
                                            <Server className="w-3.5 h-3.5 shrink-0 opacity-50" />
                                        )}
                                        <span className="font-bold truncate">
                                            {connection.alias || connection.host}
                                        </span>
                                    </div>
                                    {isConnectingThis && (
                                        <span className="shrink-0 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-300">
                                            {sftpTexts.connectingEllipsis}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-0.5 pl-5.5 opacity-60 truncate">
                                    {connection.systemUser}@{connection.host}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default SftpSidebar;
