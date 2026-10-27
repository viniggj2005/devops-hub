import QueryTab from './query/QueryTab';
import DiagramTab from './diagram/DiagramTab';
import { tabIcons } from './constants/TabIcons';
import { useTalpadbStore } from '../TalpadbStore';
import { useAppStore } from '../../appFrame/AppStore';
import ObjectExplorer from './explorer/ObjectExplorer';
import EmptyWorkspace from './components/EmptyWorkspace';
import WorkspaceTabBar from './components/WorkspaceTabBar';
import TablePropertiesTab from './table/TablePropertiesTab';
import ServerDashboardTab from './dashboard/ServerDashboardTab';
import { startDrag } from '../../shared/functions/DragFunctions';
import SnapOverlay from '../../shared/components/split/SnapOverlay';
import { useCloseWorkspaceTabs } from './hooks/useCloseWorkspaceTabs';
import { maxSplitPanes } from '../../shared/constants/SplitDropZones';
import { PanelLeftOpen, SquareArrowOutUpRight, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceTab } from '../../../interfaces/TalpadbInterfaces';
import { computeSplitLayout, defaultSplitRatios, SplitHandle, SplitRatios } from '../../shared/functions/SplitRects';

const EXPLORER_STORAGE_KEY = 'talpadb-explorer-layout';

const LEGACY_EXPLORER_STORAGE_KEY = 'postgres-explorer-layout';

interface ExplorerLayout {
  width: number;
  collapsed: boolean;
}

const readExplorerLayout = (): ExplorerLayout => {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPLORER_STORAGE_KEY) ?? localStorage.getItem(LEGACY_EXPLORER_STORAGE_KEY) ?? '{}');
    return {
      collapsed: saved.collapsed === true,
      width: typeof saved.width === 'number' ? Math.min(600, Math.max(220, saved.width)) : 300,
    };
  } catch {
    return { width: 300, collapsed: false };
  }
};

const renderTab = (tab: WorkspaceTab, focused: boolean, visible: boolean) => {
  switch (tab.type) {
    case 'query':
      return <QueryTab tab={tab} active={focused} />;
    case 'table':
      return <TablePropertiesTab tab={tab} />;
    case 'diagram':
      return <DiagramTab tab={tab} />;
    case 'dashboard':
      return <ServerDashboardTab tab={tab} active={visible} />;
  }
};

