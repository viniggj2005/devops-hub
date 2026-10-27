import type { Collection, WorkspaceTab } from '../../../interfaces/VulpesInterfaces';

export const workspaceTabLabel = (tab: WorkspaceTab, collections: Collection[]) => {
  if (tab.kind === 'request') return tab.name;
  const collection = collections.find((candidate) => candidate.id === tab.collectionId);
  return collection ? `Cookies · ${collection.name}` : 'Cookies';
};
