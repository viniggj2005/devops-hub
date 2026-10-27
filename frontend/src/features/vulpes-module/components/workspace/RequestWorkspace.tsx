import toast from 'react-hot-toast';
import RequestView from './RequestView';
import RequestTabBar from './RequestTabBar';
import EmptyWorkspace from './EmptyWorkspace';
import CookiesView from '../cookies/CookiesView';
import SaveRequestModal from './SaveRequestModal';
import { useShallow } from 'zustand/react/shallow';
import { iconButtonClass } from '../editors/FormStyles';
import { SquareArrowOutUpRight, X } from 'lucide-react';
import { useAppStore } from '../../../appFrame/AppStore';
import { requestActions } from '../../actions/RequestActions';
import { isRequestTab, useVulpesStore } from '../../VulpesStore';
import { workspaceTabLabel } from '../../functions/WorkspaceTabs';
import { startDrag } from '../../../shared/functions/DragFunctions';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import SnapOverlay from '../../../shared/components/split/SnapOverlay';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { maxSplitPanes } from '../../../shared/constants/SplitDropZones';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import type { RequestTab, WorkspaceTab } from '../../../../interfaces/VulpesInterfaces';
import { SplitHandle, SplitRatios, computeSplitLayout, defaultSplitRatios } from '../../../shared/functions/SplitRects';

interface GroupRatios {
  ratios: SplitRatios;
  signature: string;
}

const isVulpesVisible = () => {
  const { tabs, activeTabId } = useAppStore.getState();
  return tabs.find((tab) => tab.id === activeTabId)?.type === 'vulpes';
};

const runActiveTab = (tab: RequestTab) => {
  switch (tab.request.protocol) {
    case 'http':
      return requestActions.sendHttp(tab.id);
    case 'grpc':
      return requestActions.runGrpc(tab.id);
    default:
      return useVulpesStore.getState().runtimes[tab.id]?.connection === 'connected' ? undefined : requestActions.connect(tab.id);
  }
};

