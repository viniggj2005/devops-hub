import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { Dictionary } from '../../../i18n/Languages';
import * as octohubStructs from '../../../../../bindings/docker-manager-go/src/octohub/structs/models';
import { ChevronRight, FileText, Plus, Minus, SquareDot, SquareArrowRight } from 'lucide-react';

interface ModifiedFileListProps {
    loadingFiles: boolean;
    selectedFile: string | null;
    onFileClick: (file: string) => void;
    onFileDoubleClick?: (file: string) => void;
    modifications: octohubStructs.FileModification[];
}

const getStatusIcon = (status: string) => {
    switch (status[0]) {
        case 'D': return <Minus className="w-3 h-3 text-rose-500" />;
        case 'A': return <Plus className="w-3 h-3 text-emerald-500" />;
        case 'M': return <SquareDot className="w-3 h-3 text-amber-500" />;
        case 'R': return <SquareArrowRight className="w-3 h-3 text-blue-500" />;
        default: return <FileText className="w-3 h-3 text-zinc-400" />;
    }
};

const getStatusLabel = (status: string, statusTexts: Dictionary['octohub']['modifiedFiles']['status']) => {
    switch (status[0]) {
        case 'A': return statusTexts.added;
        case 'M': return statusTexts.modified;
        case 'D': return statusTexts.deleted;
        case 'R': return statusTexts.renamed;
        default: return status;
    }
};

const ModifiedFileList: React.FC<ModifiedFileListProps> = ({
    onFileClick,
    loadingFiles,
    selectedFile,
    modifications,
    onFileDoubleClick,
}) => {
    const { dictionary, formatMessage } = useTranslation();
    const filesTexts = dictionary.octohub.modifiedFiles;
    return (
        <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            <div className="p-4 border-b border-zinc-200 dark:border-white/5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {formatMessage(filesTexts.title, { count: modifications.length })}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {loadingFiles ? (
                    <div className="flex items-center gap-2 text-zinc-500 italic text-xs p-4">
                        <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                        {filesTexts.loading}
                    </div>
                ) : modifications.length > 0 ? (
                    <div className="space-y-0.5">
                        {modifications.map((modifiedFile, index) => (
                            <div
                                key={index}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors group cursor-pointer ${selectedFile === modifiedFile.File ? 'bg-zinc-200 dark:bg-white/10 ring-1 ring-zinc-300 dark:ring-white/10' : ''}`}
                                onClick={() => onFileClick(modifiedFile.File)}
                                onDoubleClick={() => onFileDoubleClick?.(modifiedFile.File)}
                                title={onFileDoubleClick ? filesTexts.doubleClickHint : undefined}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className="shrink-0"
                                        title={getStatusLabel(modifiedFile.Status, filesTexts.status)}
                                    >
                                        {getStatusIcon(modifiedFile.Status)}
                                    </div>
                                    <span className={`text-[11px] truncate transition-colors ${selectedFile === modifiedFile.File ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-600 dark:text-zinc-400 font-medium'}`}>
                                        {modifiedFile.File}
                                    </span>
                                </div>
                                <ChevronRight className={`w-3 h-3 text-zinc-400 transition-transform ${selectedFile === modifiedFile.File ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-zinc-400 italic text-xs">
                        {filesTexts.empty}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModifiedFileList;
