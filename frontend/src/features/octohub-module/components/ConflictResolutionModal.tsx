import React from 'react';
import { createPortal } from 'react-dom';
import { X, GitMerge, Code2, AlertTriangle } from 'lucide-react';

interface ConflictResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    conflictingFiles: string[];
    onOpenFile: (file: string) => void;
    onStageFile: (file: string) => void;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
    isOpen,
    onClose,
    onOpenFile,
    onStageFile,
    conflictingFiles,
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                    onClick={onClose}
                />

                <div className="relative w-full max-w-lg transform overflow-hidden rounded-[2.5rem] bg-white dark:bg-zinc-900 text-left align-middle shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-zinc-200 dark:border-white/10 transition-all animate-in zoom-in-95 fade-in duration-300 flex flex-col max-h-[85vh]">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-all z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="pt-10 pb-6 text-center shrink-0">
                        <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                            <GitMerge className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-2">
                            Conflitos Detectados
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 px-12 text-sm leading-relaxed">
                            O Git não conseguiu mesclar as alterações automaticamente. Resolva os conflitos nos arquivos abaixo para continuar.
                        </p>
                    </div>

                    <div className="px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="space-y-3">
                            {conflictingFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{file}</span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => onOpenFile(file)}
                                            className="shrink-0 flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all"
                                            title="Abrir no VSCode"
                                        >
                                            <Code2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onStageFile(file)}
                                            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
                                        >
                                            Marcar como Resolvido
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConflictResolutionModal;
