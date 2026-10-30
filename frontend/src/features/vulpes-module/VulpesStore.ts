import { create } from 'zustand';
import type { SplitDropZone } from '../../interfaces/SplitInterfaces';
import { cloneRequest, createRequest, generateId } from './functions/RequestDefaults';
import { maxSplitPanes, splitDropZoneLayouts } from '../shared/constants/SplitDropZones';
import type {
  Cookie,
  TabGroup,
  Collection,
  CookiesTab,
  RequestTab,
  TabRuntime,
  Environment,
  HttpResponse,
  WorkspaceTab,
  RealtimeEvent,
  VulpesRequest,
  CollectionItem,
  VulpesProtocol,
} from '../../interfaces/VulpesInterfaces';

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

export const isRequestTab = (tab: WorkspaceTab | undefined | null): tab is RequestTab => tab?.kind === 'request';

export const emptyRuntime = (): TabRuntime => ({
  events: [],
  error: null,
  running: false,
  connection: 'idle',
  httpResponse: null,
  grpcResponse: null,
  grpcServices: null,
});

const singlePaneGroup = (paneId: string): TabGroup => ({
  id: generateId(),
  layout: 'vertical',
  paneIds: [paneId],
  focusedPaneId: paneId,
});

const groupOfPane = (groups: TabGroup[], paneId: string) => groups.find((group) => group.paneIds.includes(paneId));

interface SavedLocation {
  name: string;
  itemId: string;
  collectionId: number;
}

interface WorkspaceSlice {
  tabs: WorkspaceTab[];
  groups: TabGroup[];
  activeTabId: string | null;
  activeGroupId: string | null;
  runtimes: Record<string, TabRuntime>;
}

const withAppendedTab = (state: WorkspaceSlice, tab: WorkspaceTab): Partial<WorkspaceSlice> => {
  const group = singlePaneGroup(tab.id);
  return {
    activeTabId: tab.id,
    activeGroupId: group.id,
    tabs: [...state.tabs, tab],
    groups: [...state.groups, group],
    runtimes: tab.kind === 'request' ? { ...state.runtimes, [tab.id]: emptyRuntime() } : state.runtimes,
  };
};

const withoutPanes = (state: WorkspaceSlice, removedIds: Set<string>): WorkspaceSlice => {
  const activeGroupIndex = state.groups.findIndex((group) => group.id === state.activeGroupId);
  const groups = state.groups
    .map((group) => {
      const paneIds = group.paneIds.filter((paneId) => !removedIds.has(paneId));
      const focusedPaneId = paneIds.includes(group.focusedPaneId) ? group.focusedPaneId : paneIds[0];
      return { ...group, paneIds, focusedPaneId };
    })
    .filter((group) => group.paneIds.length > 0);

  const activeGroup =
    groups.find((group) => group.id === state.activeGroupId) ?? groups[Math.min(Math.max(0, activeGroupIndex), groups.length - 1)];

  return {
    groups,
    activeGroupId: activeGroup?.id ?? null,
    activeTabId: activeGroup?.focusedPaneId ?? null,
    tabs: state.tabs.filter((tab) => !removedIds.has(tab.id)),
    runtimes: Object.fromEntries(Object.entries(state.runtimes).filter(([tabId]) => !removedIds.has(tabId))),
  };
};

const mapRequestTabs = (tabs: WorkspaceTab[], update: (tab: RequestTab) => RequestTab) =>
  tabs.map((tab) => (isRequestTab(tab) ? update(tab) : tab));

