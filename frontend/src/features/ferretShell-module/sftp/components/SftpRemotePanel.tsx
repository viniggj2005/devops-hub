import React from 'react';
import SftpFileRow from './SftpFileRow';
import { Link2, ArrowUp } from 'lucide-react';
import { ferretshellHandlers } from '../../../../../wailsjs/go/models';

interface SftpRemotePanelProps {
    onUp: () => void;
    remotePath: string;
    error: string | null;
    sessionId: string | null;
    selectedIndices: number[];
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
    onDirClick,
    onDragStart,
    onFileClick,
    remoteFiles,
    selectedIndices
}) => {
    return (
        <div
            className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-lg"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event)}
        >
            <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50/30 dark:bg-zinc-800/20">
                <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-bold">Remoto</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onUp} disabled={!sessionId || remotePath === '/'} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                    <input type="text" readOnly value={remotePath} className="bg-transparent border-none text-xs font-mono w-40 outline-none" />
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                {!sessionId ? (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">{error || 'Selecione um servidor'}</div>
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
