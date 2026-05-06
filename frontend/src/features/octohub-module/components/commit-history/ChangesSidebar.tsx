import React, { useState } from 'react';
import { octohubStructs } from '../../../../../wailsjs/go/models';
import { GetStashModifications } from '../../../../../wailsjs/go/octohubHandler/GitBranchHandler';
import { Search, RotateCcw, FileCode, CheckSquare, Square, Package, ArchiveRestore, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface ChangesSidebarProps {
    searchTerm: string;
    onRefresh: () => void;
    selectedFiles: Set<string>;
    selectedFile: string | null;
    toggleAllSelection: () => void;
    stashes?: octohubStructs.Stash[];
    onPopStash?: (id: string) => void;
    onDropStash?: (id: string) => void;
    files: octohubStructs.FilesStatus[];
    onFileClick: (fileName: string) => void;
    onSearchTermChange: (term: string) => void;
    toggleFileSelection: (fileName: string) => void;
    onStashFileClick?: (stashID: string, filePath: string) => void;
}

const getStatusColor = (status: string) => {
    switch (status.trim().toUpperCase()) {
        case 'M': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        case 'A': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        case 'D': return 'text-red-500 bg-red-500/10 border-red-500/20';
        case '??': return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
        default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    }
};

const getStatusLabel = (status: string) => {
    switch (status.trim().toUpperCase()) {
        case 'M': return 'M';
        case 'A': return 'A';
        case 'D': return 'D';
        case '??': return 'U';
        default: return status.trim();
    }
};

const ChangesSidebar: React.FC<ChangesSidebarProps> = ({
    files,
    stashes,
    onRefresh,
    searchTerm,
    onPopStash,
    onDropStash,
    onFileClick,
    selectedFile,
    selectedFiles,
    onStashFileClick,
    onSearchTermChange,
    toggleAllSelection,
    toggleFileSelection,
}) => {
    const [loadingStashFiles, setLoadingStashFiles] = useState(false);
    const [expandedStash, setExpandedStash] = useState<string | null>(null);
    const [stashFiles, setStashFiles] = useState<octohubStructs.FileModification[]>([]);

    const handleExpandStash = async (stashID: string) => {
        if (expandedStash === stashID) {
            setExpandedStash(null);
            return;
        }
        setExpandedStash(stashID);
        setLoadingStashFiles(true);
        try {
            const files = await GetStashModifications(stashID);
            setStashFiles(files || []);
        } catch (err) {
            console.error("Erro ao carregar arquivos do stash", err);
        } finally {
            setLoadingStashFiles(false);
        }
    };

    const filteredFiles = files.filter(file =>
        file.FileName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const allSelected = filteredFiles.length > 0 && filteredFiles.every(file => selectedFiles.has(file.FileName));

    return (
        <div className="w-full h-full flex flex-col bg-zinc-50 dark:bg-[#0c0c0e] shrink-0">
            <div className="p-4 border-b border-zinc-200 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleAllSelection}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-white/10 rounded transition-colors"
                        >
                            {allSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <Square className="w-4 h-4 text-zinc-400" />
                            )}
                        </button>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            {files.length} Alterações
                        </h2>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                        title="Atualizar"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Filtrar alterações..."
                        className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all text-zinc-900 dark:text-white"
                        value={searchTerm}
                        onChange={(event) => onSearchTermChange(event.target.value)}
                    />
                </div>
            </div>

            {stashes && stashes.length > 0 && (
                <div className="p-3 border-b border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <Package className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                            Stashes Pendentes
                        </h3>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {stashes.map(stash => (
                            <div key={stash.ID} className="bg-white dark:bg-black/20 border border-amber-500/20 rounded-lg p-2.5 flex flex-col gap-2">
                                <div
                                    className="flex items-start justify-between gap-2 cursor-pointer group"
                                    onClick={() => handleExpandStash(stash.ID)}
                                >
                                    <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-tight break-words whitespace-pre-wrap flex-1">
                                        <span className="font-bold text-amber-600 dark:text-amber-500 mr-1">{stash.ID}:</span>
                                        {stash.Message}
                                    </div>
                                    <div className="shrink-0 p-1 text-zinc-400 group-hover:text-amber-500 transition-colors">
                                        {expandedStash === stash.ID ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </div>
                                </div>

                                {expandedStash === stash.ID && (
                                    <div className="mt-1 mb-1 border border-amber-500/10 rounded overflow-hidden">
                                        {loadingStashFiles ? (
                                            <div className="p-3 text-center text-[10px] text-zinc-400">Carregando arquivos...</div>
                                        ) : stashFiles.length > 0 ? (
                                            <div className="divide-y divide-amber-500/5 bg-black/5 dark:bg-black/40">
                                                {stashFiles.map(file => (
                                                    <div
                                                        key={file.File}
                                                        className={`flex items-center gap-2 px-2 py-1.5 hover:bg-amber-500/10 cursor-pointer ${selectedFile === file.File ? 'bg-amber-500/20' : ''
                                                            }`}
                                                        onClick={() => onStashFileClick?.(stash.ID, file.File)}
                                                    >
                                                        <FileCode className="w-3 h-3 text-amber-500/60 shrink-0" />
                                                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate flex-1" title={file.File}>
                                                            {file.File}
                                                        </span>
                                                        <span className={`px-1 rounded text-[9px] font-bold border ${getStatusColor(file.Status)}`}>
                                                            {getStatusLabel(file.Status)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-3 text-center text-[10px] text-zinc-400">Nenhum arquivo encontrado</div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-1 pt-2 border-t border-amber-500/10">
                                    <button
                                        onClick={() => onPopStash?.(stash.ID)}
                                        className="flex-1 py-1.5 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded transition-colors"
                                    >
                                        <ArchiveRestore className="w-3 h-3" />
                                        Restaurar
                                    </button>
                                    <button
                                        onClick={() => onDropStash?.(stash.ID)}
                                        className="flex-1 py-1.5 flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold rounded transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Descartar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredFiles.length > 0 ? (
                    <div className="divide-y divide-zinc-100 dark:divide-white/5">
                        {filteredFiles.map((file) => (
                            <div
                                key={file.FileName}
                                className={`group flex items-center gap-3 p-3 transition-all cursor-pointer border-l-2 ${selectedFile === file.FileName
                                    ? 'bg-emerald-500/10 border-l-emerald-500'
                                    : 'hover:bg-zinc-100 dark:hover:bg-white/5 border-l-transparent'
                                    }`}
                                onClick={() => onFileClick(file.FileName)}
                            >
                                <div
                                    className="shrink-0 p-1 hover:bg-zinc-200 dark:hover:bg-white/10 rounded transition-colors"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        toggleFileSelection(file.FileName);
                                    }}
                                >
                                    {selectedFiles.has(file.FileName) ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <Square className="w-4 h-4 text-zinc-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate" title={file.FileName}>
                                        {file.FileName}
                                    </span>
                                </div>
                                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(file.Status)}`}>
                                    {getStatusLabel(file.Status)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-zinc-500 italic text-xs">
                        {files.length === 0 ? "Nenhuma alteração pendente." : "Nenhuma alteração corresponde ao filtro."}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChangesSidebar;
