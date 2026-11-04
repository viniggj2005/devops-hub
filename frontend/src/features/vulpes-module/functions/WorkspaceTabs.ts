import { findItem } from './CollectionTree';
import type { Collection, WorkspaceTab } from '../../../interfaces/VulpesInterfaces';

export const workspaceTabLabel = (tab: WorkspaceTab, collections: Collection[]) => {
  if (tab.kind === 'request') return tab.name;
  const collection = collections.find((candidate) => candidate.id === tab.collectionId);
  if (tab.kind === 'runner') {
    const folder = collection && tab.folderId ? findItem(collection.items, tab.folderId) : null;
    if (collection && folder) return `Runner · ${collection.name} / ${folder.name}`;
    return collection ? `Runner · ${collection.name}` : 'Runner';
  }
  return collection ? `Cookies · ${collection.name}` : 'Cookies';
};
