import toast from 'react-hot-toast';
import RichMessage from '../../../i18n/RichMessage';
import { useTranslation } from '../../../i18n/useTranslation';
import { requireToken } from '../../actions/ActionHelpers';
import GrpcResponseViewer from '../grpc/GrpcResponseViewer';
import HttpResponseViewer from '../http/HttpResponseViewer';
import Select from '../../../shared/components/forms/Select';
import { VulpesServices } from '../../services/VulpesServices';
import { emptyRuntime, useVulpesStore } from '../../VulpesStore';
import { CancelError, CancellablePromise } from '@wailsio/runtime';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { findItem, listFolders } from '../../functions/CollectionTree';
import { generateId, requestBadge } from '../../functions/RequestDefaults';
import { VariableScopeProvider } from '../../contexts/VariableScopeContext';
import { formatBytes, formatDuration, statusTone } from '../../functions/Formatters';
import type { Cookie, RunnerTab, ExecutionInput } from '../../../../interfaces/VulpesInterfaces';
import { iconButtonClass, fieldInputClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';
import {
  moveArrayItem,
  defaultRunnerConfig,
  reconcileRunnerOrder,
  isCustomOrderChanged,
  collectRunnableRequests,
  summarizeRunnerResults,
  type RunnerConfig,
  type RunnerStepResult,
  type RunnerRequestEntry,
} from '../../functions/RunnerFunctions';
import {
  X,
  Play,
  Square,
  Search,
  Trash2,
  Loader2,
  XCircle,
  ArrowUp,
  RotateCcw,
  ArrowDown,
  CheckSquare,
  GripVertical,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Square as UncheckedIcon,
} from 'lucide-react';

interface RunnerViewProps {
  tab: RunnerTab;
  paneControls?: React.ReactNode;
}

type StatusFilter = 'all' | 'passed' | 'failed';

const sleepInterruptible = (milliseconds: number, onCancelRef: React.MutableRefObject<(() => void) | null>) =>
  new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      onCancelRef.current = null;
      resolve();
    }, milliseconds);
    onCancelRef.current = () => {
      window.clearTimeout(timer);
      onCancelRef.current = null;
      resolve();
    };
  });

