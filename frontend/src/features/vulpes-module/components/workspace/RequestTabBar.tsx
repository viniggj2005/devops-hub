import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVulpesStore } from '../../VulpesStore';
import { workspaceTabLabel } from '../../functions/WorkspaceTabs';
import type { TabGroup, WorkspaceTab } from '../../../../interfaces/VulpesInterfaces';
import { PROTOCOLS, protocolLabels, requestBadge } from '../../functions/RequestDefaults';
import ContextMenu, { ContextMenuEntry } from '../../../shared/components/menus/ContextMenu';
import { X, Plus, Layers, XCircle, Ungroup, ArrowLeft, ArrowRight, LayoutGrid, Cookie as CookieIcon } from 'lucide-react';

interface RequestTabBarProps {
  onClose: (tabs: WorkspaceTab[]) => void;
}

interface MenuState {
  x: number;
  y: number;
  group: TabGroup | null;
}

interface DropIndicator {
  groupId: string;
  side: 'before' | 'after';
}

const groupDragType = 'application/x-vulpes-tab-group';

const RequestTabBar: React.FC<RequestTabBarProps> = ({ onClose }) => {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const {
    tabs,
    groups,
    ungroup,
    moveGroup,
    openScratch,
    openCookies,
    collections,
    activeTabId,
    activateGroup,
    activeGroupId,
    draggingGroupId,
    setDraggingGroup,
  } = useVulpesStore(
    useShallow((state) => ({
      tabs: state.tabs,
      groups: state.groups,
      ungroup: state.ungroup,
      moveGroup: state.moveGroup,
      openScratch: state.openScratch,
      openCookies: state.openCookies,
      collections: state.collections,
      activeTabId: state.activeTabId,
      activateGroup: state.activateGroup,
      activeGroupId: state.activeGroupId,
      draggingGroupId: state.draggingGroupId,
      setDraggingGroup: state.setDraggingGroup,
    }))
  );

  const panesOf = (group: TabGroup) =>
    group.paneIds.map((paneId) => tabs.find((tab) => tab.id === paneId)).filter((tab): tab is WorkspaceTab => Boolean(tab));

  const labelOf = (tab: WorkspaceTab) => workspaceTabLabel(tab, collections);

  const currentCollectionId = () => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    return activeTab?.collectionId ?? collections[0]?.id ?? null;
  };

  const menuEntries = (group: TabGroup | null): ContextMenuEntry[] => {
    if (!group) {
      return [
        ...PROTOCOLS.map((protocol) => ({
          icon: Plus,
          label: `Nova requisição ${protocolLabels[protocol]}`,
          onClick: () => openScratch(protocol),
        })),
        'separator',
        { icon: CookieIcon, label: 'Gerenciar cookies', onClick: () => openCookies(currentCollectionId()) },
      ];
    }
    const groupIndex = groups.findIndex((candidate) => candidate.id === group.id);
    const groupPanes = panesOf(group);
    const otherPanes = groups.filter((candidate) => candidate.id !== group.id).flatMap(panesOf);
    return [
      { icon: X, label: groupPanes.length > 1 ? 'Fechar todos os painéis' : 'Fechar', onClick: () => onClose(groupPanes) },
      { icon: Layers, label: 'Fechar as outras', disabled: otherPanes.length === 0, onClick: () => onClose(otherPanes) },
      { icon: XCircle, label: 'Fechar todas', onClick: () => onClose(tabs) },
      'separator',
      { icon: Ungroup, label: 'Separar painéis', disabled: groupPanes.length < 2, onClick: () => ungroup(group.id) },
      { icon: ArrowLeft, label: 'Mover para a esquerda', disabled: groupIndex <= 0, onClick: () => moveGroup(group.id, groupIndex - 1) },
      {
        icon: ArrowRight,
        label: 'Mover para a direita',
        disabled: groupIndex >= groups.length - 1,
        onClick: () => moveGroup(group.id, groupIndex + 2),
      },
    ];
  };

  const sideFromPointer = (event: React.DragEvent<HTMLDivElement>): DropIndicator['side'] => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX - bounds.left < bounds.width / 2 ? 'before' : 'after';
  };

  const finishDrag = () => {
    setDraggingGroup(null);
    setDropIndicator(null);
  };

  const dropOnGroup = (event: React.DragEvent<HTMLDivElement>, targetGroupId: string) => {
    event.preventDefault();
    const sourceGroupId = event.dataTransfer.getData(groupDragType) || draggingGroupId;
    finishDrag();
    if (!sourceGroupId || sourceGroupId === targetGroupId) return;
    const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
    moveGroup(sourceGroupId, sideFromPointer(event) === 'before' ? targetIndex : targetIndex + 1);
  };

  return (
    <div className="flex items-stretch h-10 flex-shrink-0 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-950/40">
      <div
        className="flex items-stretch overflow-x-auto overflow-y-hidden min-w-0"
        onDragOver={(event) => draggingGroupId && event.preventDefault()}
        onDrop={(event) => {
          if (!draggingGroupId || event.defaultPrevented) return;
          event.preventDefault();
          moveGroup(draggingGroupId, groups.length);
          finishDrag();
        }}
      >
        {groups.map((group) => {
          const panes = panesOf(group);
          if (!panes.length) return null;
          const active = group.id === activeGroupId;
          const isSplit = panes.length > 1;
          const dirty = panes.some((tab) => tab.kind === 'request' && tab.dirty);
          const title = panes.map(labelOf).join(' | ');
          const firstPane = panes[0];
          const badge = firstPane.kind === 'request' ? requestBadge(firstPane.request) : null;
          const indicator = dropIndicator?.groupId === group.id && draggingGroupId !== group.id ? dropIndicator.side : null;
          const isUnsaved = firstPane.kind === 'request' && !firstPane.itemId;
          return (
            <div
              key={group.id}
              draggable
              onClick={() => activateGroup(group.id)}
              onMouseDown={(event) => event.button === 1 && event.preventDefault()}
              onAuxClick={(event) => event.button === 1 && onClose(panes)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ x: event.clientX, y: event.clientY, group });
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData(groupDragType, group.id);
                event.dataTransfer.setData('text/plain', title);
                setDraggingGroup(group.id);
              }}
              onDragEnd={finishDrag}
              onDragOver={(event) => {
                if (!draggingGroupId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                const side = sideFromPointer(event);
                if (dropIndicator?.groupId !== group.id || dropIndicator.side !== side) setDropIndicator({ groupId: group.id, side });
              }}
              onDragLeave={() => dropIndicator?.groupId === group.id && setDropIndicator(null)}
              onDrop={(event) => dropOnGroup(event, group.id)}
              title={`${title}${isSplit ? ` — ${panes.length} painéis` : ''}\nArraste para reordenar ou solte sobre a área aberta para dividir a tela`}
              className={`group relative flex items-center gap-2 pl-3 pr-1.5 min-w-[140px] max-w-[280px] flex-shrink-0 text-xs border-r border-gray-200 dark:border-white/5 cursor-pointer transition-colors ${
                draggingGroupId === group.id ? 'opacity-50' : ''
              } ${
                active
                  ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-zinc-500 hover:bg-white/60 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-zinc-200'
              }`}
            >
              {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-600" />}
              {indicator && <span className={`absolute inset-y-1 w-0.5 rounded-full bg-amber-500 ${indicator === 'before' ? '-left-px' : '-right-px'}`} />}
              {isSplit ? (
                <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
              ) : badge ? (
                <span className={`flex-shrink-0 text-[10px] font-extrabold ${badge.className}`}>{badge.label}</span>
              ) : (
                <CookieIcon className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
              )}
              <span className={`flex-1 min-w-0 truncate font-semibold ${isUnsaved && !isSplit ? 'italic' : ''}`}>{title}</span>
              {isSplit && (
                <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">
                  {panes.length}
                </span>
              )}
              {dirty && <span title="Alterações não salvas" className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 group-hover:hidden" />}
              <button
                type="button"
                title={isSplit ? 'Fechar todos os painéis' : 'Fechar aba'}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(panes);
                }}
                className={`p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${dirty ? 'hidden group-hover:block' : ''}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        title="Nova requisição"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setMenu({ x: bounds.left, y: bounds.bottom + 4, group: null });
        }}
        className="px-3 flex items-center text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          entries={menuEntries(menu.group)}
          title={menu.group ? panesOf(menu.group).map(labelOf).join(' | ') : undefined}
        />
      )}
    </div>
  );
};

export default RequestTabBar;
