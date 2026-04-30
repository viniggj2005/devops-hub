import React from 'react';
import SftpFileRow from './SftpFileRow';
import { Monitor, ArrowUp, Trash2, Edit3 } from 'lucide-react';
import { ferretshellHandlers } from '../../../../../wailsjs/go/models';

interface SftpLocalPanelProps {
    onUp: () => void;
    localPath: string;
    onDelete: () => void;
    selectedIndices: number[];
    onRename: (index: number) => void;
    onDirClick: (path: string) => void;
    onSetSelection: (indices: number[]) => void;
    localFiles: ferretshellHandlers.LocalFileInfo[];
    onDragStart: (event: React.DragEvent, index: number) => void;
    onFileClick: (index: number, event: React.MouseEvent) => void;
    onDrop: (event: React.DragEvent, overridePath?: string) => void;
}

const SftpLocalPanel: React.FC<SftpLocalPanelProps> = ({
    onUp,
    onDrop,
    onDelete,
    onRename,
    localPath,
    onDirClick,
    localFiles,
    onFileClick,
    onDragStart,
    onSetSelection,
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
                    <Monitor className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold">Local</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onUp} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><ArrowUp className="w-4 h-4" /></button>
                    <input type="text" readOnly value={localPath} className="bg-transparent border-none text-xs font-mono w-40 outline-none text-right" title={localPath} />
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs select-none">
                    <tbody>
                        {localFiles.map((file, index) => (
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
                                        event.currentTarget.classList.add('bg-blue-500/20');
                                    }
                                }}
                                onDragLeave={(event) => event.currentTarget.classList.remove('bg-blue-500/20')}
                                onDrop={(event) => {
                                    if (file.isDir) {
                                        event.currentTarget.classList.remove('bg-blue-500/20');
                                        onDrop(event, file.path);
                                    }
                                }}
                                onDoubleClick={() => file.isDir && onDirClick(file.path)}
                                onClick={(event) => onFileClick(index, event)}
                                onKeyDown={(event) => event.key === 'Delete' && onDelete()}
                                highlightClass="bg-blue-500/10"
                                actions={
                                    <>
                                        <button
                                            onClick={(event) => { event.stopPropagation(); onRename(index); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-all"
                                            title="Renomear"
                                        >
                                            <Edit3 className="w-3 h-3 text-gray-400" />
                                        </button>
                                        <button
                                            onClick={(event) => { event.stopPropagation(); onSetSelection([index]); onDelete(); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-500" />
                                        </button>
                                    </>
                                }
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SftpLocalPanel;
