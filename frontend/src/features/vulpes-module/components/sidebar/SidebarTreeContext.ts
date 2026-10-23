import React, { createContext, useContext } from 'react';
import type { Collection, CollectionItem } from '../../../../interfaces/VulpesInterfaces';

export interface TreeTarget {
  collection: Collection;
  item: CollectionItem | null;
}

export interface DragPayload {
  collectionId: number;
  item: CollectionItem;
}

export interface DropHint {
  key: string;
  index: number;
  parentId: string;
  collectionId: number;
  position: 'into' | 'before';
}

export interface SidebarTreeContextValue {
  searching: boolean;
  endDrag: () => void;
  dropHint: DropHint | null;
  renamingKey: string | null;
  activeItemId: string | null;
  toggle: (key: string) => void;
  isExpanded: (key: string) => boolean;
  beginDrag: (payload: DragPayload) => void;
  drop: (event: React.DragEvent, hint: DropHint) => void;
  dragOver: (event: React.DragEvent, hint: DropHint) => void;
  openItem: (collection: Collection, item: CollectionItem) => void;
  finishRename: (target: TreeTarget, name: string | null) => void;
  openMenu: (event: React.MouseEvent, target: TreeTarget) => void;
}

export const SidebarTreeContext = createContext<SidebarTreeContextValue | null>(null);

export const useSidebarTree = () => {
  const context = useContext(SidebarTreeContext);
  if (!context) throw new Error('useSidebarTree deve ser usado dentro de SidebarTreeContext');
  return context;
};

export const collectionKey = (collectionId: number) => `collection:${collectionId}`;

export const itemKey = (itemId: string) => `item:${itemId}`;
