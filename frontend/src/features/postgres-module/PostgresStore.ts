import { create } from 'zustand';
import { PostgresServices } from './services/PostgresServices';
import { connectionLabel, generateId } from './functions/TreatmentFunctions';
import type {
  PostgresStoreState,
  TxStatus,
  WorkspaceTab,
} from '../../interfaces/PostgresInterfaces';

const initialState = {
  view: 'home' as const,
  connections: [],
  connectionsLoaded: false,
  tabs: [] as WorkspaceTab[],
  activeTabId: null,
  queryCounter: 0,
  tabTxStatus: {} as Record<string, TxStatus>,
};

export const usePostgresStore = create<PostgresStoreState>((set, get) => ({
  ...initialState,

  setView: (view) => set({ view }),

  loadConnections: async (token) => {
    const connections = await PostgresServices.findAllConnections(token);
    set({ connections, connectionsLoaded: true });
    return connections;
  },

  openTab: (input) => {
    const existing = input.key ? get().tabs.find((tab) => tab.key === input.key) : undefined;
    if (existing) {
      set({ activeTabId: existing.id, view: 'workspace' });
      return;
    }
    const tab: WorkspaceTab = { ...input, id: generateId() };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id, view: 'workspace' }));
  },

  openQueryTab: ({ connectionId, database, sql, autoRun, title }) => {
    const connection = get().connections.find((item) => item.id === connectionId);
    const counter = get().queryCounter + 1;
    set({ queryCounter: counter });
    get().openTab({
      type: 'query',
      title: title ?? `Query ${counter}`,
      connectionId,
      connectionName: connectionLabel(connection),
      database: database || connection?.database || 'postgres',
      initialSql: sql,
      autoRun,
    });
  },

  closeTab: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      let activeTabId = state.activeTabId;
      if (state.activeTabId === id) {
        activeTabId = tabs.length ? tabs[Math.max(0, index - 1)].id : null;
      }
      const { [id]: _removed, ...tabTxStatus } = state.tabTxStatus;
      return { tabs, activeTabId, tabTxStatus };
    });
  },

  closeConnectionTabs: (connectionId) => {
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.connectionId !== connectionId);
      const activeTabId = tabs.some((tab) => tab.id === state.activeTabId)
        ? state.activeTabId
        : (tabs[tabs.length - 1]?.id ?? null);
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  renameTab: (id, title) =>
    set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab)) })),

  setTabTxStatus: (id, status) =>
    set((state) => ({ tabTxStatus: { ...state.tabTxStatus, [id]: status } })),

  reset: () => set({ ...initialState }),
}));