interface VulpesState extends WorkspaceSlice {
  loaded: boolean;
  collections: Collection[];
  eventSequence: number;
  environments: Environment[];
  draggingGroupId: string | null;
  activeEnvironmentId: number | null;
  itemResponses: Record<string, HttpResponse>;
  reset: () => void;
  activateTab: (tabId: string) => void;
  removeTabs: (tabIds: string[]) => void;
  detachPane: (tabId: string) => void;
  ungroup: (groupId: string) => void;
  activateGroup: (groupId: string) => void;
  openCookies: (collectionId: number | null) => void;
  removeCollection: (collectionId: number) => void;
  upsertCollection: (collection: Collection) => void;
  removeEnvironment: (environmentId: number) => void;
  clearRealtimeEvents: (tabId: string) => void;
  openScratch: (protocol: VulpesProtocol) => void;
  setDraggingGroup: (groupId: string | null) => void;
  upsertEnvironment: (environment: Environment) => void;
  renameTab: (tabId: string, name: string) => void;
  moveGroup: (groupId: string, targetIndex: number) => void;
  setCookiesCollection: (tabId: string, collectionId: number | null) => void;
  renameTabs: (itemId: string, name: string) => void;
  applyCollectionCookies: (collectionId: number, cookies: Cookie[]) => void;
  moveTabsToCollection: (itemIds: string[], collectionId: number) => void;
  markSaved: (tabId: string, location: SavedLocation, savedRequest: VulpesRequest) => void;
  setActiveEnvironment: (environmentId: number | null) => void;
  openItem: (collectionId: number, item: CollectionItem) => void;
  pushRealtimeEvent: (tabId: string, event: RealtimeEvent) => void;
  patchRuntime: (tabId: string, patch: Partial<TabRuntime>) => void;
  setData: (collections: Collection[], environments: Environment[]) => void;
  setItemResponse: (collectionId: number, itemId: string, response: HttpResponse) => void;
  mergeGroupInto: (sourceGroupId: string, targetGroupId: string, dropZone: SplitDropZone) => void;
  updateRequest: (tabId: string, update: (request: VulpesRequest) => VulpesRequest) => void;
}

