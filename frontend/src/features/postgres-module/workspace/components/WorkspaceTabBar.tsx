import React from 'react';
import { tabIcons } from '../constants/TabIcons';
import { usePostgresStore } from '../../PostgresStore';
import { GripVertical, LayoutGrid, X } from 'lucide-react';
import { useCloseWorkspaceTabs } from '../hooks/useCloseWorkspaceTabs';
import type { WorkspaceGroup, WorkspaceTab } from '../../../../interfaces/PostgresInterfaces';

const paneSubtitle = (tab: WorkspaceTab) =>
  tab.type === 'dashboard' ? tab.connectionName : `${tab.database} @ ${tab.connectionName}`;

const WorkspaceTabBar: React.FC = () => {
  const { closeWholeGroup } = useCloseWorkspaceTabs();
  const { tabs, groups, activeGroupId, tabTxStatus, setActiveGroup, setDraggingGroup } = usePostgresStore();

  if (!groups.length) return null;

  const groupTabs = (group: WorkspaceGroup) =>
    group.paneIds.map((paneId) => tabs.find((tab) => tab.id === paneId)).filter((tab): tab is WorkspaceTab => Boolean(tab));

  return (
    <div className="flex items-stretch h-11 flex-shrink-0 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-950/40 overflow-x-auto overflow-y-hidden">
      {groups.map((group) => {
        const panes = groupTabs(group);
        if (!panes.length) return null;
        const active = group.id === activeGroupId;
        const isSplit = panes.length > 1;
        const canDrag = !active && Boolean(activeGroupId);
        const { icon: Icon, className } = tabIcons[panes[0].type];
        const statuses = panes.map((tab) => tabTxStatus[tab.id]);
        const failed = statuses.includes('failed');
        const inTransaction = failed || statuses.includes('transaction');
        const title = panes.map((tab) => tab.title).join(' | ');

        return (
          <div
            key={group.id}
            draggable={canDrag}
            onDragStart={(event) => {
              if (!canDrag) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', group.id);
              setDraggingGroup(group.id);
            }}
            onDragEnd={() => setDraggingGroup(null)}
            onClick={() => setActiveGroup(group.id)}
            onMouseDown={(event) => event.button === 1 && event.preventDefault()}
            onAuxClick={(event) => event.button === 1 && closeWholeGroup(group)}
            title={canDrag ? `${title} — arraste até a área aberta para dividir a tela` : `${title} — ${isSplit ? `${panes.length} painéis` : paneSubtitle(panes[0])}`}
            className={`group relative flex items-center gap-2 pl-3 pr-2 min-w-[150px] max-w-[280px] flex-shrink-0 text-xs border-r border-gray-200 dark:border-white/5 transition-colors ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
              active
                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-zinc-500 hover:bg-white/60 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-zinc-200'
            }`}
          >
            {active && (
              <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
            )}
            {canDrag ? (
              <GripVertical className="w-3.5 h-3.5 -ml-1 flex-shrink-0 opacity-40 group-hover:opacity-100" />
            ) : isSplit ? (
              <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0 text-cyan-500" />
            ) : (
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${className}`} />
            )}
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="truncate font-semibold">{title}</span>
              <span className="truncate text-[10px] text-gray-400 dark:text-zinc-500">
                {isSplit ? `${panes.length} painéis` : paneSubtitle(panes[0])}
              </span>
            </div>
            {inTransaction && (
              <span
                title={failed ? 'Transação com erro' : 'Transação aberta'}
                className={`h-2 w-2 rounded-full flex-shrink-0 ${failed ? 'bg-rose-500' : 'bg-amber-500'}`}
              />
            )}
            <button
              onClick={(event) => {
                event.stopPropagation();
                closeWholeGroup(group);
              }}
              title={isSplit ? 'Fechar todos os painéis' : 'Fechar aba'}
              className={`p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-opacity ${
                active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default WorkspaceTabBar;
