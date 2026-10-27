import { requireToken } from './ActionHelpers';
import { useVulpesStore } from '../VulpesStore';
import { requestActions } from './RequestActions';
import { findItem } from '../functions/CollectionTree';
import { VulpesServices } from '../services/VulpesServices';
import { createRequest, emptyAuth, generateId } from '../functions/RequestDefaults';
import type { Cookie, Collection, Environment, ExportFormat, MoveItemInput, CollectionItem, VulpesProtocol, CollectionInput } from '../../../interfaces/VulpesInterfaces';

const store = () => useVulpesStore.getState();

const requestIdsWithin = (item: CollectionItem): string[] =>
  item.kind === 'request' ? [item.id] : item.children.flatMap(requestIdsWithin);

const closeTabsFor = (matches: (itemId: string | null, collectionId: number | null) => boolean) => {
  const tabIds = store()
    .tabs.filter((tab) => matches(tab.kind === 'request' ? tab.itemId : null, tab.collectionId))
    .map((tab) => tab.id);
  tabIds.forEach(requestActions.releaseTab);
  if (tabIds.length) store().removeTabs(tabIds);
};

const collectionInput = (collection: Collection, changes: Partial<CollectionInput> = {}): CollectionInput => ({
  auth: collection.auth,
  name: collection.name,
  variables: collection.variables,
  description: collection.description,
  ...changes,
});

export const collectionActions = {
  async reload() {
    const token = requireToken();
    const [collections, environments] = await Promise.all([
      VulpesServices.findAllCollections(token),
      VulpesServices.findAllEnvironments(token),
    ]);
    store().setData(collections, environments);
  },

  async createCollection(name: string) {
    const collection = await VulpesServices.createCollection(requireToken(), {
      name,
      auth: emptyAuth('none'),
      variables: [],
      description: '',
    });
    store().upsertCollection(collection);
    return collection;
  },

  async updateCollection(collection: Collection, changes: Partial<CollectionInput>) {
    const updated = await VulpesServices.updateCollection(requireToken(), collection.id, collectionInput(collection, changes));
    store().upsertCollection(updated);
    return updated;
  },

  async deleteCollection(collection: Collection) {
    await VulpesServices.deleteCollection(requireToken(), collection.id);
    closeTabsFor((_, collectionId) => collectionId === collection.id);
    store().removeCollection(collection.id);
  },

  exportCollection(collection: Collection, format: ExportFormat) {
    return VulpesServices.exportCollection(requireToken(), collection.id, format);
  },

  async saveCookies(collectionId: number, cookies: Cookie[]) {
    const collection = await VulpesServices.saveCollectionCookies(requireToken(), collectionId, cookies);
    store().upsertCollection(collection);
    return collection;
  },

  async createRequest(collectionId: number, parentId: string, protocol: VulpesProtocol) {
    const item: CollectionItem = {
      id: generateId(),
      kind: 'request',
      name: 'Nova requisição',
      scripts: [],
      children: [],
      description: '',
      request: createRequest(protocol),
    };
    const result = await VulpesServices.createItem(requireToken(), collectionId, parentId, item);
    store().upsertCollection(result.collection);
    store().openItem(collectionId, findItem(result.collection.items, result.itemId) ?? { ...item, id: result.itemId });
    return result.itemId;
  },

  async createFolder(collectionId: number, parentId: string) {
    const folder: CollectionItem = {
      id: generateId(),
      kind: 'folder',
      name: 'Nova pasta',
      scripts: [],
      children: [],
      description: '',
      auth: emptyAuth('inherit'),
    };
    const result = await VulpesServices.createItem(requireToken(), collectionId, parentId, folder);
    store().upsertCollection(result.collection);
    return result.itemId;
  },

  async saveItem(collectionId: number, item: CollectionItem) {
    const collection = await VulpesServices.saveItem(requireToken(), collectionId, item);
    store().upsertCollection(collection);
    store().renameTabs(item.id, item.name);
    return collection;
  },

  async duplicateItem(collectionId: number, item: CollectionItem) {
    const result = await VulpesServices.duplicateItem(requireToken(), collectionId, item.id);
    store().upsertCollection(result.collection);
    return result.itemId;
  },

  async deleteItem(collectionId: number, item: CollectionItem) {
    const current = store().collections.find((candidate) => candidate.id === collectionId);
    const removedItem = (current && findItem(current.items, item.id)) ?? item;
    const collection = await VulpesServices.deleteItem(requireToken(), collectionId, item.id);
    const removedIds = new Set(requestIdsWithin(removedItem));
    closeTabsFor((itemId) => itemId !== null && removedIds.has(itemId));
    store().upsertCollection(collection);
  },

  async moveItem(input: MoveItemInput) {
    const collections = await VulpesServices.moveItem(requireToken(), input);
    collections.forEach((collection) => store().upsertCollection(collection));
    const target = collections.find((collection) => collection.id === input.targetCollectionId);
    const movedItem = target && input.targetCollectionId !== input.collectionId ? findItem(target.items, input.itemId) : null;
    if (target && movedItem) store().moveTabsToCollection(requestIdsWithin(movedItem), target.id);
  },

  importFromFiles() {
    return VulpesServices.importFromFiles(requireToken());
  },

  importFromText(content: string) {
    return VulpesServices.importFromText(requireToken(), content);
  },

  async createEnvironment(name: string) {
    const environment = await VulpesServices.createEnvironment(requireToken(), { name, variables: [] });
    store().upsertEnvironment(environment);
    return environment;
  },

  async updateEnvironment(environment: Environment) {
    const updated = await VulpesServices.updateEnvironment(requireToken(), environment.id, {
      name: environment.name,
      variables: environment.variables,
    });
    store().upsertEnvironment(updated);
    return updated;
  },

  async deleteEnvironment(environment: Environment) {
    await VulpesServices.deleteEnvironment(requireToken(), environment.id);
    store().removeEnvironment(environment.id);
  },

  exportEnvironment(environment: Environment, format: ExportFormat) {
    return VulpesServices.exportEnvironment(requireToken(), environment.id, format);
  },
};
