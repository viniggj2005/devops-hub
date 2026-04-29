import TerminalInstance from './TerminalInstance';
import { useTerminalStore } from '../TerminalStore';
import React, { useState, useRef, useEffect } from 'react';
import { TerminalInstance as ITerminalInstance } from '../../../../interfaces/TerminalInterfaces';

interface Props {
  instances: ITerminalInstance[];
  tabId: string;
}

const SplitLayout: React.FC<Props> = ({ instances, tabId }) => {
  const [vSplit, setVSplit] = useState(50);
  const [hSplit1, setHSplit1] = useState(50);
  const [hSplit2, setHSplit2] = useState(50);

  const containerRef = useRef<HTMLDivElement>(null);
  const count = instances.length;
  useEffect(() => {
    setVSplit(50);
    setHSplit1(50);
    setHSplit2(50);
  }, [count]);

  if (count === 0) return null;

  const handleMouseMoveV = (event: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((event.clientX - rect.left) / rect.width) * 100;
    setVSplit(Math.max(10, Math.min(90, pos)));
  };

  const handleMouseMoveH1 = (event: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((event.clientY - rect.top) / rect.height) * 100;
    setHSplit1(Math.max(10, Math.min(90, pos)));
  };

  const handleMouseMoveH2 = (event: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((event.clientY - rect.top) / rect.height) * 100;
    setHSplit2(Math.max(10, Math.min(90, pos)));
  };

  const stopDragging = () => {
    window.removeEventListener('mousemove', handleMouseMoveV);
    window.removeEventListener('mousemove', handleMouseMoveH1);
    window.removeEventListener('mousemove', handleMouseMoveH2);
    window.removeEventListener('mouseup', stopDragging);
    document.body.style.cursor = 'default';
  };

  const startDraggingV = () => {
    window.addEventListener('mousemove', handleMouseMoveV);
    window.addEventListener('mouseup', stopDragging);
    document.body.style.cursor = 'col-resize';
  };

  const startDraggingH1 = () => {
    window.addEventListener('mousemove', handleMouseMoveH1);
    window.addEventListener('mouseup', stopDragging);
    document.body.style.cursor = 'row-resize';
  };

  const startDraggingH2 = () => {
    window.addEventListener('mousemove', handleMouseMoveH2);
    window.addEventListener('mouseup', stopDragging);
    document.body.style.cursor = 'row-resize';
  };

  const renderTerminal = (instance: ITerminalInstance) => (
    <div key={instance.id} className="relative w-full h-full overflow-hidden border border-white/5 bg-[#0e172a]">
      <TerminalInstance instance={instance} />
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/40 text-[10px] text-white/50 backdrop-blur-sm pointer-events-none z-10 border border-white/5">
        {instance.title}
      </div>
    </div>
  );

  const { tabs } = useTerminalStore();
  const tab = tabs.find((tab) => tab.id === tabId);
  const layout = tab?.preferredLayout || 'vertical';

  const renderContent = () => {
    switch (count) {
      case 1:
        return renderTerminal(instances[0]);

      case 2:
        if (layout === 'horizontal') {
          return (
            <div className="flex flex-col w-full h-full relative">
              <div style={{ height: `${hSplit1}%` }}>{renderTerminal(instances[0])}</div>
              <div
                className="group relative h-1 z-30 cursor-row-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
                onMouseDown={startDraggingH1}
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2 z-40" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 group-hover:bg-white/30" />
              </div>
              <div style={{ height: `${100 - hSplit1}%` }}>{renderTerminal(instances[1])}</div>
            </div>
          );
        }
        return (
          <div className="flex w-full h-full relative">
            <div style={{ width: `${vSplit}%` }}>{renderTerminal(instances[0])}</div>
            <div
              className="group relative w-1 z-30 cursor-col-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
              onMouseDown={startDraggingV}
            >
              <div className="absolute inset-y-0 -left-2 -right-2 z-40" />
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 group-hover:bg-white/30" />
            </div>
            <div style={{ width: `${100 - vSplit}%` }}>{renderTerminal(instances[1])}</div>
          </div>
        );

      case 3:
        if (layout === 'horizontal') {
          return (
            <div className="flex flex-col w-full h-full relative">
              <div style={{ height: `${hSplit1}%` }}>{renderTerminal(instances[0])}</div>
              <div
                className="group relative h-1 z-30 cursor-row-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
                onMouseDown={startDraggingH1}
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2 z-40" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 group-hover:bg-white/30" />
              </div>
              <div style={{ height: `${100 - hSplit1}%` }} className="flex relative">
                <div style={{ width: `${vSplit}%` }}>{renderTerminal(instances[1])}</div>
                <div
                  className="group relative w-1 z-30 cursor-col-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
                  onMouseDown={startDraggingV}
                >
                  <div className="absolute inset-y-0 -left-2 -right-2 z-40" />
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 group-hover:bg-white/30" />
                </div>
                <div style={{ width: `${100 - vSplit}%` }}>{renderTerminal(instances[2])}</div>
              </div>
            </div>
          );
        }
        return (
          <div className="flex w-full h-full relative">
            <div style={{ width: `${vSplit}%` }}>{renderTerminal(instances[0])}</div>
            <div
              className="group relative w-1 z-30 cursor-col-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
              onMouseDown={startDraggingV}
            >
              <div className="absolute inset-y-0 -left-2 -right-2 z-40" />
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 group-hover:bg-white/30" />
            </div>
            <div style={{ width: `${100 - vSplit}%` }} className="flex flex-col relative">
              <div style={{ height: `${hSplit2}%` }}>{renderTerminal(instances[1])}</div>
              <div
                className="group relative h-1 z-30 cursor-row-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
                onMouseDown={startDraggingH2}
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2 z-40" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 group-hover:bg-white/30" />
              </div>
              <div style={{ height: `${100 - hSplit2}%` }}>{renderTerminal(instances[2])}</div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="flex w-full h-full relative">
            <div style={{ width: `${vSplit}%` }} className="flex flex-col relative">
              <div style={{ height: `${hSplit1}%` }}>{renderTerminal(instances[0])}</div>
              <div
                className="group relative h-1 z-30 cursor-row-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
                onMouseDown={startDraggingH1}
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2 z-40" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 group-hover:bg-white/30" />
              </div>
              <div style={{ height: `${100 - hSplit1}%` }}>{renderTerminal(instances[2])}</div>
            </div>

            <div
              className="group relative w-1 z-30 cursor-col-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
              onMouseDown={startDraggingV}
            >
              <div className="absolute inset-y-0 -left-2 -right-2 z-40" />
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 group-hover:bg-white/30" />
            </div>

            <div style={{ width: `${100 - vSplit}%` }} className="flex flex-col relative">
              <div style={{ height: `${hSplit2}%` }}>{renderTerminal(instances[1])}</div>
              <div
                className="group relative h-1 z-30 cursor-row-resize bg-zinc-900 transition-colors hover:bg-purple-500/50"
                onMouseDown={startDraggingH2}
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2 z-40" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 group-hover:bg-white/30" />
              </div>
              <div style={{ height: `${100 - hSplit2}%` }}>{renderTerminal(instances[3])}</div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950 select-none">
      {renderContent()}
    </div>
  );
};

export default SplitLayout;