const RunnerView: React.FC<RunnerViewProps> = ({ tab, paneControls }) => {
  const tabs = useVulpesStore((state) => state.tabs);
  const { dictionary, formatMessage } = useTranslation();
  const runnerTexts = dictionary.vulpes.runner;
  const openItem = useVulpesStore((state) => state.openItem);
  const collections = useVulpesStore((state) => state.collections);
  const environments = useVulpesStore((state) => state.environments);
  const setRunnerTarget = useVulpesStore((state) => state.setRunnerTarget);
  const setItemResponse = useVulpesStore((state) => state.setItemResponse);
  const activeEnvironmentId = useVulpesStore((state) => state.activeEnvironmentId);
  const applyCollectionCookies = useVulpesStore((state) => state.applyCollectionCookies);

  const [search, setSearch] = useState('');
  const [running, setRunning] = useState(false);
  const [customOrderIds, setCustomOrderIds] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<RunnerConfig>(defaultRunnerConfig);
  const [results, setResults] = useState<RunnerStepResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [iterationFilter, setIterationFilter] = useState<number | 'all'>('all');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [progressText, setProgressText] = useState('');

  const cancelledRef = useRef(false);
  const activeCallRef = useRef<CancellablePromise<unknown> | null>(null);
  const cancelDelayRef = useRef<(() => void) | null>(null);

  const collection = useMemo(
    () => collections.find((candidate) => candidate.id === tab.collectionId) ?? null,
    [collections, tab.collectionId]
  );

  const activeEnvironment = useMemo(
    () => environments.find((candidate) => candidate.id === activeEnvironmentId) ?? null,
    [environments, activeEnvironmentId]
  );

  useEffect(() => {
    if (!collection && collections.length > 0) {
      setRunnerTarget(tab.id, collections[0].id, null);
    }
  }, [collection, collections, setRunnerTarget, tab.id]);

  useEffect(() => {
    if (collection && tab.folderId && !findItem(collection.items, tab.folderId)) {
      setRunnerTarget(tab.id, collection.id, null);
    }
  }, [collection, tab.folderId, setRunnerTarget, tab.id]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      activeCallRef.current?.cancel();
      cancelDelayRef.current?.();
    },
    []
  );

  const folders = useMemo(() => (collection ? listFolders(collection.items) : []), [collection]);

  const treeEntries = useMemo(
    () => collectRunnableRequests(collection, tab.folderId, tabs),
    [collection, tab.folderId, tabs]
  );

  const activeTreeEntries = useMemo(
    () => treeEntries.filter((entry) => !removedIds.has(entry.itemId)),
    [treeEntries, removedIds]
  );

  const orderedEntries = useMemo(
    () => reconcileRunnerOrder(activeTreeEntries, customOrderIds),
    [activeTreeEntries, customOrderIds]
  );

  const orderModified = useMemo(
    () => isCustomOrderChanged(activeTreeEntries, orderedEntries),
    [activeTreeEntries, orderedEntries]
  );

  const hasQueueCustomizations = orderModified || removedIds.size > 0;

  const visibleQueueEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orderedEntries;
    return orderedEntries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.url.toLowerCase().includes(query) ||
        entry.breadcrumb.toLowerCase().includes(query)
    );
  }, [orderedEntries, search]);

  const selectedEntries = useMemo(
    () => orderedEntries.filter((entry) => !deselectedIds.has(entry.itemId)),
    [orderedEntries, deselectedIds]
  );

  const allSelected = orderedEntries.length > 0 && selectedEntries.length === orderedEntries.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setDeselectedIds(new Set(orderedEntries.map((entry) => entry.itemId)));
    } else {
      setDeselectedIds(new Set());
    }
  };

  const toggleEntry = (itemId: string) => {
    setDeselectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const removeEntryFromQueue = (itemId: string) => {
    setRemovedIds((current) => new Set([...current, itemId]));
  };

  const removeResultFromList = (stepId: string) => {
    setResults((current) => current.filter((candidate) => candidate.id !== stepId));
    setSelectedResultId((current) => (current === stepId ? null : current));
  };

  const moveEntry = (fromIndex: number, toIndex: number) => {
    const currentIds = orderedEntries.map((entry) => entry.itemId);
    const reordered = moveArrayItem(currentIds, fromIndex, toIndex);
    setCustomOrderIds(reordered);
  };

  const resetQueue = () => {
    setCustomOrderIds([]);
    setRemovedIds(new Set());
  };

  const openEntryInTab = (itemId: string) => {
    if (!collection) return;
    const item = findItem(collection.items, itemId);
    if (item) openItem(collection.id, item);
  };

  const stopRun = () => {
    cancelledRef.current = true;
    activeCallRef.current?.cancel();
    cancelDelayRef.current?.();
  };

  const executeSingleEntry = async (
    entry: RunnerRequestEntry,
    collectionId: number,
    environmentId: number
  ): Promise<Omit<RunnerStepResult, 'id' | 'iteration'>> => {
    const token = requireToken();
    const input: ExecutionInput = {
      request: entry.request,
      scope: {
        itemId: entry.itemId,
        collectionId,
        environmentId,
      },
    };
    const badge = requestBadge(entry.request);
    const startedAt = performance.now();

    try {
      if (entry.protocol === 'http') {
        const call = VulpesServices.sendHttpRequest(token, input);
        activeCallRef.current = call;
        const response = await call;
        activeCallRef.current = null;

        if (config.persistResponses) {
          setItemResponse(collectionId, entry.itemId, response);
          if (response.collectionCookies) {
            applyCollectionCookies(collectionId, response.collectionCookies as Cookie[]);
            VulpesServices.announceDataChange();
          }
        }

        const passed = response.statusCode >= 200 && response.statusCode < 400;
        return {
          name: entry.name,
          itemId: entry.itemId,
          method: badge.label,
          url: response.url || entry.url,
          breadcrumb: entry.breadcrumb,
          durationMs: response.timings.totalMs,
          sizeBytes: response.sizeBytes,
          statusCode: response.statusCode,
          statusText: response.status,
          status: passed ? 'passed' : 'failed',
          error: null,
          protocol: 'http',
          httpResponse: response,
          grpcResponse: null,
        };
      }

      const call = VulpesServices.invokeGrpc(token, input);
      activeCallRef.current = call;
      const response = await call;
      activeCallRef.current = null;
      const passed = response.statusCode === 0;
      return {
        name: entry.name,
        itemId: entry.itemId,
        method: 'gRPC',
        url: entry.url,
        breadcrumb: entry.breadcrumb,
        durationMs: response.durationMs,
        sizeBytes: new Blob([response.message]).size,
        statusCode: response.statusCode,
        statusText: `${response.statusCode} ${response.code}`,
        status: passed ? 'passed' : 'failed',
        error: null,
        protocol: 'grpc',
        httpResponse: null,
        grpcResponse: response,
      };
    } catch (error) {
      activeCallRef.current = null;
      const isCancelled = error instanceof CancelError || cancelledRef.current;
      return {
        name: entry.name,
        itemId: entry.itemId,
        method: badge.label,
        url: entry.url,
        breadcrumb: entry.breadcrumb,
        durationMs: Math.max(0, performance.now() - startedAt),
        sizeBytes: 0,
        statusCode: null,
        statusText: isCancelled ? runnerTexts.cancelled : runnerTexts.error,
        status: isCancelled ? 'cancelled' : 'error',
        error: isCancelled ? dictionary.vulpes.common.requestCancelled : errorMessage(error),
        protocol: entry.protocol,
        httpResponse: null,
        grpcResponse: null,
      };
    }
  };

  const startRun = async () => {
    if (!collection || running) return;
    if (selectedEntries.length === 0) {
      toast.error(runnerTexts.selectAtLeastOne);
      return;
    }

    const iterations = Math.min(999, Math.max(1, Math.floor(config.iterations || 1)));
    const delayMs = Math.min(60000, Math.max(0, Math.floor(config.delayMs || 0)));
    const environmentId = activeEnvironmentId ?? 0;

    cancelledRef.current = false;
    setRunning(true);
    setResults([]);
    setSelectedResultId(null);
    setIterationFilter('all');
    setStatusFilter('all');

    let stoppedByFailure = false;
    let firstSelectedAssigned = false;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      for (let index = 0; index < selectedEntries.length; index += 1) {
        if (cancelledRef.current || stoppedByFailure) break;

        const entry = selectedEntries[index];
        const stepId = generateId();
        const badge = requestBadge(entry.request);

        setProgressText(
          iterations > 1
            ? formatMessage(runnerTexts.iterationProgress, { iteration, iterations, current: index + 1, total: selectedEntries.length, name: entry.name })
            : formatMessage(runnerTexts.progress, { current: index + 1, total: selectedEntries.length, name: entry.name })
        );

        const placeholder: RunnerStepResult = {
          id: stepId,
          iteration,
          name: entry.name,
          itemId: entry.itemId,
          method: badge.label,
          url: entry.url,
          breadcrumb: entry.breadcrumb,
          durationMs: 0,
          sizeBytes: 0,
          statusCode: null,
          statusText: runnerTexts.running,
          status: 'running',
          error: null,
          protocol: entry.protocol,
          httpResponse: null,
          grpcResponse: null,
        };

        setResults((current) => [...current, placeholder]);
        if (!firstSelectedAssigned) {
          setSelectedResultId(stepId);
          firstSelectedAssigned = true;
        }

        const outcome = await executeSingleEntry(entry, collection.id, environmentId);
        const completedStep: RunnerStepResult = {
          ...outcome,
          id: stepId,
          iteration,
        };

        setResults((current) => current.map((candidate) => (candidate.id === stepId ? completedStep : candidate)));

        if (cancelledRef.current || completedStep.status === 'cancelled') {
          break;
        }

        if (config.stopOnError && (completedStep.status === 'failed' || completedStep.status === 'error')) {
          stoppedByFailure = true;
          break;
        }

        const hasMoreSteps = index < selectedEntries.length - 1 || iteration < iterations;
        if (hasMoreSteps && delayMs > 0 && !cancelledRef.current) {
          setProgressText(formatMessage(runnerTexts.waitingDelay, { delay: delayMs }));
          await sleepInterruptible(delayMs, cancelDelayRef);
        }
      }
      if (cancelledRef.current || stoppedByFailure) break;
    }

    setRunning(false);
    setProgressText('');
  };

  const summary = useMemo(() => summarizeRunnerResults(results), [results]);

  const executedIterations = useMemo(() => {
    const unique = new Set<number>();
    results.forEach((result) => unique.add(result.iteration));
    return Array.from(unique).sort((left, right) => left - right);
  }, [results]);

  const filteredResults = useMemo(
    () =>
      results.filter((result) => {
        if (iterationFilter !== 'all' && result.iteration !== iterationFilter) return false;
        if (statusFilter === 'passed' && result.status !== 'passed') return false;
        if (statusFilter === 'failed' && result.status !== 'failed' && result.status !== 'error') return false;
        return true;
      }),
    [results, iterationFilter, statusFilter]
  );

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedResultId) ?? null,
    [results, selectedResultId]
  );

  const inspectorRuntime = useMemo(() => {
    const base = emptyRuntime();
    if (!selectedResult) return base;
    return {
      ...base,
      running: selectedResult.status === 'running',
      error: selectedResult.error,
      httpResponse: selectedResult.httpResponse,
      grpcResponse: selectedResult.grpcResponse,
    };
  }, [selectedResult]);

  const collectionOptions = collections.map((candidate) => ({
    value: String(candidate.id),
    label: candidate.name,
  }));

  const scopeOptions = [
    { value: '', label: runnerTexts.wholeCollection },
    ...folders.map((folder) => ({
      value: folder.id,
      label: `${'  '.repeat(folder.depth)}📁 ${folder.name}`,
    })),
  ];

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2.5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500">
            <Play className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">Runner</span>
        </div>
        <div className="w-48">
          <Select
            variant="navbar"
            aria-label={runnerTexts.collectionLabel}
            options={collectionOptions}
            value={collection ? String(collection.id) : ''}
            placeholder={dictionary.vulpes.cookies.selectCollection}
            noOptionsMessage={dictionary.vulpes.cookies.noCollections}
            onChange={(value) => {
              setCustomOrderIds([]);
              setRemovedIds(new Set());
              setDeselectedIds(new Set());
              setRunnerTarget(tab.id, Number(value), null);
            }}
          />
        </div>
        <div className="w-56">
          <Select
            variant="navbar"
            aria-label={runnerTexts.scopeLabel}
            options={scopeOptions}
            value={tab.folderId ?? ''}
            placeholder={runnerTexts.wholeCollection}
            onChange={(value) => {
              setCustomOrderIds([]);
              setRemovedIds(new Set());
              setDeselectedIds(new Set());
              setRunnerTarget(tab.id, collection?.id ?? null, value || null);
            }}
          />
        </div>
        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400">
          <RichMessage
            template={runnerTexts.environment}
            values={{ name: <strong className="text-gray-900 dark:text-zinc-200">{activeEnvironment?.name ?? dictionary.vulpes.navbar.noEnvironment}</strong> }}
          />
        </span>
        {paneControls && <div className="ml-auto flex items-center">{paneControls}</div>}
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-[390px] xl:w-[430px] flex-shrink-0 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-white/5 bg-gray-50/40 dark:bg-zinc-950/30">
          <div className="p-3 space-y-2.5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  {runnerTexts.iterations}
                </span>
                <input
                  min={1}
                  max={999}
                  type="number"
                  disabled={running}
                  value={config.iterations}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, iterations: Math.max(1, Number(event.target.value) || 1) }))
                  }
                  className={fieldInputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  {runnerTexts.delay}
                </span>
                <input
                  min={0}
                  max={60000}
                  step={100}
                  type="number"
                  disabled={running}
                  value={config.delayMs}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, delayMs: Math.max(0, Number(event.target.value) || 0) }))
                  }
                  className={fieldInputClass}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
              <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={running}
                  checked={config.stopOnError}
                  onChange={(event) => setConfig((current) => ({ ...current, stopOnError: event.target.checked }))}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                {runnerTexts.stopOnFailure}
              </label>
              <label
                title={runnerTexts.chainHint}
                className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  disabled={running}
                  checked={config.persistResponses}
                  onChange={(event) => setConfig((current) => ({ ...current, persistResponses: event.target.checked }))}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                {runnerTexts.chain}
              </label>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
            <button
              type="button"
              disabled={running || orderedEntries.length === 0}
              onClick={toggleSelectAll}
              title={allSelected ? runnerTexts.deselectAll : runnerTexts.selectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:text-amber-500 disabled:opacity-40"
            >
              {allSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <UncheckedIcon className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span>
                {selectedEntries.length}/{orderedEntries.length}
              </span>
            </button>
            <div className="relative flex-1 min-w-0 ml-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                placeholder={runnerTexts.filterQueue}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 pl-8 pr-2 py-1 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            {hasQueueCustomizations && (
              <button
                type="button"
                disabled={running}
                onClick={resetQueue}
                title={
                  removedIds.size > 0
                    ? formatMessage(runnerTexts.restoreRemoved, { count: removedIds.size })
                    : runnerTexts.restoreOrder
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
              >
                <RotateCcw className="w-3 h-3" />
                {removedIds.size > 0 && <span>+{removedIds.size}</span>}
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
            {orderedEntries.length === 0 && (
              <div className="py-10 px-4 text-center space-y-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  {removedIds.size > 0
                    ? runnerTexts.allRemoved
                    : runnerTexts.noRequests}
                </p>
                {removedIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={resetQueue}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {formatMessage(runnerTexts.restoreRequests, { count: removedIds.size })}
                  </button>
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    {runnerTexts.noRequestsHint}
                  </p>
                )}
              </div>
            )}
            {orderedEntries.length > 0 && visibleQueueEntries.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-500 dark:text-zinc-400">
                {runnerTexts.noSearchMatch}
              </p>
            )}
            {visibleQueueEntries.map((entry) => {
              const queueIndex = orderedEntries.findIndex((candidate) => candidate.itemId === entry.itemId);
              const checked = !deselectedIds.has(entry.itemId);
              const badge = requestBadge(entry.request);
              const isDropTarget = dropTargetIndex === queueIndex && dragIndex !== null && dragIndex !== queueIndex;

              return (
                <div
                  key={entry.itemId}
                  draggable={!running && !search.trim()}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', entry.name);
                    setDragIndex(queueIndex);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropTargetIndex(null);
                  }}
                  onDragOver={(event) => {
                    if (dragIndex === null || dragIndex === queueIndex) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    if (dropTargetIndex !== queueIndex) setDropTargetIndex(queueIndex);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex !== null && dragIndex !== queueIndex) {
                      moveEntry(dragIndex, queueIndex);
                    }
                    setDragIndex(null);
                    setDropTargetIndex(null);
                  }}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                    isDropTarget
                      ? 'border-amber-500 bg-amber-500/10'
                      : checked
                        ? 'border-gray-200/80 dark:border-white/5 bg-white dark:bg-zinc-900/90 hover:border-amber-500/40'
                        : 'border-transparent bg-gray-100/50 dark:bg-white/[0.02] opacity-55'
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 cursor-grab active:cursor-grabbing" />
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={running}
                    onChange={() => toggleEntry(entry.itemId)}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="w-4 text-[10px] font-mono text-gray-400 dark:text-zinc-500 text-right flex-shrink-0">
                    {queueIndex + 1}
                  </span>
                  <span className={`w-11 text-right text-[9px] font-extrabold tracking-wide flex-shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-gray-800 dark:text-zinc-200 truncate">{entry.name}</span>
                      {entry.breadcrumb && (
                        <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-white/5 text-[10px] text-gray-500 dark:text-zinc-400 truncate max-w-[110px]">
                          {entry.breadcrumb}
                        </span>
                      )}
                    </div>
                    {entry.url && (
                      <p className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 truncate">{entry.url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!search.trim() && (
                      <>
                        <button
                          type="button"
                          title={runnerTexts.moveUp}
                          disabled={running || queueIndex <= 0}
                          onClick={() => moveEntry(queueIndex, queueIndex - 1)}
                          className="p-1 rounded text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title={runnerTexts.moveDown}
                          disabled={running || queueIndex >= orderedEntries.length - 1}
                          onClick={() => moveEntry(queueIndex, queueIndex + 1)}
                          className="p-1 rounded text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      title={runnerTexts.openRequest}
                      onClick={() => openEntryInTab(entry.itemId)}
                      className="p-1 rounded text-gray-400 hover:text-amber-500 hover:bg-amber-500/10"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      title={runnerTexts.removeFromList}
                      onClick={() => removeEntryFromQueue(entry.itemId)}
                      className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-white/5 space-y-2 flex-shrink-0">
            {running && progressText && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span className="truncate">{progressText}</span>
              </div>
            )}
            {running ? (
              <button
                type="button"
                onClick={stopRun}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                {runnerTexts.stopRun}
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedEntries.length === 0}
                onClick={startRun}
                className={`${primaryButtonClass} w-full justify-center py-2`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {formatMessage(runnerTexts.runCount, { count: selectedEntries.length })}
                {config.iterations > 1 ? ` × ${config.iterations}` : ''}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Play className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                  {runnerTexts.readyTitle}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  <RichMessage
                    template={runnerTexts.readyHint}
                    values={{
                      run: <strong>{runnerTexts.run}</strong>,
                      reference: <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-mono text-[11px]">{'{{$response}}'}</code>,
                    }}
                  />
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex-shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 text-xs">
                  <span className="text-gray-500 dark:text-zinc-400">{runnerTexts.total}</span>
                  <span className="font-bold text-gray-900 dark:text-white">{summary.total}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{summary.passed} sucesso</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{summary.failed} falha(s)</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 text-xs">
                  <span className="text-gray-500 dark:text-zinc-400">{runnerTexts.time}</span>
                  <span className="font-mono font-semibold text-gray-800 dark:text-zinc-200">
                    {formatDuration(summary.totalDurationMs)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 text-xs">
                  <span className="text-gray-500 dark:text-zinc-400">{runnerTexts.average}</span>
                  <span className="font-mono font-semibold text-gray-800 dark:text-zinc-200">
                    {formatDuration(summary.averageDurationMs)}
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  <div className="flex items-center rounded-lg bg-gray-100 dark:bg-white/5 p-0.5 text-[11px]">
                    {(
                      [
                        ['all', runnerTexts.all],
                        ['passed', runnerTexts.passed],
                        ['failed', runnerTexts.failed],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                          statusFilter === key
                            ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-300 shadow-sm'
                            : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {!running && (
                    <button
                      type="button"
                      onClick={() => {
                        setResults([]);
                        setSelectedResultId(null);
                      }}
                      className={secondaryButtonClass}
                    >
                      {runnerTexts.clear}
                    </button>
                  )}
                </div>
              </div>

              {executedIterations.length > 1 && (
                <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-200 dark:border-white/5 overflow-x-auto flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mr-1">
                    {runnerTexts.iteration}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIterationFilter('all')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      iterationFilter === 'all'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  >
                    {formatMessage(runnerTexts.allCount, { count: results.length })}
                  </button>
                  {executedIterations.map((iteration) => (
                    <button
                      key={iteration}
                      type="button"
                      onClick={() => setIterationFilter(iteration)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        iterationFilter === iteration
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5'
                      }`}
                    >
                      #{iteration}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col xl:flex-row overflow-hidden">
                <div
                  className={`${
                    selectedResult ? 'xl:w-[44%] border-b xl:border-b-0 xl:border-r' : 'w-full'
                  } border-gray-200 dark:border-white/5 overflow-auto p-3 space-y-1.5 min-h-[180px]`}
                >
                  {filteredResults.length === 0 && (
                    <p className="py-8 text-center text-xs text-gray-500 dark:text-zinc-400">
                      {runnerTexts.noResultMatch}
                    </p>
                  )}
                  {filteredResults.map((step) => {
                    const active = step.id === selectedResultId;
                    return (
                      <div
                        key={step.id}
                        onClick={() => setSelectedResultId(step.id)}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          active
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-gray-200/80 dark:border-white/5 bg-white dark:bg-zinc-900/60 hover:bg-gray-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {step.status === 'running' && (
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
                        )}
                        {step.status === 'passed' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        )}
                        {(step.status === 'failed' || step.status === 'error') && (
                          <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        )}
                        {step.status === 'cancelled' && (
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}

                        {executedIterations.length > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-mono text-[10px] font-bold text-gray-600 dark:text-zinc-300 flex-shrink-0">
                            #{step.iteration}
                          </span>
                        )}

                        <span className="w-11 text-right text-[10px] font-extrabold text-amber-600 dark:text-amber-400 flex-shrink-0">
                          {step.method}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-gray-900 dark:text-zinc-100 truncate">
                              {step.name}
                            </span>
                            {step.breadcrumb && (
                              <span className="text-[10px] text-gray-400 dark:text-zinc-500 truncate">
                                ({step.breadcrumb})
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 truncate">
                            {step.error ?? step.url}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {step.statusCode !== null ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                step.protocol === 'http'
                                  ? statusTone(step.statusCode)
                                  : step.statusCode === 0
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {step.statusText}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                              {step.statusText}
                            </span>
                          )}
                          {step.status !== 'running' && (
                            <>
                              <span className="text-[11px] font-mono text-gray-500 dark:text-zinc-400">
                                {formatDuration(step.durationMs)}
                              </span>
                              <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500 hidden sm:inline">
                                {formatBytes(step.sizeBytes)}
                              </span>
                              <button
                                type="button"
                                title={runnerTexts.removeResult}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeResultFromList(step.id);
                                }}
                                className="p-1 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedResult && (
                  <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {selectedResult.name}
                      </span>
                      {executedIterations.length > 1 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                          {formatMessage(runnerTexts.iterationNumber, { number: selectedResult.iteration })}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500 truncate flex-1">
                        {selectedResult.url}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEntryInTab(selectedResult.itemId)}
                        className={secondaryButtonClass}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {runnerTexts.openRequest}
                      </button>
                      <button
                        type="button"
                        title={runnerTexts.closeInspection}
                        onClick={() => setSelectedResultId(null)}
                        className={iconButtonClass}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col">
                      <VariableScopeProvider
                        collectionId={collection?.id ?? null}
                        currentItemId={selectedResult.itemId}
                      >
                        {selectedResult.protocol === 'grpc' ? (
                          <GrpcResponseViewer runtime={inspectorRuntime} onCancel={stopRun} />
                        ) : (
                          <HttpResponseViewer
                            runtime={inspectorRuntime}
                            onCancel={stopRun}
                            itemId={selectedResult.itemId}
                            collectionId={collection?.id ?? null}
                          />
                        )}
                      </VariableScopeProvider>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunnerView;
