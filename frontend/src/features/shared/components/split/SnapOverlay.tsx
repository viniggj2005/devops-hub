import React, { useState } from 'react';
import { Ban, Columns2, LayoutGrid, Rows2 } from 'lucide-react';
import { maxSplitPanes } from '../../constants/SplitDropZones';
import { SplitDropZone } from '../../../../interfaces/SplitInterfaces';

const accentClasses = {
    cyan: { zone: 'border-cyan-400 bg-cyan-500/20', icon: 'text-cyan-400' },
    amber: { zone: 'border-amber-400 bg-amber-500/20', icon: 'text-amber-400' },
    purple: { zone: 'border-purple-400 bg-purple-500/20', icon: 'text-purple-400' },
};

interface SnapOverlayProps {
    canDrop: boolean;
    itemNoun: string;
    draggedTitle: string;
    onCancel: () => void;
    resultingCount: number;
    accent: keyof typeof accentClasses;
    onDrop: (dropZone: SplitDropZone) => void;
}

const edgeThreshold = 0.25;

const zonePreviews: Record<SplitDropZone, { label: string; className: string; icon: React.ElementType }> = {
    center: { label: 'Organizar em grade', className: 'inset-0', icon: LayoutGrid },
    top: { label: 'Dividir em cima', className: 'inset-x-0 top-0 h-1/2', icon: Rows2 },
    bottom: { label: 'Dividir embaixo', className: 'inset-x-0 bottom-0 h-1/2', icon: Rows2 },
    left: { label: 'Dividir à esquerda', className: 'inset-y-0 left-0 w-1/2', icon: Columns2 },
    right: { label: 'Dividir à direita', className: 'inset-y-0 right-0 w-1/2', icon: Columns2 },
};

const zoneFromPointer = (event: React.DragEvent<HTMLDivElement>): SplitDropZone => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontalPosition = (event.clientX - bounds.left) / bounds.width;
    const verticalPosition = (event.clientY - bounds.top) / bounds.height;
    if (verticalPosition < edgeThreshold) return 'top';
    if (horizontalPosition < edgeThreshold) return 'left';
    if (verticalPosition > 1 - edgeThreshold) return 'bottom';
    if (horizontalPosition > 1 - edgeThreshold) return 'right';
    return 'center';
};

const SnapOverlay: React.FC<SnapOverlayProps> = ({ accent, canDrop, itemNoun, draggedTitle, resultingCount, onDrop, onCancel }) => {
    const [hoveredZone, setHoveredZone] = useState<SplitDropZone>('center');
    const preview = zonePreviews[hoveredZone];
    const PreviewIcon = preview.icon;
    const colors = accentClasses[accent];

    if (!canDrop) {
        return (
            <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                    event.preventDefault();
                    onCancel();
                }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
            >
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-zinc-900/95 px-6 py-4 text-sm text-red-300 shadow-2xl">
                    <Ban className="w-5 h-5 shrink-0" />
                    Esta tela comportaria {resultingCount} {itemNoun}. O limite é {maxSplitPanes} por tela.
                </div>
            </div>
        );
    }

    return (
        <div
            onDragOver={(event) => {
                event.preventDefault();
                const zone = zoneFromPointer(event);
                if (zone !== hoveredZone) setHoveredZone(zone);
            }}
            onDrop={(event) => {
                event.preventDefault();
                onDrop(zoneFromPointer(event));
            }}
            className="absolute inset-0 z-50 bg-black/30 backdrop-blur-[1px]"
        >
            <div
                className={`pointer-events-none absolute m-2 flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-150 ${colors.zone} ${preview.className}`}
            >
                <div className="flex flex-col items-center gap-2 rounded-xl bg-zinc-900/90 px-5 py-3 text-center shadow-xl">
                    <PreviewIcon className={`w-6 h-6 ${colors.icon}`} />
                    <span className="text-sm font-semibold text-white">{preview.label}</span>
                    <span className="max-w-[16rem] truncate text-xs text-zinc-400">“{draggedTitle}”</span>
                </div>
            </div>

            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-zinc-900/90 px-4 py-1.5 text-xs text-zinc-300">
                Solte perto de uma borda para dividir, ou no centro para grade · {resultingCount} de {maxSplitPanes} {itemNoun}
            </div>
        </div>
    );
};

export default SnapOverlay;
