import React from 'react';
import { Columns, Rows, LayoutGrid, LayoutList } from 'lucide-react';

interface SnapOverlayProps {
    onDrop: (layout: 'left' | 'right' | 'top' | 'bottom' | 'grid', e: React.DragEvent) => void;
}

const SnapOverlay: React.FC<SnapOverlayProps> = ({ onDrop }) => {
    return (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-50 flex items-center justify-center p-12">
            <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full max-w-2xl aspect-video">

                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop('left', e)}
                    className="group relative bg-white/5 border-2 border-dashed border-white/20 rounded-2xl hover:bg-purple-500/20 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden"
                >
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors" />
                    <Columns className="w-8 h-8 text-white/40 group-hover:text-purple-400 group-hover:scale-110 transition-all" />
                    <span className="text-sm font-bold text-white/40 group-hover:text-purple-400">Dividir Esquerda</span>
                </div>

                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop('right', e)}
                    className="group relative bg-white/5 border-2 border-dashed border-white/20 rounded-2xl hover:bg-purple-500/20 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden"
                >
                    <div className="absolute inset-y-0 right-0 w-1/2 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors" />
                    <Columns className="w-8 h-8 text-white/40 group-hover:text-purple-400 group-hover:scale-110 transition-all" />
                    <span className="text-sm font-bold text-white/40 group-hover:text-purple-400">Dividir Direita</span>
                </div>
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop('top', e)}
                    className="group relative bg-white/5 border-2 border-dashed border-white/20 rounded-2xl hover:bg-purple-500/20 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors" />
                    <Rows className="w-8 h-8 text-white/40 group-hover:text-purple-400 group-hover:scale-110 transition-all" />
                    <span className="text-sm font-bold text-white/40 group-hover:text-purple-400">Dividir Topo</span>
                </div>

                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop('grid', e)}
                    className="group relative bg-white/5 border-2 border-dashed border-white/20 rounded-2xl hover:bg-purple-500/20 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden"
                >
                    <div className="grid grid-cols-2 grid-rows-2 gap-1 absolute inset-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <div className="bg-purple-500 rounded-sm" />
                        <div className="bg-purple-500 rounded-sm" />
                        <div className="bg-purple-500 rounded-sm" />
                        <div className="bg-purple-500 rounded-sm" />
                    </div>
                    <LayoutGrid className="w-8 h-8 text-white/40 group-hover:text-purple-400 group-hover:scale-110 transition-all" />
                    <span className="text-sm font-bold text-white/40 group-hover:text-purple-400">Layout em Grade</span>
                </div>
            </div>

            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-white/10 px-6 py-2 rounded-full text-white/60 text-sm font-medium backdrop-blur-md">
                Solte em uma zona para organizar o terminal
            </div>
        </div>
    );
};

export default SnapOverlay;
