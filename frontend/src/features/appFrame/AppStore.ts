import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ModuleType = 'home' | 'docker' | 'ferretshell' | 'vulpes' | 'octohub';

export interface AppTab {
  id: string;
  type: ModuleType;
  title: string;
}

interface AppState {
  tabs: AppTab[];
  activeTabId: string | null;
  openTab: (type: ModuleType, title?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
        if (type === 'docker') defaultTitle = 'Docker Manager';
        if (type === 'ferretshell') defaultTitle = 'FerretShell';
        if (type === 'home') defaultTitle = 'Início';

        const newTab: AppTab = { id, type, title: defaultTitle };

        set({
          tabs: [...tabs, newTab],
          activeTabId: id,
        });
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get();
        if (id === 'home') return;

        const newTabs = tabs.filter(t => t.id !== id);

        let newActiveId = activeTabId;
        if (activeTabId === id) {
          const closedIndex = tabs.findIndex(t => t.id === id);
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
    }),
    {
      name: 'app-frame-storage',
      partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId }),
    }
  )
);
