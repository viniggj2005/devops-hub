import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVulpesStore } from '../../VulpesStore';
import { Plus, X, XCircle, Layers } from 'lucide-react';
import type { RequestTab } from '../../../../interfaces/VulpesInterfaces';
import { PROTOCOLS, protocolLabels, requestBadge } from '../../functions/RequestDefaults';
import ContextMenu, { ContextMenuEntry } from '../../../shared/components/menus/ContextMenu';

interface RequestTabBarProps {
  onClose: (tabs: RequestTab[]) => void;
}

interface MenuState {
  x: number;
  y: number;
  tab: RequestTab | null;
}

const RequestTabBar: React.FC<RequestTabBarProps> = ({ onClose }) => {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const { tabs, activeTabId, activateTab, openScratch } = useVulpesStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      activateTab: state.activateTab,
      openScratch: state.openScratch,
    }))
  );

  const menuEntries = (tab: RequestTab | null): ContextMenuEntry[] => {
    if (!tab) {
      return PROTOCOLS.map((protocol) => ({
        icon: Plus,
        label: `Nova requisição ${protocolLabels[protocol]}`,
        onClick: () => openScratch(protocol),
      }));
    }
    return [
      { icon: X, label: 'Fechar', onClick: () => onClose([tab]) },
      { icon: Layers, label: 'Fechar as outras', disabled: tabs.length < 2, onClick: () => onClose(tabs.filter((candidate) => candidate.id !== tab.id)) },
      { icon: XCircle, label: 'Fechar todas', onClick: () => onClose(tabs) },
    ];
  };

  return (
    <div className="flex items-stretch h-10 flex-shrink-0 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-950/40">
      <div className="flex items-stretch overflow-x-auto overflow-y-hidden min-w-0">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const badge = requestBadge(tab.request);
          return (
            <div
              key={tab.id}
              title={tab.name}
              onClick={() => activateTab(tab.id)}
              onMouseDown={(event) => event.button === 1 && event.preventDefault()}
              onAuxClick={(event) => event.button === 1 && onClose([tab])}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ x: event.clientX, y: event.clientY, tab });
              }}
              className={`group relative flex items-center gap-2 pl-3 pr-1.5 min-w-[140px] max-w-[240px] flex-shrink-0 text-xs border-r border-gray-200 dark:border-white/5 cursor-pointer transition-colors ${
                active
                  ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-zinc-500 hover:bg-white/60 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-zinc-200'
              }`}
            >
              {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-600" />}
              <span className={`flex-shrink-0 text-[10px] font-extrabold ${badge.className}`}>{badge.label}</span>
              <span className={`flex-1 min-w-0 truncate font-semibold ${tab.itemId ? '' : 'italic'}`}>{tab.name}</span>
              {tab.dirty && <span title="Alterações não salvas" className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 group-hover:hidden" />}
              <button
                type="button"
                title="Fechar aba"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose([tab]);
                }}
                className={`p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${tab.dirty ? 'hidden group-hover:block' : ''}`}
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
          setMenu({ x: bounds.left, y: bounds.bottom + 4, tab: null });
        }}
        className="px-3 flex items-center text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={menu.tab?.name}
          onClose={() => setMenu(null)}
          entries={menuEntries(menu.tab)}
        />
      )}
    </div>
  );
};

export default RequestTabBar;