const initialState = () => ({
  tabs: [],
  groups: [],
  runtimes: {},
  loaded: false,
  collections: [],
  environments: [],
  activeTabId: null,
  eventSequence: 0,
  activeGroupId: null,
  itemResponses: {},
  draggingGroupId: null,
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

  applyCollectionCookies: (collectionId, cookies) =>
    set((state) => ({
      collections: state.collections.map((collection) => (collection.id === collectionId ? { ...collection, cookies } : collection)),
    })),

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
    const existing = get().tabs.find((tab) => isRequestTab(tab) && tab.itemId === item.id);
    if (existing) {
      get().activateTab(existing.id);
      return;
    }
    const tab: RequestTab = {
      id: generateId(),
      kind: 'request',
      name: item.name,
      dirty: false,
      itemId: item.id,
      request: cloneRequest(item.request),
      collectionId,
    };
    set((state) => withAppendedTab(state, tab));
  },

  openScratch: (protocol) => {
    const tab: RequestTab = {
      id: generateId(),
      kind: 'request',
      name: 'Nova requisição',
      dirty: false,
      itemId: null,
      request: createRequest(protocol),
      collectionId: null,
    };
    set((state) => withAppendedTab(state, tab));
  },

  openCookies: (collectionId) => {
    const existing = get().tabs.find((tab) => tab.kind === 'cookies' && tab.collectionId === collectionId);
    if (existing) {
      get().activateTab(existing.id);
      return;
    }
    const tab: CookiesTab = { id: generateId(), kind: 'cookies', collectionId };
    set((state) => withAppendedTab(state, tab));
  },

  setCookiesCollection: (tabId, collectionId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId && tab.kind === 'cookies' ? { ...tab, collectionId } : tab)),
    })),

  activateTab: (tabId) =>
    set((state) => {
      const group = groupOfPane(state.groups, tabId);
      if (!group) return {};
      return {
        activeTabId: tabId,
        activeGroupId: group.id,
        groups: state.groups.map((candidate) => (candidate.id === group.id ? { ...candidate, focusedPaneId: tabId } : candidate)),
      };
    }),

  activateGroup: (groupId) =>
    set((state) => {
      const group = state.groups.find((candidate) => candidate.id === groupId);
      return group ? { activeGroupId: group.id, activeTabId: group.focusedPaneId } : {};
    }),

  removeTabs: (tabIds) => set((state) => withoutPanes(state, new Set(tabIds))),

  setDraggingGroup: (groupId) => set({ draggingGroupId: groupId }),

  moveGroup: (groupId, targetIndex) =>
    set((state) => {
      const sourceIndex = state.groups.findIndex((group) => group.id === groupId);
      if (sourceIndex < 0) return {};
      const insertIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      if (insertIndex === sourceIndex) return {};
      const groups = [...state.groups];
      const [moved] = groups.splice(sourceIndex, 1);
      groups.splice(Math.min(Math.max(0, insertIndex), groups.length), 0, moved);
      return { groups };
    }),

  mergeGroupInto: (sourceGroupId, targetGroupId, dropZone) =>
    set((state) => {
      const sourceGroup = state.groups.find((group) => group.id === sourceGroupId);
      const targetGroup = state.groups.find((group) => group.id === targetGroupId);
      if (!sourceGroup || !targetGroup || sourceGroupId === targetGroupId) return { draggingGroupId: null };
      if (sourceGroup.paneIds.length + targetGroup.paneIds.length > maxSplitPanes) return { draggingGroupId: null };

      const { layout, insertAtStart } = splitDropZoneLayouts[dropZone];
      const paneIds = insertAtStart ? [...sourceGroup.paneIds, ...targetGroup.paneIds] : [...targetGroup.paneIds, ...sourceGroup.paneIds];
      const mergedGroup = { ...targetGroup, layout, paneIds, focusedPaneId: sourceGroup.focusedPaneId };

      return {
        draggingGroupId: null,
        activeGroupId: targetGroupId,
        activeTabId: mergedGroup.focusedPaneId,
        groups: state.groups.filter((group) => group.id !== sourceGroupId).map((group) => (group.id === targetGroupId ? mergedGroup : group)),
      };
    }),

  detachPane: (tabId) =>
    set((state) => {
      const originGroup = groupOfPane(state.groups, tabId);
      if (!originGroup || originGroup.paneIds.length < 2) return {};
      const detachedGroup = singlePaneGroup(tabId);
      const remainingIds = originGroup.paneIds.filter((paneId) => paneId !== tabId);
      const groups = state.groups.flatMap((group) => {
        if (group.id !== originGroup.id) return [group];
        const focusedPaneId = remainingIds.includes(group.focusedPaneId) ? group.focusedPaneId : remainingIds[0];
        return [{ ...group, paneIds: remainingIds, focusedPaneId }, detachedGroup];
      });
      return { groups, activeGroupId: detachedGroup.id, activeTabId: tabId };
    }),

  ungroup: (groupId) =>
    set((state) => {
      const group = state.groups.find((candidate) => candidate.id === groupId);
      if (!group || group.paneIds.length < 2) return {};
      const separated = group.paneIds.map(singlePaneGroup);
      const focusedGroup = separated.find((candidate) => candidate.focusedPaneId === group.focusedPaneId) ?? separated[0];
      return {
        activeTabId: focusedGroup.focusedPaneId,
        activeGroupId: focusedGroup.id,
        groups: state.groups.flatMap((candidate) => (candidate.id === groupId ? separated : [candidate])),
      };
    }),

  updateRequest: (tabId, update) =>
    set((state) => ({
      tabs: mapRequestTabs(state.tabs, (tab) => (tab.id === tabId ? { ...tab, dirty: true, request: update(tab.request) } : tab)),
    })),

  renameTabs: (itemId, name) =>
    set((state) => ({ tabs: mapRequestTabs(state.tabs, (tab) => (tab.itemId === itemId ? { ...tab, name } : tab)) })),

  moveTabsToCollection: (itemIds, collectionId) =>
    set((state) => ({
      tabs: mapRequestTabs(state.tabs, (tab) => (tab.itemId && itemIds.includes(tab.itemId) ? { ...tab, collectionId } : tab)),
    })),

  renameTab: (tabId, name) =>
    set((state) => ({ tabs: mapRequestTabs(state.tabs, (tab) => (tab.id === tabId ? { ...tab, name, dirty: true } : tab)) })),

  markSaved: (tabId, location, savedRequest) =>
    set((state) => ({
      tabs: mapRequestTabs(state.tabs, (tab) => {
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

  setItemResponse: (collectionId, itemId, response) =>
    set((state) => ({ itemResponses: { ...state.itemResponses, [`${collectionId}:${itemId}`]: response } })),

  reset: () => set(initialState()),
}));
