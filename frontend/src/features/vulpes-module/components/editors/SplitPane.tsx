import React, { useEffect, useRef, useState } from 'react';
import { startDrag } from '../../../shared/functions/DragFunctions';

interface SplitPaneProps {
  top: React.ReactNode;
  storageKey: string;
  bottom: React.ReactNode;
  defaultRatio?: number;
}

const minimumRatio = 0.15;
const maximumRatio = 0.85;

const clampRatio = (ratio: number) => Math.min(maximumRatio, Math.max(minimumRatio, ratio));

const readRatio = (storageKey: string, fallback: number) => {
  try {
    const stored = Number(localStorage.getItem(storageKey));
    return stored > 0 ? clampRatio(stored) : fallback;
  } catch {
    return fallback;
  }
};

const SplitPane: React.FC<SplitPaneProps> = ({ top, bottom, storageKey, defaultRatio = 0.5 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => readRatio(storageKey, defaultRatio));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(ratio));
    } catch {
      return;
    }
  }, [ratio, storageKey]);

  const startResize = (event: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const startRatio = ratio;
    const { height } = container.getBoundingClientRect();
    startDrag(event, 'row-resize', (_, deltaY) => setRatio(clampRatio(startRatio + deltaY / height)));
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col min-h-0">
      <div style={{ height: `${ratio * 100}%` }} className="min-h-0 flex flex-col">
        {top}
      </div>
      <div
        onMouseDown={startResize}
        onDoubleClick={() => setRatio(defaultRatio)}
        title="Arraste para redimensionar · duplo clique restaura"
        className="h-2 flex-shrink-0 cursor-row-resize group flex items-center justify-center border-y border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-zinc-950/40"
      >
        <div className="w-10 h-0.5 rounded-full bg-gray-300 dark:bg-white/10 group-hover:bg-amber-500/70 transition-colors" />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{bottom}</div>
    </div>
  );
};

export default SplitPane;
