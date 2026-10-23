import { create } from 'zustand';
import { cloneRequest, createRequest, generateId } from './functions/RequestDefaults';
import type { Collection, RequestTab, TabRuntime, Environment, RealtimeEvent, VulpesRequest, CollectionItem, VulpesProtocol } from '../../interfaces/VulpesInterfaces';

const maxRealtimeEvents = 1000;

const activeEnvironmentStorageKey = 'vulpes-active-environment';

const readActiveEnvironment = (): number | null => {
  try {
    const stored = Number(localStorage.getItem(activeEnvironmentStorageKey));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
};

const persistActiveEnvironment = (environmentId: number | null) => {
  try {
    if (environmentId) localStorage.setItem(activeEnvironmentStorageKey, String(environmentId));
    else localStorage.removeItem(activeEnvironmentStorageKey);
  } catch {
    return;
  }
};

const byName = <Entry extends { id: number; name: string }>(left: Entry, right: Entry) =>
  left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }) || left.id - right.id;

const upsertSorted = <Entry extends { id: number; name: string }>(entries: Entry[], entry: Entry) =>
  [...entries.filter((candidate) => candidate.id !== entry.id), entry].sort(byName);

export const emptyRuntime = (): TabRuntime => ({
  events: [],
  error: null,
  running: false,
  connection: 'idle',
  httpResponse: null,
  grpcResponse: null,
  grpcServices: null,
});

interface SavedLocation {
  name: string;
  itemId: string;
  collectionId: number;
}

interface VulpesState {
  loaded: boolean;
  tabs: RequestTab[];
  activeTabId: string | null;
  collections: Collection[];
  environments: Environment[];
  eventSequence: number;
  activeEnvironmentId: number | null;
  runtimes: Record<string, TabRuntime>;
  reset: () => void;
  activateTab: (tabId: string) => void;
  removeTabs: (tabIds: string[]) => void;
  removeCollection: (collectionId: number) => void;
  upsertCollection: (collection: Collection) => void;
  removeEnvironment: (environmentId: number) => void;
  clearRealtimeEvents: (tabId: string) => void;
  openScratch: (protocol: VulpesProtocol) => void;
  upsertEnvironment: (environment: Environment) => void;
  renameTab: (tabId: string, name: string) => void;
  moveTabsToCollection: (itemIds: string[], collectionId: number) => void;
  renameTabs: (itemId: string, name: string) => void;
  markSaved: (tabId: string, location: SavedLocation, savedRequest: VulpesRequest) => void;
  setActiveEnvironment: (environmentId: number | null) => void;
  openItem: (collectionId: number, item: CollectionItem) => void;
  pushRealtimeEvent: (tabId: string, event: RealtimeEvent) => void;
  patchRuntime: (tabId: string, patch: Partial<TabRuntime>) => void;
  setData: (collections: Collection[], environments: Environment[]) => void;
  updateRequest: (tabId: string, update: (request: VulpesRequest) => VulpesRequest) => void;
}

const initialState = () => ({
  tabs: [],
  runtimes: {},
  loaded: false,
  collections: [],
  environments: [],
  activeTabId: null,
  eventSequence: 0,
  activeEnvironmentId: readActiveEnvironment(),
});

