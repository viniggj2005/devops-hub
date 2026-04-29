import { X, Edit3 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

interface RenameModalProps {
    isOpen: boolean;
    oldName: string;
    onClose: () => void;
    onSave: (newName: string) => void;
}

const RenameModal: React.FC<RenameModalProps> = ({ isOpen, oldName, onClose, onSave }) => {
    const [newName, setNewName] = useState(oldName);

    useEffect(() => {
        if (isOpen) setNewName(oldName);
    }, [isOpen, oldName]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (newName && newName !== oldName) {
            onSave(newName);
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/30">
                    <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-bold">Renomear Item</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-400">Nome Atual</label>
                        <div className="text-xs text-gray-500 truncate bg-gray-100 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-white/5 italic">
                            {oldName}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-400">Novo Nome</label>
                        <input
                            autoFocus
                            type="text"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && handleSave()}
                            onFocus={(event) => event.target.select()}
                            className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-inner"
                            placeholder="Digite o novo nome..."
                        />
                    </div>
                </div>

                <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/30 border-t border-gray-100 dark:border-white/5 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!newName || newName === oldName}
                        className="px-6 py-2 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:grayscale rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RenameModal;
