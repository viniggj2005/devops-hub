import React from 'react';
import { Folder, File as FileIcon } from 'lucide-react';

interface SftpFileRowProps {
    name: string;
    size: number;
    isDir: boolean;
    isSelected: boolean;
    highlightClass?: string;
    actions?: React.ReactNode;
    onDoubleClick: () => void;
    onDrop: (event: React.DragEvent) => void;
    onClick: (event: React.MouseEvent) => void;
    onDragOver: (event: React.DragEvent) => void;
    onDragStart: (event: React.DragEvent) => void;
    onDragLeave: (event: React.DragEvent) => void;
    onKeyDown?: (event: React.KeyboardEvent) => void;
}

const SftpFileRow: React.FC<SftpFileRowProps> = ({
    name,
    size,
    isDir,
    onDrop,
    actions,
    onClick,
    onKeyDown,
    isSelected,
    onDragOver,
    onDragStart,
    onDragLeave,
    onDoubleClick,
    highlightClass = "bg-purple-500/10"
}) => {
    return (
        <tr
            draggable={true}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDoubleClick={onDoubleClick}
            onClick={onClick}
            onKeyDown={onKeyDown}
            tabIndex={0}
            className={`hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer group transition-colors outline-none ${isSelected ? highlightClass : ''}`}
        >
            <td className="p-2 flex items-center gap-2">
                {isDir ? <Folder className="w-4 h-4 text-amber-500" /> : <FileIcon className="w-4 h-4 text-blue-500" />}
                <span className="truncate max-w-[150px] lg:max-w-[250px]">{name}</span>
            </td>
            <td className="p-2 text-right">
                <div className="flex items-center justify-end gap-2">
                    {actions}
                    <span className="text-gray-400 opacity-60 font-mono text-[10px] w-12">
                        {isDir ? '--' : (size / 1024).toFixed(0) + 'K'}
                    </span>
                </div>
            </td>
        </tr>
    );
};

export default SftpFileRow;
