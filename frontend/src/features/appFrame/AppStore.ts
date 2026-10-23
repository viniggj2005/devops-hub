import { create } from 'zustand';
import toast from 'react-hot-toast';
import { Window } from '@wailsio/runtime';
import { getToken } from '../../contexts/AuthContext';
import { VULPES_MODULE } from '../vulpes-module/moduleInfo';
import { TALPADB_MODULE } from '../talpadb-module/moduleInfo';
import { errorMessage } from '../shared/functions/ErrorMessage';
import { detachedModule, isDetachableModule, isDetachedWindow } from './WindowContext';
import { ScreenPoint, detachModuleApi, dropModuleApi, moveModuleToMainWindowApi } from './services/WindowService';

export type ModuleType = 'home' | 'docker' | 'ferretshell' | 'vulpes' | 'octohub' | 'settings' | 'talpadb';

export interface AppTab {
  id: string;
  title: string;
  type: ModuleType;
}

type TabTransfer = (token: string, module: ModuleType) => Promise<boolean>;

interface AppState {
  tabs: AppTab[];
  activeTabId: string | null;
  closeTab: (id: string) => void;
  canDragTab: (id: string) => boolean;
  setActiveTab: (id: string) => void;
  openTab: (type: ModuleType, title?: string) => void;
  canOpenInNewWindow: (id: string) => boolean;
  canMoveToMainWindow: (id: string) => boolean;
  moveTabToMainWindow: (id: string) => Promise<void>;
  dropTab: (id: string, dropPoint: ScreenPoint) => Promise<void>;
  detachTab: (id: string, dropPoint?: ScreenPoint) => Promise<void>;
}

const moduleTitles: Partial<Record<ModuleType, string>> = {
  home: 'Início',
  octohub: 'OctoHub',
  docker: 'Docker Manager',
  settings: 'Configurações',
  ferretshell: 'FerretShell',
  vulpes: VULPES_MODULE.name,
  talpadb: TALPADB_MODULE.name,
};

const homeTab: AppTab = { id: 'home', type: 'home', title: 'Início' };

const createTab = (type: ModuleType, title?: string): AppTab => ({
  type,
  id: type === 'home' ? 'home' : `${type}-${Date.now()}`,
  title: moduleTitles[type] || title || type,
});

const initialTab = detachedModule ? createTab(detachedModule) : homeTab;

export const useAppStore = create<AppState>((set, get) => {
  const transferTab = async (id: string, allowed: boolean, transfer: TabTransfer) => {
    const tab = get().tabs.find(candidate => candidate.id === id);
    const token = getToken();
    if (!tab || !token || !allowed) return;

    try {
      if (await transfer(token, tab.type)) get().closeTab(id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return {
    tabs: [initialTab],
    activeTabId: initialTab.id,

    openTab: (type, title) => {
      const { tabs } = get();
      const existingTab = tabs.find(tab => tab.type === type);

      if (existingTab) {
        set({ activeTabId: existingTab.id });
        return;
      }

      const newTab = createTab(type, title);

      set({
        tabs: [...tabs, newTab],
        activeTabId: newTab.id,
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
        if (isDetachedWindow) {
          Window.Close();
          return;
        }
        newTabs.push(homeTab);
        newActiveId = 'home';
      }

      set({ tabs: newTabs, activeTabId: newActiveId });
    },

    setActiveTab: (id) => {
      set({ activeTabId: id });
    },

    canDragTab: (id) => {
      const tab = get().tabs.find(candidate => candidate.id === id);
      return Boolean(tab && isDetachableModule(tab.type));
    },

    canOpenInNewWindow: (id) => get().canDragTab(id) && (!isDetachedWindow || get().tabs.length > 1),

    canMoveToMainWindow: (id) => isDetachedWindow && get().canDragTab(id),

    detachTab: (id, dropPoint) => transferTab(id, get().canOpenInNewWindow(id), async (token, module) => {
      await detachModuleApi(token, module, dropPoint);
      return true;
    }),

    dropTab: (id, dropPoint) => transferTab(id, get().canDragTab(id), (token, module) =>
      dropModuleApi(token, module, dropPoint, get().canOpenInNewWindow(id)),
    ),

    moveTabToMainWindow: (id) => transferTab(id, get().canMoveToMainWindow(id), async (token, module) => {
      await moveModuleToMainWindowApi(token, module);
      return true;
    }),
  };
});
