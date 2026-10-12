import React from 'react';
import { usePostgresStore } from '../../PostgresStore';
import { Activity, FileCode2, Table2, X } from 'lucide-react';
import type { WorkspaceTab } from '../../../../interfaces/PostgresInterfaces';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';

const tabIcons = {
  query: { icon: FileCode2, className: 'text-cyan-500' },
  table: { icon: Table2, className: 'text-blue-500' },
  dashboard: { icon: Activity, className: 'text-violet-500' },
};

const WorkspaceTabBar: React.FC = () => {
  const confirmToast = useConfirmToast();
  const { tabs, activeTabId, tabTxStatus, setActiveTab, closeTab } = usePostgresStore();

  const handleClose = (tab: WorkspaceTab) => {
    const status = tabTxStatus[tab.id];
    if (status === 'transaction' || status === 'failed') {
      confirmToast({
        id: `close-${tab.id}`,
        title: `Aba ${tab.title} fechada`,
        message: `"${tab.title}" tem uma transação aberta. Fechar a aba descarta (ROLLBACK) as alterações não confirmadas. Fechar mesmo assim?`,
        onConfirm: () => closeTab(tab.id),
      });
      return;
    }
    closeTab(tab.id);
  };

  if (!tabs.length) return null;

  return (
    <div className="flex items-stretch h-11 flex-shrink-0 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-950/40 overflow-x-auto overflow-y-hidden">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const { icon: Icon, className } = tabIcons[tab.type];
        const status = tabTxStatus[tab.id];
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onMouseDown={(event) => event.button === 1 && event.preventDefault()}
            onAuxClick={(event) => event.button === 1 && handleClose(tab)}
            title={`${tab.title} — ${tab.database} @ ${tab.connectionName}`}
            className={`group relative flex items-center gap-2 pl-3 pr-2 min-w-[150px] max-w-[240px] flex-shrink-0 text-xs cursor-pointer border-r border-gray-200 dark:border-white/5 transition-colors ${
              active
                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-zinc-500 hover:bg-white/60 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-zinc-200'
            }`}
          >
            {active && (
              <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
            )}
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${className}`} />
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="truncate font-semibold">{tab.title}</span>
              <span className="truncate text-[10px] text-gray-400 dark:text-zinc-500">
                {tab.type === 'dashboard'
                  ? tab.connectionName
                  : `${tab.database} @ ${tab.connectionName}`}
              </span>
            </div>
            {(status === 'transaction' || status === 'failed') && (
              <span
                title={status === 'failed' ? 'Transação com erro' : 'Transação aberta'}
                className={`h-2 w-2 rounded-full flex-shrink-0 ${status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`}
              />
            )}
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleClose(tab);
              }}
              title="Fechar aba"
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
