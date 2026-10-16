import { create } from 'zustand';
import { PostgresServices } from './services/PostgresServices';
import { connectionLabel, generateId } from './functions/TreatmentFunctions';
import { maxSplitPanes, splitDropZoneLayouts } from '../shared/constants/SplitDropZones';
import type {
  TxStatus,
  WorkspaceTab,
  WorkspaceGroup,
  PostgresStoreState,
} from '../../interfaces/PostgresInterfaces';

const initialState = {
  view: 'home' as const,
  connections: [],
  connectionsLoaded: false,
  tabs: [] as WorkspaceTab[],
  groups: [] as WorkspaceGroup[],
  activeTabId: null,
  activeGroupId: null,
  draggingGroupId: null,
  queryCounter: 0,
  tabTxStatus: {} as Record<string, TxStatus>,
};

type WorkspaceSlice = Pick<PostgresStoreState, 'tabs' | 'groups' | 'activeTabId' | 'activeGroupId' | 'tabTxStatus'>;

const groupOfPane = (groups: WorkspaceGroup[], paneId: string) =>
  groups.find((group) => group.paneIds.includes(paneId));

const singlePaneGroup = (paneId: string): WorkspaceGroup => ({
  id: generateId(),
  layout: 'vertical',
  paneIds: [paneId],
  focusedPaneId: paneId,
});

const removePanes = (state: WorkspaceSlice, removedIds: Set<string>): WorkspaceSlice => {
  const removedGroupIndex = state.groups.findIndex((group) => group.id === state.activeGroupId);
  const groups = state.groups
    .map((group) => {
      const paneIds = group.paneIds.filter((paneId) => !removedIds.has(paneId));
      const focusedPaneId = paneIds.includes(group.focusedPaneId) ? group.focusedPaneId : paneIds[0];
      return { ...group, paneIds, focusedPaneId };
    })
    .filter((group) => group.paneIds.length > 0);

  const activeGroup =
    groups.find((group) => group.id === state.activeGroupId) ??
    groups[Math.min(Math.max(0, removedGroupIndex - 1), groups.length - 1)];

  const tabTxStatus = Object.fromEntries(
    Object.entries(state.tabTxStatus).filter(([paneId]) => !removedIds.has(paneId))
  );

  return {
    groups,
    tabTxStatus,
    activeGroupId: activeGroup?.id ?? null,
    activeTabId: activeGroup?.focusedPaneId ?? null,
    tabs: state.tabs.filter((tab) => !removedIds.has(tab.id)),
  };
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
      get().setActiveTab(existing.id);
      set({ view: 'workspace' });
      return;
    }
    const tab: WorkspaceTab = { ...input, id: generateId() };
    const group = singlePaneGroup(tab.id);
    set((state) => ({
      view: 'workspace',
      activeTabId: tab.id,
      activeGroupId: group.id,
      tabs: [...state.tabs, tab],
      groups: [...state.groups, group],
    }));
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

  closeTab: (id) => set((state) => removePanes(state, new Set([id]))),

  closeGroup: (groupId) =>
    set((state) => {
      const group = state.groups.find((item) => item.id === groupId);
      return group ? removePanes(state, new Set(group.paneIds)) : {};
    }),

  closeConnectionTabs: (connectionId) => get().closeMatchingTabs((tab) => tab.connectionId === connectionId),

  closeMatchingTabs: (matches) =>
    set((state) => {
      const removedIds = state.tabs.filter(matches).map((tab) => tab.id);
      return removedIds.length ? removePanes(state, new Set(removedIds)) : {};
    }),

  setActiveTab: (id) =>
    set((state) => {
      const group = groupOfPane(state.groups, id);
      if (!group) return {};
      return {
        activeTabId: id,
        activeGroupId: group.id,
        groups: state.groups.map((item) => (item.id === group.id ? { ...item, focusedPaneId: id } : item)),
      };
    }),

  setActiveGroup: (groupId) =>
    set((state) => {
      const group = state.groups.find((item) => item.id === groupId);
      return group ? { activeGroupId: group.id, activeTabId: group.focusedPaneId } : {};
    }),

  setDraggingGroup: (groupId) => set({ draggingGroupId: groupId }),

  mergeGroupInto: (sourceGroupId, targetGroupId, dropZone) =>
    set((state) => {
      const sourceGroup = state.groups.find((group) => group.id === sourceGroupId);
      const targetGroup = state.groups.find((group) => group.id === targetGroupId);
      if (!sourceGroup || !targetGroup || sourceGroupId === targetGroupId) return { draggingGroupId: null };
      if (sourceGroup.paneIds.length + targetGroup.paneIds.length > maxSplitPanes) return { draggingGroupId: null };

      const { layout, insertAtStart } = splitDropZoneLayouts[dropZone];
      const paneIds = insertAtStart
        ? [...sourceGroup.paneIds, ...targetGroup.paneIds]
        : [...targetGroup.paneIds, ...sourceGroup.paneIds];
      const mergedGroup = { ...targetGroup, layout, paneIds, focusedPaneId: sourceGroup.focusedPaneId };

      return {
        draggingGroupId: null,
        activeGroupId: targetGroupId,
        activeTabId: mergedGroup.focusedPaneId,
        groups: state.groups
          .filter((group) => group.id !== sourceGroupId)
          .map((group) => (group.id === targetGroupId ? mergedGroup : group)),
      };
    }),

  detachPane: (id) =>
    set((state) => {
      const originGroup = groupOfPane(state.groups, id);
      if (!originGroup || originGroup.paneIds.length < 2) return {};
      const detachedGroup = singlePaneGroup(id);
      const remainingIds = originGroup.paneIds.filter((paneId) => paneId !== id);
      const groups = state.groups.flatMap((group) => {
        if (group.id !== originGroup.id) return [group];
        const focusedPaneId = remainingIds.includes(group.focusedPaneId) ? group.focusedPaneId : remainingIds[0];
        return [{ ...group, paneIds: remainingIds, focusedPaneId }, detachedGroup];
      });
      return { groups, activeGroupId: detachedGroup.id, activeTabId: id };
    }),

  renameTab: (id, title) => get().updateTab(id, { title }),

  updateTab: (id, changes) =>
    set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...changes } : tab)) })),

  setTabTxStatus: (id, status) =>
    set((state) => ({ tabTxStatus: { ...state.tabTxStatus, [id]: status } })),

  reset: () => set({ ...initialState }),
}));
