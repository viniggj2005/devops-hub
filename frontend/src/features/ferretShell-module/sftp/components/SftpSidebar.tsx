import React from 'react';
import { ferretShellDtos } from '../../../../../wailsjs/go/models';

interface SftpSidebarProps {
    connecting: boolean;
    activeConnectionId: number | null;
    connections: ferretShellDtos.SshDto[];
    onConnect: (connection: ferretShellDtos.SshDto) => void;
}

const SftpSidebar: React.FC<SftpSidebarProps> = ({
    onConnect,
    connecting,
    connections,
    activeConnectionId,
}) => {
    return (
        <div className="w-64 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-800/30">
                <h3 className="text-xs font-bold uppercase text-gray-400">Conexões</h3>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
                {connections.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 italic">Nenhuma conexão salva</div>
                ) : (
                    connections.map(connection => (
                        <button
                            key={connection.id}
                            onClick={() => onConnect(connection)}
                            disabled={connecting}
                            className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${activeConnectionId === connection.id ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 ring-2 ring-purple-500/30' : 'border-transparent hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-zinc-400'}`}
                        >
                            <div className="font-bold truncate">{connection.alias || connection.host}</div>
                            <div className="opacity-60 truncate">{connection.systemUser}@{connection.host}</div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

export default SftpSidebar;
