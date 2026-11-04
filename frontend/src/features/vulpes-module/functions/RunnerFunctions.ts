import { findItem } from './CollectionTree';
import { requestUrl } from './RequestDefaults';
import { isRequestTab } from '../VulpesStore';
import type {
  Collection,
  GrpcResponse,
  HttpResponse,
  WorkspaceTab,
  VulpesRequest,
  CollectionItem,
  VulpesProtocol,
} from '../../../interfaces/VulpesInterfaces';

export type RunnerStepStatus = 'running' | 'passed' | 'failed' | 'error' | 'cancelled';

export interface RunnerRequestEntry {
  url: string;
  name: string;
  itemId: string;
  breadcrumb: string;
  folderPath: string[];
  request: VulpesRequest;
  protocol: VulpesProtocol;
}

export interface RunnerConfig {
  delayMs: number;
  iterations: number;
  stopOnError: boolean;
  persistResponses: boolean;
}

export interface RunnerStepResult {
  id: string;
  url: string;
  name: string;
  itemId: string;
  method: string;
  iteration: number;
  sizeBytes: number;
  breadcrumb: string;
  durationMs: number;
  statusText: string;
  error: string | null;
  status: RunnerStepStatus;
  protocol: VulpesProtocol;
  statusCode: number | null;
  httpResponse: HttpResponse | null;
  grpcResponse: GrpcResponse | null;
}

export interface RunnerSummary {
  total: number;
  passed: number;
  failed: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

export const defaultRunnerConfig = (): RunnerConfig => ({
  delayMs: 0,
  iterations: 1,
  stopOnError: false,
  persistResponses: true,
});

const isBatchExecutable = (protocol: VulpesProtocol) => protocol === 'http' || protocol === 'grpc';

const flattenRequests = (
  items: CollectionItem[],
  collectionId: number,
  openTabs: WorkspaceTab[],
  folderPath: string[] = []
): RunnerRequestEntry[] =>
  items.flatMap((item) => {
    if (item.kind === 'folder') {
      return flattenRequests(item.children, collectionId, openTabs, [...folderPath, item.name]);
    }
    const openTab = openTabs.find(
      (tab) => isRequestTab(tab) && tab.collectionId === collectionId && tab.itemId === item.id
    );
    const request = (isRequestTab(openTab) ? openTab.request : null) ?? item.request;
    if (!request || !isBatchExecutable(request.protocol)) return [];
    return [
      {
        request,
        itemId: item.id,
        name: item.name,
        folderPath,
        protocol: request.protocol,
        url: requestUrl(request),
        breadcrumb: folderPath.join(' / '),
      },
    ];
  });

export const collectRunnableRequests = (
  collection: Collection | null,
  folderId: string | null,
  openTabs: WorkspaceTab[]
): RunnerRequestEntry[] => {
  if (!collection) return [];
  if (!folderId) {
    return flattenRequests(collection.items, collection.id, openTabs);
  }
  const folder = findItem(collection.items, folderId);
  if (!folder || folder.kind !== 'folder') return [];
  return flattenRequests(folder.children, collection.id, openTabs, [folder.name]);
};

export const reconcileRunnerOrder = (
  entries: RunnerRequestEntry[],
  customOrderIds: string[]
): RunnerRequestEntry[] => {
  if (customOrderIds.length === 0) return entries;
  const byId = new Map(entries.map((entry) => [entry.itemId, entry]));
  const ordered: RunnerRequestEntry[] = [];
  const seen = new Set<string>();

  for (const itemId of customOrderIds) {
    const entry = byId.get(itemId);
    if (entry && !seen.has(itemId)) {
      ordered.push(entry);
      seen.add(itemId);
    }
  }
  for (const entry of entries) {
    if (!seen.has(entry.itemId)) {
      ordered.push(entry);
    }
  }
  return ordered;
};

export const isCustomOrderChanged = (
  treeEntries: RunnerRequestEntry[],
  orderedEntries: RunnerRequestEntry[]
): boolean => {
  if (treeEntries.length !== orderedEntries.length) return false;
  return treeEntries.some((entry, index) => entry.itemId !== orderedEntries[index]?.itemId);
};

export const moveArrayItem = <Element>(items: Element[], fromIndex: number, toIndex: number): Element[] => {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const summarizeRunnerResults = (results: RunnerStepResult[]): RunnerSummary => {
  const completed = results.filter((result) => result.status !== 'running');
  const passed = completed.filter((result) => result.status === 'passed').length;
  const failed = completed.filter((result) => result.status === 'failed' || result.status === 'error').length;
  const totalDurationMs = completed.reduce((sum, result) => sum + result.durationMs, 0);
  const averageDurationMs = completed.length > 0 ? totalDurationMs / completed.length : 0;
  return {
    passed,
    failed,
    totalDurationMs,
    averageDurationMs,
    total: completed.length,
  };
};

