import React from 'react';
import SftpFileRow from './SftpFileRow';
import { useTranslation } from '../../../i18n/useTranslation';
import { Link2, ArrowUp, Loader2 } from 'lucide-react';
import * as ferretshellHandlers from '../../../../../bindings/docker-manager-go/src/ferretshell/handlers/models';

interface SftpRemotePanelProps {
    onUp: () => void;
    remotePath: string;
    connecting: boolean;
    error: string | null;
    loadingFiles: boolean;
    sessionId: string | null;
    selectedIndices: number[];
    connectingHost: string | null;
    onDirClick: (name: string) => void;
    remoteFiles: ferretshellHandlers.SftpFileInfo[];
    onDragStart: (event: React.DragEvent, index: number) => void;
    onFileClick: (index: number, event: React.MouseEvent) => void;
    onDrop: (event: React.DragEvent, overridePath?: string) => void;
}

const SftpRemotePanel: React.FC<SftpRemotePanelProps> = ({
    onUp,
    error,
    onDrop,
    sessionId,
    remotePath,
    connecting,
    onDirClick,
    onDragStart,
    onFileClick,
    remoteFiles,
    loadingFiles,
    connectingHost,
    selectedIndices
}) => {
    const { dictionary } = useTranslation();
    const sftpTexts = dictionary.ferretShell.sftp;
    return (
        <div
            className="relative flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-lg"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event)}
        >
            {(connecting || loadingFiles) && (
                <div className="absolute inset-x-0 top-0 h-0.5 bg-purple-500 animate-pulse z-10" />
            )}

            <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50/30 dark:bg-zinc-800/20">
                <div className="flex items-center gap-2">
                    {connecting || loadingFiles ? (
                        <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                    ) : (
                        <Link2 className="w-4 h-4 text-purple-500" />
                    )}
                    <span className="text-sm font-bold">{sftpTexts.remote}</span>
                    {connecting && (
                        <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                            {sftpTexts.connectingEllipsis}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onUp}
                        title={sftpTexts.goUp}
                        disabled={connecting || loadingFiles || !sessionId || remotePath === '/'}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-30"
                    >
                        <ArrowUp className="w-4 h-4" />
                    </button>
                    <input
                        type="text"
                        readOnly
                        value={remotePath}
                        className="bg-transparent border-none text-xs font-mono w-40 outline-none"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                {connecting ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                                {sftpTexts.connectingToServer}
                            </p>
                            {connectingHost && (
                                <p className="mt-0.5 font-mono text-xs text-purple-600 dark:text-purple-400">
                                    {connectingHost}
                                </p>
                            )}
                            <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-500">
                                {sftpTexts.establishingSession}
                            </p>
                        </div>
                    </div>
                ) : !sessionId ? (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                        {error || sftpTexts.selectServer}
                    </div>
                ) : (
                    <table className="w-full text-left text-xs select-none">
                        <tbody>
                            {remoteFiles.map((file, index) => (
                                <SftpFileRow
                                    key={index}
                                    name={file.name}
                                    isDir={file.isDir}
                                    size={file.size}
                                    isSelected={selectedIndices.includes(index)}
                                    onDragStart={(event) => onDragStart(event, index)}
                                    onDragOver={(event) => {
                                        if (file.isDir) {
                                            event.preventDefault();
                                            event.currentTarget.classList.add('bg-purple-500/20');
                                        }
                                    }}
                                    onDragLeave={(event) => event.currentTarget.classList.remove('bg-purple-500/20')}
                                    onDrop={(event) => {
                                        if (file.isDir) {
                                            event.currentTarget.classList.remove('bg-purple-500/20');
                                            const targetPath = remotePath.endsWith('/') ? remotePath + file.name : remotePath + '/' + file.name;
                                            onDrop(event, targetPath);
                                        }
                                    }}
                                    onDoubleClick={() => file.isDir && onDirClick(file.name)}
                                    onClick={(event) => onFileClick(index, event)}
                                    highlightClass="bg-purple-500/10"
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SftpRemotePanel;