export const useVulpesStore = create<VulpesState>((set, get) => ({
  ...initialState(),

  setData: (collections, environments) => {
    const { activeEnvironmentId } = get();
    const environmentExists = environments.some((environment) => environment.id === activeEnvironmentId);
    if (activeEnvironmentId && !environmentExists) persistActiveEnvironment(null);
    set({
      loaded: true,
      collections: [...collections].sort(byName),
      environments: [...environments].sort(byName),
      activeEnvironmentId: environmentExists ? activeEnvironmentId : null,
    });
  },

  setActiveEnvironment: (environmentId) => {
    persistActiveEnvironment(environmentId);
    set({ activeEnvironmentId: environmentId });
  },

  upsertCollection: (collection) => set((state) => ({ collections: upsertSorted(state.collections, collection) })),

  removeCollection: (collectionId) =>
    set((state) => ({ collections: state.collections.filter((collection) => collection.id !== collectionId) })),

  upsertEnvironment: (environment) => set((state) => ({ environments: upsertSorted(state.environments, environment) })),

  removeEnvironment: (environmentId) => {
    if (get().activeEnvironmentId === environmentId) persistActiveEnvironment(null);
    set((state) => ({
      environments: state.environments.filter((environment) => environment.id !== environmentId),
      activeEnvironmentId: state.activeEnvironmentId === environmentId ? null : state.activeEnvironmentId,
    }));
  },

  openItem: (collectionId, item) => {
    if (item.kind !== 'request' || !item.request) return;
    const existing = get().tabs.find((tab) => tab.itemId === item.id);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const tab: RequestTab = {
      id: generateId(),
      name: item.name,
      dirty: false,
      itemId: item.id,
      request: cloneRequest(item.request),
      collectionId,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      runtimes: { ...state.runtimes, [tab.id]: emptyRuntime() },
    }));
  },

  openScratch: (protocol) => {
    const tab: RequestTab = {
      id: generateId(),
      name: 'Nova requisição',
      dirty: false,
      itemId: null,
      request: createRequest(protocol),
      collectionId: null,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      runtimes: { ...state.runtimes, [tab.id]: emptyRuntime() },
    }));
  },

  activateTab: (tabId) => set({ activeTabId: tabId }),

  removeTabs: (tabIds) =>
    set((state) => {
      const removed = new Set(tabIds);
      const tabs = state.tabs.filter((tab) => !removed.has(tab.id));
      let activeTabId = state.activeTabId;
      if (activeTabId && removed.has(activeTabId)) {
        const previousIndex = state.tabs.findIndex((tab) => tab.id === activeTabId);
        activeTabId = tabs[Math.min(previousIndex, tabs.length - 1)]?.id ?? null;
      }
      const runtimes = Object.fromEntries(Object.entries(state.runtimes).filter(([tabId]) => !removed.has(tabId)));
      return { tabs, runtimes, activeTabId };
    }),

  updateRequest: (tabId, update) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, dirty: true, request: update(tab.request) } : tab)),
    })),

  renameTabs: (itemId, name) =>
    set((state) => ({ tabs: state.tabs.map((tab) => (tab.itemId === itemId ? { ...tab, name } : tab)) })),

  moveTabsToCollection: (itemIds, collectionId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.itemId && itemIds.includes(tab.itemId) ? { ...tab, collectionId } : tab)),
    })),

  renameTab: (tabId, name) =>
    set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, name, dirty: true } : tab)) })),

  markSaved: (tabId, location, savedRequest) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const changedMeanwhile = tab.request !== savedRequest || tab.name !== location.name;
        return { ...tab, itemId: location.itemId, collectionId: location.collectionId, dirty: changedMeanwhile };
      }),
    })),

  patchRuntime: (tabId, patch) =>
    set((state) => ({
      runtimes: { ...state.runtimes, [tabId]: { ...(state.runtimes[tabId] ?? emptyRuntime()), ...patch } },
    })),

  pushRealtimeEvent: (tabId, event) =>
    set((state) => {
      const runtime = state.runtimes[tabId];
      if (!runtime) return {};
      const sequence = state.eventSequence + 1;
      const events = [...runtime.events, { ...event, sequence }].slice(-maxRealtimeEvents);
      let connection = runtime.connection;
      if (event.kind === 'connecting') connection = 'connecting';
      if (event.kind === 'connected') connection = 'connected';
      if (event.kind === 'closed') connection = 'closed';
      return { eventSequence: sequence, runtimes: { ...state.runtimes, [tabId]: { ...runtime, events, connection } } };
    }),

  clearRealtimeEvents: (tabId) => get().patchRuntime(tabId, { events: [] }),

  reset: () => set(initialState()),
}));
