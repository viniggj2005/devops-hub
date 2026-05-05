import React from 'react';
import DiffViewer from './DiffViewer';
import { octohubStructs } from '../../../../../wailsjs/go/models';
import { ChevronRight, FileText, Plus, Minus, SquareDot, SquareArrowRight } from 'lucide-react';

interface ModifiedFileListProps {
    loadingDiff: boolean;
    loadingFiles: boolean;
    fileDiff: string | null;
    selectedFile: string | null;
    onFileClick: (file: string) => void;
    modifications: octohubStructs.FileModification[];
}

const getStatusIcon = (status: string) => {
    switch (status[0]) {
        case 'A': return <Plus className="w-3 h-3 text-emerald-500" />;
        case 'M': return <SquareDot className="w-3 h-3 text-amber-500" />;
        case 'D': return <Minus className="w-3 h-3 text-rose-500" />;
        case 'R': return <SquareArrowRight className="w-3 h-3 text-blue-500" />;
        default: return <FileText className="w-3 h-3 text-zinc-400" />;
    }
};

const getStatusLabel = (status: string) => {
    switch (status[0]) {
        case 'A': return 'Adicionado';
        case 'M': return 'Modificado';
        case 'D': return 'Deletado';
        case 'R': return 'Renomeado';
        default: return status;
    }
};

const ModifiedFileList: React.FC<ModifiedFileListProps> = ({
    fileDiff,
    loadingDiff,
    onFileClick,
    loadingFiles,
    selectedFile,
    modifications,
}) => {
    return (
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/5 pb-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Arquivos Alterados ({modifications.length})
                    </h3>
                </div>

                {loadingFiles ? (
                    <div className="flex items-center gap-2 text-zinc-500 italic text-xs p-4">
                        <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                        Buscando arquivos...
                    </div>
                ) : modifications.length > 0 ? (
                    <div className="grid grid-cols-1 divide-y divide-zinc-100 dark:divide-white/5 bg-white dark:bg-zinc-800/10 rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden">
                        {modifications.map((modifiedFile, index) => (
                            <div key={index}>
                                <div
                                    className={`flex items-center justify-between px-4 py-2 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group cursor-pointer ${selectedFile === modifiedFile.File ? 'bg-zinc-100 dark:bg-white/5' : ''}`}
                                    onClick={() => onFileClick(modifiedFile.File)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="shrink-0"
                                            title={getStatusLabel(modifiedFile.Status)}
                                        >
                                            {getStatusIcon(modifiedFile.Status)}
                                        </div>
                                        <span className="text-xs font-medium truncate text-zinc-700 dark:text-zinc-300">{modifiedFile.File}</span>
                                    </div>
                                    <ChevronRight className={`w-3 h-3 text-zinc-400 transition-transform ${selectedFile === modifiedFile.File ? 'rotate-90' : ''}`} />
                                </div>

                                {selectedFile === modifiedFile.File && (
                                    <DiffViewer diff={fileDiff} loading={loadingDiff} />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center border-2 border-dashed border-zinc-100 dark:border-white/5 rounded-2xl text-zinc-400 italic text-sm">
                        Nenhuma modificação de arquivo encontrada.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModifiedFileList;
