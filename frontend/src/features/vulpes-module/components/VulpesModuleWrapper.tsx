import toast from 'react-hot-toast';
import VulpesNavbar from './VulpesNavbar';
import { Events } from '@wailsio/runtime';
import { PanelLeftOpen } from 'lucide-react';
import { useVulpesStore } from '../VulpesStore';
import { useAppStore } from '../../appFrame/AppStore';
import { requestActions } from '../actions/RequestActions';
import EnvironmentsModal from './modals/EnvironmentsModal';
import RequestWorkspace from './workspace/RequestWorkspace';
import CollectionsSidebar from './sidebar/CollectionsSidebar';
import { windowInstanceId } from '../../appFrame/WindowContext';
import React, { useCallback, useEffect, useState } from 'react';
import { collectionActions } from '../actions/CollectionActions';
import { startDrag } from '../../shared/functions/DragFunctions';
import { getToken, useAuth } from '../../../contexts/AuthContext';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { VulpesServices, vulpesDataChangedEvent } from '../services/VulpesServices';

const sidebarStorageKey = 'vulpes-sidebar-layout';

interface SidebarLayout {
  width: number;
  collapsed: boolean;
}

const clampWidth = (width: number) => Math.min(560, Math.max(220, width));

const readSidebarLayout = (): SidebarLayout => {
  try {
    const saved = JSON.parse(localStorage.getItem(sidebarStorageKey) ?? '{}');
    return {
      collapsed: saved.collapsed === true,
      width: typeof saved.width === 'number' ? clampWidth(saved.width) : 300,
    };
  } catch {
    return { width: 300, collapsed: false };
  }
};

const VulpesModuleWrapper: React.FC = () => {
  const { token } = useAuth();
  const [sidebar, setSidebar] = useState<SidebarLayout>(readSidebarLayout);
  const [environmentsOpen, setEnvironmentsOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    collectionActions.reload().catch((error) => toast.error(`Erro ao carregar coleções: ${errorMessage(error)}`));
  }, [token]);

  useEffect(
    () =>
      Events.On(vulpesDataChangedEvent, ({ data: originWindowId }) => {
        if (originWindowId !== windowInstanceId) collectionActions.reload().catch(() => undefined);
      }),
    []
  );

  useEffect(
    () => () => {
      const currentToken = getToken();
      if (currentToken) requestActions.releaseAll(currentToken).catch(() => undefined);
      else VulpesServices.stopAllRealtime();
      useVulpesStore.getState().reset();
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(sidebarStorageKey, JSON.stringify(sidebar));
    } catch {
      return;
    }
  }, [sidebar]);

  const toggleSidebar = useCallback(() => setSidebar((current) => ({ ...current, collapsed: !current.collapsed })), []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const { tabs, activeTabId } = useAppStore.getState();
      const vulpesVisible = tabs.find((tab) => tab.id === activeTabId)?.type === 'vulpes';
      if (!vulpesVisible || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'b') return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleSidebar]);

  const startResize = (event: React.MouseEvent) => {
    const startWidth = sidebar.width;
    startDrag(event, 'col-resize', (deltaX) => setSidebar((current) => ({ ...current, width: clampWidth(startWidth + deltaX) })));
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200">
      <VulpesNavbar onManageEnvironments={() => setEnvironmentsOpen(true)} />
      <main className="flex-1 min-h-0 flex p-3">
        {sidebar.collapsed ? (
          <aside className="w-11 flex-shrink-0 flex flex-col items-center py-2 mr-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg">
            <button
              type="button"
              onClick={toggleSidebar}
              title="Mostrar coleções (Ctrl+B)"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </aside>
        ) : (
          <>
            <aside
              style={{ width: sidebar.width }}
              className="flex-shrink-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg overflow-hidden"
            >
              <CollectionsSidebar onCollapse={toggleSidebar} />
            </aside>
            <div
              onMouseDown={startResize}
              onDoubleClick={toggleSidebar}
              title="Arraste para redimensionar · duplo clique recolhe"
              className="w-3 flex-shrink-0 cursor-col-resize group flex items-center justify-center"
            >
              <div className="h-10 w-1 rounded-full bg-gray-300/70 dark:bg-white/10 group-hover:bg-amber-500/60 transition-colors" />
            </div>
          </>
        )}
        <section className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg overflow-hidden">
          <RequestWorkspace />
        </section>
      </main>
      <EnvironmentsModal isOpen={environmentsOpen} onClose={() => setEnvironmentsOpen(false)} />
    </div>
  );
};

export default VulpesModuleWrapper;