const WorkspacePage: React.FC = () => {
  const { closePane } = useCloseWorkspaceTabs();
  const contentRef = useRef<HTMLDivElement>(null);
  const [explorer, setExplorer] = useState<ExplorerLayout>(readExplorerLayout);
  const [groupRatios, setGroupRatios] = useState<Record<string, { signature: string; ratios: SplitRatios }>>({});
  const {
    tabs,
    groups,
    detachPane,
    activeTabId,
    setActiveTab,
    activeGroupId,
    mergeGroupInto,
    draggingGroupId,
    setDraggingGroup,
  } = useTalpadbStore();

  useEffect(() => {
    try {
      localStorage.setItem(EXPLORER_STORAGE_KEY, JSON.stringify(explorer));
    } catch {
      return;
    }
  }, [explorer]);

  const toggleExplorer = useCallback(() => setExplorer((current) => ({ ...current, collapsed: !current.collapsed })), []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const { tabs: appTabs, activeTabId: activeAppTabId } = useAppStore.getState();
      const talpadbVisible = appTabs.find((appTab) => appTab.id === activeAppTabId)?.type === 'talpadb';
      if (!talpadbVisible || useTalpadbStore.getState().view !== 'workspace') return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleExplorer();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleExplorer]);

  const startExplorerResize = (event: React.MouseEvent) => {
    const startWidth = explorer.width;
    startDrag(event, 'col-resize', (deltaX) =>
      setExplorer((current) => ({ ...current, width: Math.min(600, Math.max(220, startWidth + deltaX)) }))
    );
  };

  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const draggedGroup = groups.find((group) => group.id === draggingGroupId);
  const isDraggingOtherGroup = Boolean(activeGroup && draggedGroup && draggedGroup.id !== activeGroup.id);
  const resultingCount = (activeGroup?.paneIds.length ?? 0) + (draggedGroup?.paneIds.length ?? 0);

  const layoutOf = (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return null;
    const signature = `${group.paneIds.length}-${group.layout}`;
    const saved = groupRatios[groupId];
    const ratios = saved?.signature === signature ? saved.ratios : defaultSplitRatios;
    return { group, signature, ratios, ...computeSplitLayout(group.paneIds.length, group.layout, ratios) };
  };

  const activeLayout = activeGroup ? layoutOf(activeGroup.id) : null;

  const startSplitResize = (event: React.MouseEvent, splitHandle: SplitHandle) => {
    const container = contentRef.current;
    if (!container || !activeLayout) return;
    const bounds = container.getBoundingClientRect();
    const { group, signature, ratios } = activeLayout;
    const startPosition = splitHandle.position;
    startDrag(event, splitHandle.orientation === 'column' ? 'col-resize' : 'row-resize', (deltaX, deltaY) => {
      const delta = splitHandle.orientation === 'column' ? (deltaX / bounds.width) * 100 : (deltaY / bounds.height) * 100;
      const position = Math.min(90, Math.max(10, startPosition + delta));
      setGroupRatios((current) => ({
        ...current,
        [group.id]: { signature, ratios: { ...ratios, [splitHandle.key]: position } },
      }));
    });
  };

  const paneTitle = (tab: WorkspaceTab) => {
    const { icon: Icon, className } = tabIcons[tab.type];
    return (
      <div className="flex h-7 flex-shrink-0 items-center gap-2 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-zinc-950/60 pl-3 pr-1 text-[11px] text-gray-500 dark:text-zinc-400">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${className}`} />
        <span className="truncate font-semibold text-gray-700 dark:text-zinc-200">{tab.title}</span>
        <span className="truncate flex-1 text-gray-400 dark:text-zinc-500">
          {tab.type === 'dashboard' ? tab.connectionName : `${tab.database} @ ${tab.connectionName}`}
        </span>
        <button
          type="button"
          title="Separar em uma nova aba"
          onClick={() => detachPane(tab.id)}
          className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white"
        >
          <SquareArrowOutUpRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Fechar este painel"
          onClick={() => closePane(tab)}
          className="rounded p-1 hover:bg-rose-500/15 hover:text-rose-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex p-3">
      {explorer.collapsed ? (
        <aside className="w-11 flex-shrink-0 flex flex-col items-center py-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg">
          <button
            onClick={toggleExplorer}
            title="Mostrar explorador (Ctrl+B)"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </aside>
      ) : (
        <>
          <aside
            style={{ width: explorer.width }}
            className="flex-shrink-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg overflow-hidden"
          >
            <ObjectExplorer onCollapse={toggleExplorer} />
          </aside>
          <div
            onMouseDown={startExplorerResize}
            onDoubleClick={toggleExplorer}
            title="Arraste para redimensionar · duplo clique recolhe"
            className="w-3 flex-shrink-0 cursor-col-resize group flex items-center justify-center"
          >
            <div className="h-10 w-1 rounded-full bg-gray-300/70 dark:bg-white/10 group-hover:bg-cyan-500/60 transition-colors" />
          </div>
        </>
      )}
      {explorer.collapsed && <div className="w-3 flex-shrink-0" />}

      <section className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg overflow-hidden">
        <WorkspaceTabBar />
        <div ref={contentRef} className="flex-1 min-h-0 relative">
          {tabs.length === 0 && <EmptyWorkspace />}
          {tabs.map((tab) => {
            const group = groups.find((item) => item.paneIds.includes(tab.id));
            const layout = group ? layoutOf(group.id) : null;
            if (!group || !layout) return null;
            const visible = group.id === activeGroupId;
            const isSplit = group.paneIds.length > 1;
            const focused = visible && tab.id === activeTabId;
            const paneRect = layout.rects[group.paneIds.indexOf(tab.id)];
            return (
              // Sem "visible" explícito no grupo ativo: ele precisa herdar o "invisible" do workspace quando a Home está aberta.
              <div
                key={tab.id}
                onMouseDownCapture={() => !focused && setActiveTab(tab.id)}
                style={{ left: `${paneRect.left}%`, top: `${paneRect.top}%`, width: `${paneRect.width}%`, height: `${paneRect.height}%` }}
                className={`absolute ${visible ? '' : 'invisible'} ${isSplit ? 'p-1' : ''}`}
              >
                <div
                  className={`h-full flex flex-col overflow-hidden ${isSplit ? `rounded-lg border ${focused ? 'border-cyan-500/70' : 'border-gray-200 dark:border-white/10'}` : ''}`}
                >
                  {isSplit && paneTitle(tab)}
                  <div className="flex-1 min-h-0 relative">{renderTab(tab, focused, visible)}</div>
                </div>
              </div>
            );
          })}

          {activeLayout?.handles.map((splitHandle) => {
            const isColumn = splitHandle.orientation === 'column';
            const span = `${splitHandle.end - splitHandle.start}%`;
            return (
              <div
                key={splitHandle.key}
                onMouseDown={(event) => startSplitResize(event, splitHandle)}
                style={
                  isColumn
                    ? { left: `calc(${splitHandle.position}% - 4px)`, top: `${splitHandle.start}%`, height: span }
                    : { top: `calc(${splitHandle.position}% - 4px)`, left: `${splitHandle.start}%`, width: span }
                }
                className={`absolute z-20 group flex items-center justify-center ${isColumn ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'}`}
              >
                <div
                  className={`rounded-full bg-transparent group-hover:bg-cyan-500/60 transition-colors ${isColumn ? 'h-full w-0.5' : 'w-full h-0.5'}`}
                />
              </div>
            );
          })}

          {isDraggingOtherGroup && activeGroup && draggedGroup && (
            <SnapOverlay
              accent="cyan"
              itemNoun="painéis"
              resultingCount={resultingCount}
              onCancel={() => setDraggingGroup(null)}
              canDrop={resultingCount <= maxSplitPanes}
              onDrop={(dropZone) => mergeGroupInto(draggedGroup.id, activeGroup.id, dropZone)}
              draggedTitle={tabs.filter((tab) => draggedGroup.paneIds.includes(tab.id)).map((tab) => tab.title).join(' | ')}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default WorkspacePage;
