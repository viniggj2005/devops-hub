import { CollectionNode } from './TreeNodes';
import ImportModal from '../modals/ImportModal';
import { useTranslation } from '../../../i18n/useTranslation';
import React, { useEffect, useMemo, useState } from 'react';
import { isRequestTab, useVulpesStore } from '../../VulpesStore';
import { collectionActions } from '../../actions/CollectionActions';
import CollectionSettingsModal from '../modals/CollectionSettingsModal';
import { PROTOCOLS, protocolLabels } from '../../functions/RequestDefaults';
import { containsItem, findItemPosition } from '../../functions/CollectionTree';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import { announceExport, exportFormats, runWithToast } from '../../actions/ActionHelpers';
import ContextMenu, { ContextMenuEntry } from '../../../shared/components/menus/ContextMenu';
import { itemKey, DropHint, TreeTarget, DragPayload, collectionKey, SidebarTreeContext, SidebarTreeContextValue } from './SidebarTreeContext';
import {
  Play,
  Copy,
  Plus,
  Pencil,
  Search,
  Trash2,
  Upload,
  ArrowUp,
  Download,
  ArrowDown,
  Settings2,
  FilePlus2,
  FolderPlus,
  PanelLeftClose,
  Cookie as CookieIcon,
} from 'lucide-react';

const expandedStorageKey = 'vulpes-expanded-nodes';

const readExpanded = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(expandedStorageKey) ?? '[]');
    return new Set<string>(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set<string>();
  }
};

interface MenuState {
  x: number;
  y: number;
  target: TreeTarget;
}

