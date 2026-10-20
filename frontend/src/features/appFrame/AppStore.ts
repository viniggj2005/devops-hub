import { create } from 'zustand';
import { TALPADB_MODULE } from '../talpadb-module/moduleInfo';

export type ModuleType = 'home' | 'docker' | 'ferretshell' | 'vulpes' | 'octohub' | 'settings' | 'talpadb';

export interface AppTab {
  id: string;
  title: string;
  type: ModuleType;
}

interface AppState {
  tabs: AppTab[];
  activeTabId: string | null;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  openTab: (type: ModuleType, title?: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [{ id: 'home', type: 'home', title: 'Início' }],
  activeTabId: 'home',

  openTab: (type, title) => {
    const { tabs } = get();
    const existingTab = tabs.find(t => t.type === type);

    if (existingTab) {
      set({ activeTabId: existingTab.id });
      return;
    }

    const id = type === 'home' ? 'home' : `${type}-${Date.now()}`;
    let defaultTitle = title || type;
    if (type === 'talpadb') defaultTitle = TALPADB_MODULE.name;
    if (type === 'home') defaultTitle = 'Início';
    if (type === 'octohub') defaultTitle = 'OctoHub';
    if (type === 'docker') defaultTitle = 'Docker Manager';
    if (type === 'settings') defaultTitle = 'Configurações';
    if (type === 'ferretshell') defaultTitle = 'FerretShell';

    const newTab: AppTab = { id, type, title: defaultTitle };

    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
    });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (id === 'home') return;

    const newTabs = tabs.filter(tab => tab.id !== id);

    let newActiveId = activeTabId;
    if (activeTabId === id) {
      const closedIndex = tabs.findIndex(tab => tab.id === id);
      if (closedIndex > 0) {
        newActiveId = tabs[closedIndex - 1].id;
      } else {
        newActiveId = newTabs.length > 0 ? newTabs[0].id : null;
      }
    }

    if (newTabs.length === 0) {
      newTabs.push({ id: 'home', type: 'home', title: 'Início' });
      newActiveId = 'home';
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },
}));
