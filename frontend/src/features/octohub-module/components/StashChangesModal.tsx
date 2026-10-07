import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowRight, X, WavesArrowDown, WavesArrowUp } from 'lucide-react';

interface StashChangesModalProps {
    isOpen: boolean;
    loading: boolean;
    onClose: () => void;
    currentBranch: string;
    targetBranch: string | null;
    onConfirm: (action: 'bring' | 'leave') => void;
}

const StashChangesModal: React.FC<StashChangesModalProps> = ({
    isOpen,
    onClose,
    loading,
    onConfirm,
    targetBranch,
    currentBranch,
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                    onClick={() => !loading && onClose()}
                />

                <div className="relative w-full max-w-lg transform overflow-hidden rounded-[2.5rem] bg-white dark:bg-zinc-900 text-left align-middle shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-zinc-200 dark:border-white/10 transition-all animate-in zoom-in-95 fade-in duration-300">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-all z-10 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="pt-10 pb-6 text-center">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                            <AlertCircle className="w-10 h-10 text-amber-500" />
                        </div>
                        <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-2">
                            Espere um momento!
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 px-12 text-sm leading-relaxed">
                            Você tem alterações não salvas em <span className="font-bold text-emerald-500">{currentBranch}</span>.
                        </p>
                    </div>

                    <div className="px-8 pb-8 space-y-3">
                        <button
                            onClick={() => onConfirm('bring')}
                            disabled={loading}
                            className="w-full group relative flex items-center gap-4 p-6 bg-zinc-50 dark:bg-white/5 hover:bg-emerald-500/10 border border-zinc-200 dark:border-white/10 hover:border-emerald-500/30 rounded-3xl transition-all text-left disabled:opacity-50 active:scale-[0.98]"
                        >
                            <div className="p-3 bg-emerald-500/20 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                                <WavesArrowUp className="w-6 h-6 text-emerald-500 group-hover:text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-zinc-900 dark:text-white text-base">Trazendo alterações para {targetBranch}</h4>
                                <p className="text-xs text-zinc-500 mt-0.5">Mover o trabalho atual para o branch de destino.</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </button>

                        <button
                            onClick={() => onConfirm('leave')}
                            disabled={loading}
                            className="w-full group relative flex items-center gap-4 p-6 bg-zinc-50 dark:bg-white/5 hover:bg-amber-500/10 border border-zinc-200 dark:border-white/10 hover:border-amber-500/30 rounded-3xl transition-all text-left disabled:opacity-50 active:scale-[0.98]"
                        >
                            <div className="p-3 bg-amber-500/20 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                                <WavesArrowDown className="w-6 h-6 text-amber-500 group-hover:text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-zinc-900 dark:text-white text-base">Deixar alterações em {currentBranch}</h4>
                                <p className="text-xs text-zinc-500 mt-0.5">Armazenar e mantê-las onde estão.</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>

                    {loading && (
                        <div className="p-6 bg-zinc-50/50 dark:bg-black/40 flex items-center justify-center border-t border-zinc-100 dark:border-white/5">
                            <div className="flex items-center gap-3 text-emerald-500 font-black italic text-xs uppercase tracking-widest animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                                Switching...
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default StashChangesModal;
