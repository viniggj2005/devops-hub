import React, { useEffect, useRef, useState } from 'react';
import { requestBadge } from '../../functions/RequestDefaults';
import { countRequests, filterTree } from '../../functions/CollectionTree';
import { ChevronRight, Folder, FolderOpen, Library, MoreHorizontal } from 'lucide-react';
import type { Collection, CollectionItem } from '../../../../interfaces/VulpesInterfaces';
import { collectionKey, DropHint, itemKey, TreeTarget, useSidebarTree } from './SidebarTreeContext';

const indentFor = (depth: number) => ({ paddingLeft: 6 + depth * 14 });

const dropHighlight = (hint: DropHint | null, key: string) => {
  if (hint?.key !== key) return '';
  return hint.position === 'into' ? 'ring-1 ring-inset ring-amber-500 bg-amber-500/10' : 'shadow-[inset_0_2px_0_0_#f59e0b]';
};

const InlineRename: React.FC<{ initialName: string; onFinish: (name: string | null) => void }> = ({ initialName, onFinish }) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => inputRef.current?.select(), []);

  const finish = (value: string | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(value);
  };

  return (
    <input
      ref={inputRef}
      value={name}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => finish(name)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(name);
        if (event.key === 'Escape') finish(null);
      }}
      className="flex-1 min-w-0 rounded bg-white dark:bg-zinc-950 border border-amber-500 px-1.5 py-0.5 text-xs text-gray-900 dark:text-white focus:outline-none"
    />
  );
};

const MenuButton: React.FC<{ target: TreeTarget }> = ({ target }) => {
  const tree = useSidebarTree();
  return (
    <button
      type="button"
      title="Ações"
      onClick={(event) => {
        event.stopPropagation();
        tree.openMenu(event, target);
      }}
      className="p-0.5 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
    >
      <MoreHorizontal className="w-3.5 h-3.5" />
    </button>
  );
};

interface ItemNodeProps {
  depth: number;
  index: number;
  parentId: string;
  item: CollectionItem;
  collection: Collection;
}

const ItemNode: React.FC<ItemNodeProps> = ({ collection, item, depth, parentId, index }) => {
  const tree = useSidebarTree();
  const key = itemKey(item.id);
  const isFolder = item.kind === 'folder';
  const isRenaming = tree.renamingKey === key;
  const expanded = isFolder && (tree.searching || tree.isExpanded(key));
  const target: TreeTarget = { collection, item };
  const hint: DropHint = isFolder
    ? { key, index: -1, parentId: item.id, collectionId: collection.id, position: 'into' }
    : { key, index, parentId, collectionId: collection.id, position: 'before' };
  const badge = requestBadge(item.request);

  return (
    <>
      <div
        style={indentFor(depth)}
        draggable={!tree.searching && !isRenaming}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', item.name);
          tree.beginDrag({ collectionId: collection.id, item });
        }}
        onDragEnd={tree.endDrag}
        onDragOver={(event) => tree.dragOver(event, hint)}
        onDrop={(event) => tree.drop(event, hint)}
        onClick={() => (isFolder ? tree.toggle(key) : tree.openItem(collection, item))}
        onContextMenu={(event) => {
          event.preventDefault();
          tree.openMenu(event, target);
        }}
        className={`group flex items-center gap-1.5 h-7 pr-1 mx-1 rounded-md text-xs cursor-pointer select-none ${
          tree.activeItemId === item.id
            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200'
            : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5'
        } ${dropHighlight(tree.dropHint, key)}`}
      >
        {isFolder ? (
          <>
            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            {expanded ? (
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
            ) : (
              <Folder className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
            )}
          </>
        ) : (
          <span className={`w-11 flex-shrink-0 text-right text-[9px] font-extrabold tracking-wide ${badge.className}`}>{badge.label}</span>
        )}
        {isRenaming ? (
          <InlineRename initialName={item.name} onFinish={(name) => tree.finishRename(target, name)} />
        ) : (
          <span className="flex-1 min-w-0 truncate">{item.name}</span>
        )}
        {!isRenaming && <MenuButton target={target} />}
      </div>
      {expanded &&
        item.children.map((child, childIndex) => (
          <ItemNode key={child.id} collection={collection} item={child} depth={depth + 1} parentId={item.id} index={childIndex} />
        ))}
      {expanded && item.children.length === 0 && (
        <p style={indentFor(depth + 2)} className="h-6 flex items-center text-[11px] italic text-gray-400 dark:text-zinc-500">
          Pasta vazia
        </p>
      )}
    </>
  );
};

export const CollectionNode: React.FC<{ collection: Collection; search: string }> = ({ collection, search }) => {
  const tree = useSidebarTree();
  const key = collectionKey(collection.id);
  const isRenaming = tree.renamingKey === key;
  const items = tree.searching && !collection.name.toLowerCase().includes(search.trim().toLowerCase()) ? filterTree(collection.items, search) : collection.items;
  const expanded = tree.isExpanded(key) || (tree.searching && items.length > 0);
  const target: TreeTarget = { collection, item: null };
  const hint: DropHint = { key, index: -1, parentId: '', collectionId: collection.id, position: 'into' };

  if (tree.searching && items.length === 0 && !collection.name.toLowerCase().includes(search.trim().toLowerCase())) return null;

  return (
    <div className="py-0.5">
      <div
        onDragOver={(event) => tree.dragOver(event, hint)}
        onDrop={(event) => tree.drop(event, hint)}
        onClick={() => tree.toggle(key)}
        onContextMenu={(event) => {
          event.preventDefault();
          tree.openMenu(event, target);
        }}
        className={`group flex items-center gap-1.5 h-8 pl-1.5 pr-1 mx-1 rounded-md text-xs font-semibold cursor-pointer select-none text-gray-800 dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-white/5 ${dropHighlight(
          tree.dropHint,
          key
        )}`}
      >
        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <Library className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        {isRenaming ? (
          <InlineRename initialName={collection.name} onFinish={(name) => tree.finishRename(target, name)} />
        ) : (
          <span className="flex-1 min-w-0 truncate">{collection.name}</span>
        )}
        {!isRenaming && (
          <span className="text-[10px] font-normal text-gray-400 dark:text-zinc-500 group-hover:hidden">{countRequests(collection.items)}</span>
        )}
        {!isRenaming && <MenuButton target={target} />}
      </div>
      {expanded &&
        items.map((item, index) => <ItemNode key={item.id} collection={collection} item={item} depth={1} parentId="" index={index} />)}
      {expanded && collection.items.length === 0 && (
        <p className="pl-9 h-6 flex items-center text-[11px] italic text-gray-400 dark:text-zinc-500">Coleção vazia — use o menu ⋯ para adicionar</p>
      )}
    </div>
  );
};
