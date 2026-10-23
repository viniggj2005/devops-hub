import toast from 'react-hot-toast';
import RequestView from './RequestView';
import RequestTabBar from './RequestTabBar';
import EmptyWorkspace from './EmptyWorkspace';
import SaveRequestModal from './SaveRequestModal';
import { useShallow } from 'zustand/react/shallow';
import { useVulpesStore } from '../../VulpesStore';
import { useAppStore } from '../../../appFrame/AppStore';
import { requestActions } from '../../actions/RequestActions';
import React, { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import type { RequestTab } from '../../../../interfaces/VulpesInterfaces';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';

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
  const [saveTargetId, setSaveTargetId] = useState<string | null>(null);
  const { tabs, activeTabId, removeTabs } = useVulpesStore(
    useShallow((state) => ({ tabs: state.tabs, activeTabId: state.activeTabId, removeTabs: state.removeTabs }))
  );
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const save = useCallback(async (tabId: string) => {
    try {
      const outcome = await requestActions.save(tabId);
      if (outcome === 'needs-location') setSaveTargetId(tabId);
      else toast.success('Requisição salva');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, []);

  const closeTabs = (closing: RequestTab[]) => {
    const discard = () => {
      closing.forEach((tab) => requestActions.releaseTab(tab.id));
      removeTabs(closing.map((tab) => tab.id));
    };
    const dirtyTabs = closing.filter((tab) => tab.dirty);
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
      if (!currentTab) return;
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

  return (
    <div className="h-full flex flex-col min-h-0">
      <RequestTabBar onClose={closeTabs} />
      <div className="flex-1 min-h-0">
        {activeTab ? <RequestView key={activeTab.id} tab={activeTab} onSave={() => save(activeTab.id)} /> : <EmptyWorkspace />}
      </div>
      <SaveRequestModal tabId={saveTargetId} onClose={() => setSaveTargetId(null)} />
    </div>
  );
};

export default RequestWorkspace;
