import { create } from 'zustand';
import { maxSplitPanes, splitDropZoneLayouts } from '../../shared/constants/SplitDropZones';
import { TerminalTab, TerminalInstance, TerminalStateProps } from '../../../interfaces/TerminalInterfaces';

export const maxInstancesPerTab = maxSplitPanes;

const generateId = () => Math.random().toString(36).substring(2, 9);

const buildInstance = (instanceData: Omit<TerminalInstance, 'id'>): TerminalInstance => {
  const instanceId = generateId();
  return {
    ...instanceData,
    id: instanceId,
    config: instanceData.config ? { ...instanceData.config, SshSessionId: instanceId } : undefined,
  };
};

const withoutId = ({ id: _instanceId, ...instanceData }: TerminalInstance): Omit<TerminalInstance, 'id'> => instanceData;

const pickActiveTabId = (tabs: TerminalTab[], currentActiveId: string | null) => {
  if (tabs.some(tab => tab.id === currentActiveId)) return currentActiveId;
  return tabs.length > 0 ? tabs[tabs.length - 1].id : null;
};

export const useTerminalStore = create<TerminalStateProps>((set) => ({
  tabs: [],
  open: false,
  viewMode: 'page',
  activeTabId: null,
  draggingTabId: null,
  broadcastActive: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  setDraggingTabId: (tabId) => set({ draggingTabId: tabId }),
  setBroadcastActive: (value) => set({ broadcastActive: value }),

  createTab: (instanceData) => {
    const newTab: TerminalTab = {
      id: generateId(),
      title: instanceData.title,
      instances: [buildInstance(instanceData)],
    };
    set((state) => ({
      open: true,
      viewMode: 'terminal',
      activeTabId: newTab.id,
      tabs: [...state.tabs, newTab],
    }));
  },

  closeTab: (tabId) => {
    set((state) => {
      const remainingTabs = state.tabs.filter((tab) => tab.id !== tabId);
      return {
        tabs: remainingTabs,
        open: remainingTabs.length > 0,
        activeTabId: pickActiveTabId(remainingTabs, state.activeTabId),
      };
    });
  },

  mergeTabInto: (sourceTabId, targetTabId, dropZone) => {
    set((state) => {
      const sourceTab = state.tabs.find((tab) => tab.id === sourceTabId);
      const targetTab = state.tabs.find((tab) => tab.id === targetTabId);
      if (!sourceTab || !targetTab || sourceTabId === targetTabId) return {};
      if (sourceTab.instances.length + targetTab.instances.length > maxInstancesPerTab) return {};

      const { layout, insertAtStart } = splitDropZoneLayouts[dropZone];
      const movedInstances = sourceTab.instances.map((instance) => buildInstance(withoutId(instance)));
      const mergedInstances = insertAtStart
        ? [...movedInstances, ...targetTab.instances]
        : [...targetTab.instances, ...movedInstances];

      const tabs = state.tabs
        .filter((tab) => tab.id !== sourceTabId)
        .map((tab) => (tab.id === targetTabId ? { ...tab, instances: mergedInstances, preferredLayout: layout } : tab));

      return { tabs, activeTabId: targetTabId, draggingTabId: null };
    });
  },

  detachInstance: (tabId, instanceId) => {
    set((state) => {
      const originTab = state.tabs.find((tab) => tab.id === tabId);
      const detachedInstance = originTab?.instances.find((instance) => instance.id === instanceId);
      if (!originTab || !detachedInstance || originTab.instances.length < 2) return {};

      const newTab: TerminalTab = {
        id: generateId(),
        title: detachedInstance.title,
        instances: [buildInstance(withoutId(detachedInstance))],
      };
      const tabs = state.tabs.flatMap((tab) => {
        if (tab.id !== tabId) return [tab];
        return [{ ...tab, instances: tab.instances.filter((instance) => instance.id !== instanceId) }, newTab];
      });
      return { tabs };
    });
  },

  removeInstance: (tabId, instanceId) => {
    set((state) => {
      const tabs = state.tabs
        .map((tab) => (tab.id === tabId ? { ...tab, instances: tab.instances.filter((instance) => instance.id !== instanceId) } : tab))
        .filter((tab) => tab.instances.length > 0);
      return { tabs, open: tabs.length > 0, activeTabId: pickActiveTabId(tabs, state.activeTabId) };
    });
  },

  close: () => set({ tabs: [], activeTabId: null, open: false, draggingTabId: null }),
}));
