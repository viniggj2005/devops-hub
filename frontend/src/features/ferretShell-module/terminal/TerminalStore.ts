import { create } from 'zustand';
import { TerminalStateProps, TerminalTab, TerminalInstance } from '../../../interfaces/TerminalInterfaces';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useTerminalStore = create<TerminalStateProps>((set) => ({
  tabs: [],
  activeTabId: null,
  viewMode: 'page',
  open: false,
  broadcastActive: false,

  setBroadcastActive: (value) => set({ broadcastActive: value }),
  setViewMode: (mode) => set({ viewMode: mode }),

  createTab: (instanceData) => {
    const instanceId = generateId();
    const tabId = generateId();

    const newInstance: TerminalInstance = { ...instanceData, id: instanceId };
    if (newInstance.config) {
      newInstance.config.SshSessionId = instanceId;
    }

    const newTab: TerminalTab = {
      id: tabId,
      title: instanceData.title,
      instances: [newInstance],
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
      viewMode: 'terminal',
      open: true,
    }));
  },

  closeTab: (tabId) => {
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
        open: newTabs.length > 0,
      };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  addInstanceToTab: (tabId, instanceData, index, layout) => {
    set((state) => {
      const instanceId = generateId();
      const newInstance: TerminalInstance = { ...instanceData, id: instanceId };
      if (newInstance.config) {
        newInstance.config.SshSessionId = instanceId;
      }

      const newTabs = state.tabs.map((tab) => {
        if (tab.id === tabId && tab.instances.length < 4) {
          const newInstances = [...tab.instances];
          if (typeof index === 'number') {
            newInstances.splice(index, 0, newInstance);
          } else {
            newInstances.push(newInstance);
          }
          return { 
            ...tab, 
            instances: newInstances,
            preferredLayout: layout || tab.preferredLayout
          };
        }
        return tab;
      });
      return { tabs: newTabs };
    });
  },
  
  setLayout: (tabId, layout) => {
    set((state) => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, preferredLayout: layout } : t)
    }));
  },

  removeInstance: (tabId, instanceId) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) => {
        if (tab.id === tabId) {
          const newInstances = tab.instances.filter((i) => i.id !== instanceId);
          return { ...tab, instances: newInstances };
        }
        return tab;
      }).filter(tab => tab.instances.length > 0);

      let newActiveId = state.activeTabId;
      if (!newTabs.find(t => t.id === state.activeTabId)) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }

      return { tabs: newTabs, activeTabId: newActiveId, open: newTabs.length > 0 };
    });
  },

  close: () => set({ tabs: [], activeTabId: null, open: false }),
}));
