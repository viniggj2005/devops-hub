import React from 'react';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import { Copy, Monitor, Pencil, SquareTerminal, Trash2 } from 'lucide-react';
import { SshConnectionCardProps } from '../../../../interfaces/TerminalInterfaces';

const actionButtonClass =
    'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all';

const SshConnectionCard: React.FC<SshConnectionCardProps> = ({
    connection,
    handleEdit,
    handleRemove,
    handleConnect,
}) => {
    const port = connection.port || 22;
    const isCustomPort = port !== 22;
    const address = `${connection.systemUser}@${connection.host}:${port}`;
    const displayName = connection.alias || `${connection.systemUser}@${connection.host}`;
    const sshCommand = isCustomPort
        ? `ssh -p ${port} ${connection.systemUser}@${connection.host}`
        : `ssh ${connection.systemUser}@${connection.host}`;

    return (
        <div
            onClick={() => handleConnect(connection.id)}
            className="group mb-2.5 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transition-all duration-300 cursor-pointer hover:border-blue-500/40 hover:shadow-xl hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl"
        >
            <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    <Monitor className="h-6 w-6" />
                </div>
                <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold tracking-tight text-gray-900 dark:text-white truncate">
                            {displayName}
                        </h3>
                        {isCustomPort && (
                            <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                :{port}
                            </span>
                        )}
                    </div>
                    <div
                        title={address}
                        className="font-mono text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate"
                    >
                        {address}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <button
                    title="Conectar ao terminal"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleConnect(connection.id);
                    }}
                    className={`${actionButtonClass} hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-500/10 dark:hover:text-purple-400`}
                >
                    <SquareTerminal className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                <button
                    title={`Copiar comando (${sshCommand})`}
                    onClick={(event) => {
                        event.stopPropagation();
                        copyToClipboard(sshCommand, 'Comando SSH copiado');
                    }}
                    className={`${actionButtonClass} hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white`}
                >
                    <Copy className="h-4 w-4" />
                </button>

                <button
                    title="Editar conexão"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(connection);
                    }}
                    className={`${actionButtonClass} hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400`}
                >
                    <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                <button
                    title="Excluir conexão"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleRemove(connection.id, displayName);
                    }}
                    className={`${actionButtonClass} hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400`}
                >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
            </div>
        </div>
    );
};

export default SshConnectionCard;