const RequestWorkspace: React.FC = () => {
  const confirm = useConfirmToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const [saveTargetId, setSaveTargetId] = useState<string | null>(null);
  const [groupRatios, setGroupRatios] = useState<Record<string, GroupRatios>>({});
  const {
    tabs,
    groups,
    removeTabs,
    detachPane,
    activeTabId,
    activateTab,
    collections,
    activeGroupId,
    mergeGroupInto,
    draggingGroupId,
    setDraggingGroup,
  } = useVulpesStore(
    useShallow((state) => ({
      tabs: state.tabs,
      groups: state.groups,
      removeTabs: state.removeTabs,
      detachPane: state.detachPane,
      activeTabId: state.activeTabId,
      activateTab: state.activateTab,
      collections: state.collections,
      activeGroupId: state.activeGroupId,
      mergeGroupInto: state.mergeGroupInto,
      draggingGroupId: state.draggingGroupId,
      setDraggingGroup: state.setDraggingGroup,
    }))
  );

  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const draggedGroup = groups.find((group) => group.id === draggingGroupId);
  const isDraggingOtherGroup = Boolean(activeGroup && draggedGroup && draggedGroup.id !== activeGroup.id);
  const resultingCount = (activeGroup?.paneIds.length ?? 0) + (draggedGroup?.paneIds.length ?? 0);

  const save = useCallback(async (tabId: string) => {
    try {
      const outcome = await requestActions.save(tabId);
      if (outcome === 'needs-location') setSaveTargetId(tabId);
      else toast.success('Requisição salva');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, []);

  const closeTabs = (closing: WorkspaceTab[]) => {
    const discard = () => {
      closing.forEach((tab) => requestActions.releaseTab(tab.id));
      removeTabs(closing.map((tab) => tab.id));
    };
    const dirtyTabs = closing.filter((tab): tab is RequestTab => isRequestTab(tab) && tab.dirty);
    if (!dirtyTabs.length) {
      discard();
      return;
    }
    confirm({
      title: 'Descartar alterações?',
      message:
        dirtyTabs.length === 1
          ? `"${dirtyTabs[0].name}" tem alterações não salvas. Fechar mesmo assim?`
          : `${dirtyTabs.length} abas têm alterações não salvas. Fechar mesmo assim?`,
      onConfirm: discard,
    });
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || !isVulpesVisible()) return;
      const { tabs: currentTabs, activeTabId: currentId } = useVulpesStore.getState();
      const currentTab = currentTabs.find((tab) => tab.id === currentId);
      if (!isRequestTab(currentTab)) return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        save(currentTab.id);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        runActiveTab(currentTab);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [save]);

  const layout = (() => {
    if (!activeGroup) return null;
    const signature = `${activeGroup.paneIds.length}-${activeGroup.layout}`;
    const saved = groupRatios[activeGroup.id];
    const ratios = saved?.signature === signature ? saved.ratios : defaultSplitRatios;
    return { signature, ratios, ...computeSplitLayout(activeGroup.paneIds.length, activeGroup.layout, ratios) };
  })();

  const startSplitResize = (event: React.MouseEvent, splitHandle: SplitHandle) => {
    const container = contentRef.current;
    if (!container || !activeGroup || !layout) return;
    const bounds = container.getBoundingClientRect();
    const { signature, ratios } = layout;
    const groupId = activeGroup.id;
    const startPosition = splitHandle.position;
    startDrag(event, splitHandle.orientation === 'column' ? 'col-resize' : 'row-resize', (deltaX, deltaY) => {
      const delta = splitHandle.orientation === 'column' ? (deltaX / bounds.width) * 100 : (deltaY / bounds.height) * 100;
      const position = Math.min(85, Math.max(15, startPosition + delta));
      setGroupRatios((current) => ({ ...current, [groupId]: { signature, ratios: { ...ratios, [splitHandle.key]: position } } }));
    });
  };

  const paneControls = (tab: WorkspaceTab) => (
    <div className="flex items-center gap-0.5 flex-shrink-0 pl-1 ml-1 border-l border-gray-200 dark:border-white/10">
      <button type="button" title="Separar em uma nova aba" onClick={() => detachPane(tab.id)} className={iconButtonClass}>
        <SquareArrowOutUpRight className="w-3.5 h-3.5" />
      </button>
      <button type="button" title="Fechar este painel" onClick={() => closeTabs([tab])} className={`${iconButtonClass} hover:text-rose-500`}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col min-h-0">
      <RequestTabBar onClose={closeTabs} />
      <div ref={contentRef} className="flex-1 min-h-0 relative">
        {!activeGroup && <EmptyWorkspace />}
        {activeGroup &&
          layout &&
          activeGroup.paneIds.map((paneId, position) => {
            const tab = tabs.find((candidate) => candidate.id === paneId);
            if (!tab) return null;
            const rect = layout.rects[position];
            const isSplit = activeGroup.paneIds.length > 1;
            const focused = paneId === activeTabId;
            const controls = isSplit ? paneControls(tab) : undefined;
            return (
              <div
                key={paneId}
                aria-label={workspaceTabLabel(tab, collections)}
                onMouseDownCapture={() => !focused && activateTab(paneId)}
                style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
                className={`absolute ${isSplit ? 'p-1' : ''}`}
              >
                <div
                  className={`h-full flex flex-col overflow-hidden ${
                    isSplit ? `rounded-lg border ${focused ? 'border-amber-500/70' : 'border-gray-200 dark:border-white/10'}` : ''
                  }`}
                >
                  {tab.kind === 'request' ? (
                    <RequestView tab={tab} onSave={() => save(tab.id)} paneControls={controls} />
                  ) : (
                    <CookiesView tab={tab} paneControls={controls} />
                  )}
                </div>
              </div>
            );
          })}

        {layout?.handles.map((splitHandle) => {
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
              <div className={`rounded-full bg-transparent group-hover:bg-amber-500/60 transition-colors ${isColumn ? 'h-full w-0.5' : 'w-full h-0.5'}`} />
            </div>
          );
        })}

        {isDraggingOtherGroup && activeGroup && draggedGroup && (
          <SnapOverlay
            accent="amber"
            itemNoun="painéis"
            resultingCount={resultingCount}
            onCancel={() => setDraggingGroup(null)}
            canDrop={resultingCount <= maxSplitPanes}
            onDrop={(dropZone) => mergeGroupInto(draggedGroup.id, activeGroup.id, dropZone)}
            draggedTitle={draggedGroup.paneIds
              .map((paneId) => tabs.find((tab) => tab.id === paneId))
              .filter((tab): tab is WorkspaceTab => Boolean(tab))
              .map((tab) => workspaceTabLabel(tab, collections))
              .join(' | ')}
          />
        )}
      </div>
      <SaveRequestModal tabId={saveTargetId} onClose={() => setSaveTargetId(null)} />
    </div>
  );
};

export default RequestWorkspace;
