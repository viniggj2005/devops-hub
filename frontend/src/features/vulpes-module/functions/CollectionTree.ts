import { authLabels, requestUrl } from './RequestDefaults';
import type { Collection, CollectionItem } from '../../../interfaces/VulpesInterfaces';

interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

export const findItem = (items: CollectionItem[], itemId: string): CollectionItem | null => {
  for (const item of items) {
    if (item.id === itemId) return item;
    const nested = findItem(item.children, itemId);
    if (nested) return nested;
  }
  return null;
};

export const ancestorsOf = (items: CollectionItem[], itemId: string): CollectionItem[] | null => {
  for (const item of items) {
    if (item.id === itemId) return [];
    const nested = ancestorsOf(item.children, itemId);
    if (nested) return [item, ...nested];
  }
  return null;
};

export const describeInheritedAuth = (collection: Collection | null | undefined, itemId: string | null) => {
  if (!collection) return 'Requisição fora de uma coleção: nenhuma autenticação será herdada.';
  const ancestors = itemId ? ancestorsOf(collection.items, itemId) ?? [] : [];
  const folder = [...ancestors].reverse().find((candidate) => candidate.auth && candidate.auth.type !== 'inherit');
  if (folder?.auth) return `${authLabels[folder.auth.type]} herdado da pasta "${folder.name}".`;
  if (collection.auth.type === 'none') return `A coleção "${collection.name}" não define autenticação.`;
  return `${authLabels[collection.auth.type]} herdado da coleção "${collection.name}".`;
};

export const containsItem = (item: CollectionItem, itemId: string): boolean =>
  item.id === itemId || findItem(item.children, itemId) !== null;

export const listFolders = (items: CollectionItem[], depth = 0): FolderOption[] =>
  items
    .filter((item) => item.kind === 'folder')
    .flatMap((folder) => [{ id: folder.id, name: folder.name, depth }, ...listFolders(folder.children, depth + 1)]);

export const countRequests = (items: CollectionItem[]): number =>
  items.reduce((total, item) => total + (item.kind === 'request' ? 1 : countRequests(item.children)), 0);

export const filterTree = (items: CollectionItem[], query: string): CollectionItem[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.flatMap((item) => {
    if (item.kind === 'request') {
      const haystack = `${item.name} ${requestUrl(item.request)}`.toLowerCase();
      return haystack.includes(normalizedQuery) ? [item] : [];
    }
    if (item.name.toLowerCase().includes(normalizedQuery)) return [item];
    const children = filterTree(item.children, normalizedQuery);
    return children.length ? [{ ...item, children }] : [];
  });
};
