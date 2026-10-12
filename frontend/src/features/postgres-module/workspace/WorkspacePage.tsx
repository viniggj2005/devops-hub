import React, { useState } from 'react';
import QueryTab from './query/QueryTab';
import { usePostgresStore } from '../PostgresStore';
import ObjectExplorer from './explorer/ObjectExplorer';
import EmptyWorkspace from './components/EmptyWorkspace';
import WorkspaceTabBar from './components/WorkspaceTabBar';
import { startDrag } from '../functions/DragFunctions';
import TablePropertiesTab from './table/TablePropertiesTab';
import ServerDashboardTab from './dashboard/ServerDashboardTab';
import type { WorkspaceTab } from '../../../interfaces/PostgresInterfaces';

const renderTab = (tab: WorkspaceTab, active: boolean) => {
  switch (tab.type) {
    case 'query':
      return <QueryTab tab={tab} active={active} />;
    case 'table':
      return <TablePropertiesTab tab={tab} />;
    case 'dashboard':
      return <ServerDashboardTab tab={tab} active={active} />;
  }
};

const WorkspacePage: React.FC = () => {
  const { tabs, activeTabId } = usePostgresStore();
  const [explorerWidth, setExplorerWidth] = useState(300);

  const startResize = (event: React.MouseEvent) => {
    const startWidth = explorerWidth;
    startDrag(event, 'col-resize', (deltaX) =>
      setExplorerWidth(Math.min(600, Math.max(220, startWidth + deltaX)))
    );
  };

  return (
    <div className="h-full flex p-3">
      <aside
        style={{ width: explorerWidth }}
        className="flex-shrink-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg overflow-hidden"
      >
        <ObjectExplorer />
      </aside>

      <div
        onMouseDown={startResize}
        title="Arraste para redimensionar"
        className="w-3 flex-shrink-0 cursor-col-resize group flex items-center justify-center"
      >
        <div className="h-10 w-1 rounded-full bg-gray-300/70 dark:bg-white/10 group-hover:bg-cyan-500/60 transition-colors" />
      </div>

      <section className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg overflow-hidden">
        <WorkspaceTabBar />
        <div className="flex-1 min-h-0 relative">
          {tabs.length === 0 && <EmptyWorkspace />}
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;
            return (
              // Sem "visible" explícito na aba ativa: ela precisa herdar o "invisible" do workspace quando a Home está aberta.
              <div key={tab.id} className={`absolute inset-0 ${active ? '' : 'invisible'}`}>
                {renderTab(tab, active)}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default WorkspacePage;