const CollectionsSidebar: React.FC<{ onCollapse: () => void }> = ({ onCollapse }) => {
  const confirm = useConfirmToast();
  const { dictionary, formatMessage } = useTranslation();
  const sidebarTexts = dictionary.vulpes.sidebar;
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(readExpanded);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<TreeTarget | null>(null);
  const collections = useVulpesStore((state) => state.collections);
  const activeItemId = useVulpesStore((state) => {
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    return isRequestTab(activeTab) ? activeTab.itemId : null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(expanded)));
    } catch {
      return;
    }
  }, [expanded]);

  const expand = (...keys: string[]) => setExpanded((current) => new Set([...current, ...keys]));

  const parentKeyOf = (target: TreeTarget) => (target.item ? itemKey(target.item.id) : collectionKey(target.collection.id));

  const createCollection = async () => {
    const collection = await runWithToast(() => collectionActions.createCollection(sidebarTexts.newCollection));
    if (!collection) return;
    expand(collectionKey(collection.id));
    setRenamingKey(collectionKey(collection.id));
  };

  const canDrop = (hint: DropHint) => {
    if (!dragging) return false;
    const sameCollection = dragging.collectionId === hint.collectionId;
    if (sameCollection && dragging.item.kind === 'folder' && hint.parentId && containsItem(dragging.item, hint.parentId)) {
      return false;
    }
    if (hint.position === 'into') {
      return hint.key !== itemKey(dragging.item.id);
    }
    if (sameCollection && dragging.parentId === hint.parentId && (hint.index === dragging.index || hint.index === dragging.index + 1)) {
      return false;
    }
    return true;
  };

  const moveByOffset = (collection: TreeTarget['collection'], item: NonNullable<TreeTarget['item']>, direction: 'up' | 'down') => {
    const position = findItemPosition(collection.items, item.id);
    if (!position) return;
    if (direction === 'up' && position.index <= 0) return;
    if (direction === 'down' && position.index >= position.siblingCount - 1) return;
    const targetIndex = direction === 'up' ? position.index - 1 : position.index + 2;
    runWithToast(() =>
      collectionActions.moveItem({
        itemId: item.id,
        targetIndex,
        collectionId: collection.id,
        targetParentId: position.parentId,
        targetCollectionId: collection.id,
      })
    );
  };

  const treeContext = useMemo<SidebarTreeContextValue>(
    () => ({
      dropHint,
      renamingKey,
      activeItemId,
      searching: search.trim().length > 0,
      isExpanded: (key) => expanded.has(key),
      toggle: (key) =>
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        }),
      openItem: (collection, item) => useVulpesStore.getState().openItem(collection.id, item),
      openMenu: (event, target) => setMenu({ x: event.clientX, y: event.clientY, target }),
      openRunner: (collectionId, folderId) => useVulpesStore.getState().openRunner(collectionId, folderId),
      moveByOffset,
      beginDrag: setDragging,
      endDrag: () => {
        setDragging(null);
        setDropHint(null);
      },
      dragOver: (event, hint) => {
        if (!canDrop(hint)) {
          if (dropHint) setDropHint(null);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dropHint?.key !== hint.key || dropHint?.position !== hint.position || dropHint?.index !== hint.index) {
          setDropHint(hint);
        }
      },
      drop: (event, hint) => {
        event.preventDefault();
        const payload = dragging;
        setDragging(null);
        setDropHint(null);
        if (!payload || !canDrop(hint)) return;
        if (hint.position === 'into') expand(hint.parentId ? itemKey(hint.parentId) : collectionKey(hint.collectionId));
        runWithToast(() =>
          collectionActions.moveItem({
            itemId: payload.item.id,
            targetIndex: hint.index,
            collectionId: payload.collectionId,
            targetParentId: hint.parentId,
            targetCollectionId: hint.collectionId,
          })
        );
      },
      finishRename: (target, name) => {
        setRenamingKey(null);
        const trimmed = name?.trim();
        const currentName = target.item?.name ?? target.collection.name;
        if (!trimmed || trimmed === currentName) return;
        if (target.item) runWithToast(() => collectionActions.saveItem(target.collection.id, { ...target.item!, name: trimmed }));
        else runWithToast(() => collectionActions.updateCollection(target.collection, { name: trimmed }));
      },
    }),
    [dropHint, renamingKey, activeItemId, search, expanded, dragging]
  );

  const menuEntries = ({ collection, item }: TreeTarget): ContextMenuEntry[] => {
    const target = { collection, item };
    const parentId = item?.id ?? '';
    const isRequest = item?.kind === 'request';
    const position = item ? findItemPosition(collection.items, item.id) : null;
    const creationEntries: ContextMenuEntry[] = isRequest
      ? []
      : [
          {
            icon: Play,
            label: item ? sidebarTexts.runFolder : sidebarTexts.runCollection,
            onClick: () => useVulpesStore.getState().openRunner(collection.id, item?.id ?? null),
          },
          'separator',
          ...PROTOCOLS.map((protocol) => ({
            icon: FilePlus2,
            label: formatMessage(sidebarTexts.newRequestOf, { protocol: protocolLabels[protocol] }),
            onClick: async () => {
              expand(parentKeyOf(target));
              await runWithToast(() => collectionActions.createRequest(collection.id, parentId, protocol));
            },
          })),
          {
            icon: FolderPlus,
            label: dictionary.vulpes.common.newFolder,
            onClick: async () => {
              const folderId = await runWithToast(() => collectionActions.createFolder(collection.id, parentId));
              if (!folderId) return;
              expand(parentKeyOf(target), itemKey(folderId));
              setRenamingKey(itemKey(folderId));
            },
          },
          'separator',
          { icon: Settings2, label: item ? sidebarTexts.folderSettings : sidebarTexts.collectionSettings, onClick: () => setSettingsTarget(target) },
        ];

    const reorderEntries: ContextMenuEntry[] =
      item && position
        ? [
            'separator',
            {
              icon: ArrowUp,
              label: sidebarTexts.moveUp,
              disabled: position.index <= 0,
              onClick: () => moveByOffset(collection, item, 'up'),
            },
            {
              icon: ArrowDown,
              label: sidebarTexts.moveDown,
              disabled: position.index >= position.siblingCount - 1,
              onClick: () => moveByOffset(collection, item, 'down'),
            },
          ]
        : [];

    const deleteEntry: ContextMenuEntry = {
      icon: Trash2,
      label: sidebarTexts.delete,
      onClick: () =>
        confirm({
          title: item ? (isRequest ? sidebarTexts.deleteRequestTitle : sidebarTexts.deleteFolderTitle) : sidebarTexts.deleteCollectionTitle,
          message: item
            ? formatMessage(item.kind === 'folder' ? sidebarTexts.deleteFolderMessage : sidebarTexts.deleteItemMessage, { name: item.name })
            : formatMessage(sidebarTexts.deleteCollectionMessage, { name: collection.name }),
          onConfirm: () => (item ? collectionActions.deleteItem(collection.id, item) : collectionActions.deleteCollection(collection)),
        }),
    };

    return [
      ...creationEntries,
      { icon: Pencil, label: sidebarTexts.rename, onClick: () => setRenamingKey(item ? itemKey(item.id) : collectionKey(collection.id)) },
      ...(item
        ? [{ icon: Copy, label: sidebarTexts.duplicate, onClick: () => runWithToast(() => collectionActions.duplicateItem(collection.id, item)) }]
        : [
            { icon: CookieIcon, label: 'Cookies', onClick: () => useVulpesStore.getState().openCookies(collection.id) },
            'separator' as const,
            ...exportFormats.map(({ format, label }) => ({
              icon: Download,
              label: formatMessage(dictionary.vulpes.environments.exportTo, { format: label }),
              onClick: async () => announceExport(await runWithToast(() => collectionActions.exportCollection(collection, format)), 'collection'),
            })),
          ]),
      ...reorderEntries,
      'separator',
      deleteEntry,
    ];
  };

  return (
    <SidebarTreeContext.Provider value={treeContext}>
      <div className="h-full flex flex-col min-h-0">
        <div className="flex items-center gap-1 px-3 h-11 flex-shrink-0 border-b border-gray-200 dark:border-white/5">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex-1">{sidebarTexts.title}</span>
          <button type="button" title={sidebarTexts.newCollection} onClick={createCollection} className="p-1.5 rounded-lg text-gray-500 hover:text-amber-500 hover:bg-amber-500/10">
            <Plus className="w-4 h-4" />
          </button>
          <button type="button" title={dictionary.vulpes.importer.title} onClick={() => setImportOpen(true)} className="p-1.5 rounded-lg text-gray-500 hover:text-amber-500 hover:bg-amber-500/10">
            <Upload className="w-4 h-4" />
          </button>
          <button type="button" title={sidebarTexts.collapse} onClick={onCollapse} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              placeholder={sidebarTexts.searchPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-white/10 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto pb-3">
          {collections.length === 0 && (
            <div className="px-4 py-8 text-center space-y-3">
              <p className="text-xs text-gray-500 dark:text-zinc-400">{sidebarTexts.empty}</p>
              <div className="flex justify-center gap-2">
                <button type="button" onClick={createCollection} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20">
                  {sidebarTexts.newCollection}
                </button>
                <button type="button" onClick={() => setImportOpen(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10">
                  {sidebarTexts.import}
                </button>
              </div>
            </div>
          )}
          {collections.map((collection) => (
            <CollectionNode key={collection.id} collection={collection} search={search} />
          ))}
        </div>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          entries={menuEntries(menu.target)}
          title={menu.target.item?.name ?? menu.target.collection.name}
        />
      )}
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
      <CollectionSettingsModal target={settingsTarget} onClose={() => setSettingsTarget(null)} />
    </SidebarTreeContext.Provider>
  );
};

export default CollectionsSidebar;
