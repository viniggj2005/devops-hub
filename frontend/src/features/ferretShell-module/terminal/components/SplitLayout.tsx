import TerminalInstance from './TerminalInstance';
import { useTerminalStore } from '../TerminalStore';
import { SquareArrowOutUpRight, X } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import { TerminalTab, TerminalInstance as ITerminalInstance } from '../../../../interfaces/TerminalInterfaces';

interface SplitLayoutProps {
  tab: TerminalTab;
}

type SplitSetter = (value: number) => void;

interface ResizeHandleProps {
  onStart: () => void;
  orientation: 'column' | 'row';
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ orientation, onStart }) => {
  const isColumn = orientation === 'column';
  return (
    <div
      onMouseDown={onStart}
      className={`group relative z-30 shrink-0 bg-zinc-900 transition-colors hover:bg-purple-500/50 ${isColumn ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}`}
    >
      <div className={`absolute z-40 ${isColumn ? 'inset-y-0 -left-2 -right-2' : 'inset-x-0 -top-2 -bottom-2'}`} />
      <div className={`absolute bg-white/10 group-hover:bg-white/30 ${isColumn ? 'inset-y-0 left-1/2 -translate-x-1/2 w-0.5' : 'inset-x-0 top-1/2 -translate-y-1/2 h-0.5'}`} />
    </div>
  );
};

const SplitLayout: React.FC<SplitLayoutProps> = ({ tab }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnSplit, setColumnSplit] = useState(50);
  const [firstRowSplit, setFirstRowSplit] = useState(50);
  const [secondRowSplit, setSecondRowSplit] = useState(50);
  const removeInstance = useTerminalStore(state => state.removeInstance);
  const detachInstance = useTerminalStore(state => state.detachInstance);
  const terminalBackground = useGeneralConfigsStore(state => state.terminalTheme.colors.background);

  const { instances } = tab;
  const count = instances.length;
  const showPaneHeaders = count > 1;
  const layout = tab.preferredLayout || 'vertical';

  useEffect(() => {
    setColumnSplit(50);
    setFirstRowSplit(50);
    setSecondRowSplit(50);
  }, [count, layout]);

  if (count === 0) return null;

  const startDragging = (orientation: 'column' | 'row', setSplit: SplitSetter) => () => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const position = orientation === 'column'
        ? ((event.clientX - bounds.left) / bounds.width) * 100
        : ((event.clientY - bounds.top) / bounds.height) * 100;
      setSplit(Math.max(10, Math.min(90, position)));
    };
    const stopDragging = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      document.body.style.cursor = 'default';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    document.body.style.cursor = orientation === 'column' ? 'col-resize' : 'row-resize';
  };

  const columnHandle = (onStart: () => void) => <ResizeHandle orientation="column" onStart={onStart} />;
  const rowHandle = (onStart: () => void) => <ResizeHandle orientation="row" onStart={onStart} />;

  const renderTerminal = (instance: ITerminalInstance) => (
    <div key={instance.id} className="flex flex-col w-full h-full overflow-hidden border border-white/5">
      {showPaneHeaders && (
        <div className="flex h-7 shrink-0 items-center gap-2 border-b border-white/5 bg-zinc-900/90 pl-3 pr-1 text-[11px] text-zinc-400">
          <span className="flex-1 truncate font-medium">{instance.title}</span>
          <button
            type="button"
            title="Separar em uma nova aba"
            aria-label={`Separar ${instance.title} em uma nova aba`}
            onClick={() => detachInstance(tab.id, instance.id)}
            className="rounded p-1 hover:bg-white/10 hover:text-white"
          >
            <SquareArrowOutUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Fechar este terminal"
            aria-label={`Fechar ${instance.title}`}
            onClick={() => removeInstance(tab.id, instance.id)}
            className="rounded p-1 hover:bg-red-500/20 hover:text-red-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div style={{ backgroundColor: terminalBackground }} className="relative flex-1 min-h-0">
        <TerminalInstance instance={instance} />
      </div>
    </div>
  );

  const renderContent = () => {
    switch (count) {
      case 1:
        return renderTerminal(instances[0]);

      case 2:
        if (layout === 'horizontal') {
          return (
            <div className="flex flex-col w-full h-full">
              <div style={{ height: `${firstRowSplit}%` }}>{renderTerminal(instances[0])}</div>
              {rowHandle(startDragging('row', setFirstRowSplit))}
              <div style={{ height: `${100 - firstRowSplit}%` }}>{renderTerminal(instances[1])}</div>
            </div>
          );
        }
        return (
          <div className="flex w-full h-full">
            <div style={{ width: `${columnSplit}%` }}>{renderTerminal(instances[0])}</div>
            {columnHandle(startDragging('column', setColumnSplit))}
            <div style={{ width: `${100 - columnSplit}%` }}>{renderTerminal(instances[1])}</div>
          </div>
        );

      case 3:
        if (layout === 'horizontal') {
          return (
            <div className="flex flex-col w-full h-full">
              <div style={{ height: `${firstRowSplit}%` }}>{renderTerminal(instances[0])}</div>
              {rowHandle(startDragging('row', setFirstRowSplit))}
              <div style={{ height: `${100 - firstRowSplit}%` }} className="flex">
                <div style={{ width: `${columnSplit}%` }}>{renderTerminal(instances[1])}</div>
                {columnHandle(startDragging('column', setColumnSplit))}
                <div style={{ width: `${100 - columnSplit}%` }}>{renderTerminal(instances[2])}</div>
              </div>
            </div>
          );
        }
        return (
          <div className="flex w-full h-full">
            <div style={{ width: `${columnSplit}%` }}>{renderTerminal(instances[0])}</div>
            {columnHandle(startDragging('column', setColumnSplit))}
            <div style={{ width: `${100 - columnSplit}%` }} className="flex flex-col">
              <div style={{ height: `${secondRowSplit}%` }}>{renderTerminal(instances[1])}</div>
              {rowHandle(startDragging('row', setSecondRowSplit))}
              <div style={{ height: `${100 - secondRowSplit}%` }}>{renderTerminal(instances[2])}</div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="flex w-full h-full">
            <div style={{ width: `${columnSplit}%` }} className="flex flex-col">
              <div style={{ height: `${firstRowSplit}%` }}>{renderTerminal(instances[0])}</div>
              {rowHandle(startDragging('row', setFirstRowSplit))}
              <div style={{ height: `${100 - firstRowSplit}%` }}>{renderTerminal(instances[2])}</div>
            </div>
            {columnHandle(startDragging('column', setColumnSplit))}
            <div style={{ width: `${100 - columnSplit}%` }} className="flex flex-col">
              <div style={{ height: `${secondRowSplit}%` }}>{renderTerminal(instances[1])}</div>
              {rowHandle(startDragging('row', setSecondRowSplit))}
              <div style={{ height: `${100 - secondRowSplit}%` }}>{renderTerminal(instances[3])}</div>
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
