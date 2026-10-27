import { requireToken } from './ActionHelpers';
import { findItem } from '../functions/CollectionTree';
import { getToken } from '../../../contexts/AuthContext';
import { generateId } from '../functions/RequestDefaults';
import { VulpesServices } from '../services/VulpesServices';
import { isRequestTab, useVulpesStore } from '../VulpesStore';
import { CancelError, CancellablePromise } from '@wailsio/runtime';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import type { Cookie, GrpcMethod, RequestTab, CollectionItem, ExecutionInput } from '../../../interfaces/VulpesInterfaces';

const pendingCalls = new Map<string, CancellablePromise<unknown>>();

const store = () => useVulpesStore.getState();

const findTab = (tabId: string): RequestTab | undefined => {
  const tab = store().tabs.find((candidate) => candidate.id === tabId);
  return isRequestTab(tab) ? tab : undefined;
};

const applyReceivedCookies = (collectionId: number | null, cookies: Cookie[] | null | undefined) => {
  if (!collectionId || !cookies) return;
  store().applyCollectionCookies(collectionId, cookies);
  VulpesServices.announceDataChange();
};

const executionInput = (tab: RequestTab): ExecutionInput => ({
  request: tab.request,
  scope: {
    itemId: tab.itemId ?? '',
    collectionId: tab.collectionId ?? 0,
    environmentId: store().activeEnvironmentId ?? 0,
  },
});

const failureMessage = (error: unknown) => (error instanceof CancelError ? 'Requisição cancelada' : errorMessage(error));

const trackCall = async <Result>(tabId: string, call: CancellablePromise<Result>) => {
  pendingCalls.set(tabId, call);
  try {
    return await call;
  } finally {
    pendingCalls.delete(tabId);
  }
};

const isRealtimeTab = (tab: RequestTab) => tab.request.protocol !== 'http';

const listenToTab = (tabId: string) => {
  store().patchRuntime(tabId, { events: [], error: null, connection: 'connecting' });
  VulpesServices.listenRealtime(tabId, (event) => store().pushRealtimeEvent(tabId, event));
};

const failConnection = (tabId: string, error: unknown) => {
  const message = failureMessage(error);
  VulpesServices.stopRealtime(tabId);
  store().pushRealtimeEvent(tabId, {
    ackId: 0,
    event: '',
    data: message,
    kind: 'error',
    hasAck: false,
    sizeBytes: 0,
    encoding: 'text',
    direction: 'system',
    timestamp: Date.now(),
  });
  store().patchRuntime(tabId, { connection: 'idle', error: message });
};

const findGrpcMethod = (tabId: string): GrpcMethod | null => {
  const tab = findTab(tabId);
  const services = store().runtimes[tabId]?.grpcServices ?? [];
  const methodName = tab?.request.grpc?.method;
  if (!methodName) return null;
  for (const service of services) {
    const method = service.methods.find((candidate) => candidate.fullName === methodName);
    if (method) return method;
  }
  return null;
};

export const requestActions = {
  async sendHttp(tabId: string) {
    const tab = findTab(tabId);
    if (!tab || store().runtimes[tabId]?.running) return;
    store().patchRuntime(tabId, { running: true, error: null });
    try {
      const response = await trackCall(tabId, VulpesServices.sendHttpRequest(requireToken(), executionInput(tab)));
      store().patchRuntime(tabId, { running: false, httpResponse: response });
      applyReceivedCookies(tab.collectionId, response.collectionCookies);
    } catch (error) {
      store().patchRuntime(tabId, { running: false, error: failureMessage(error) });
    }
  },

  cancel(tabId: string) {
    pendingCalls.get(tabId)?.cancel();
  },

  async loadGrpcServices(tabId: string) {
    const tab = findTab(tabId);
    if (!tab) return null;
    store().patchRuntime(tabId, { running: true, error: null });
    try {
      const services = await VulpesServices.listGrpcServices(requireToken(), executionInput(tab));
      store().patchRuntime(tabId, { running: false, grpcServices: services });
      return services;
    } catch (error) {
      store().patchRuntime(tabId, { running: false, error: failureMessage(error) });
      return null;
    }
  },

  async runGrpc(tabId: string) {
    if (!findGrpcMethod(tabId) && !(await requestActions.loadGrpcServices(tabId))) return;
    const method = findGrpcMethod(tabId);
    if (!method) {
      store().patchRuntime(tabId, { error: 'Selecione um método disponível no servidor' });
      return;
    }
    if (method.clientStreaming || method.serverStreaming) {
      await requestActions.startGrpcStream(tabId);
      return;
    }
    const tab = findTab(tabId);
    if (!tab) return;
    store().patchRuntime(tabId, { running: true, error: null });
    try {
      const response = await trackCall(tabId, VulpesServices.invokeGrpc(requireToken(), executionInput(tab)));
      store().patchRuntime(tabId, { running: false, grpcResponse: response });
    } catch (error) {
      store().patchRuntime(tabId, { running: false, error: failureMessage(error) });
    }
  },

  async startGrpcStream(tabId: string) {
    const tab = findTab(tabId);
    if (!tab) return;
    listenToTab(tabId);
    store().patchRuntime(tabId, { grpcResponse: null });
    try {
      await VulpesServices.startGrpcStream(requireToken(), tabId, executionInput(tab));
    } catch (error) {
      failConnection(tabId, error);
    }
  },

  async sendGrpcMessage(tabId: string, message: string) {
    try {
      await VulpesServices.sendGrpcStreamMessage(requireToken(), tabId, message);
      store().patchRuntime(tabId, { error: null });
    } catch (error) {
      store().patchRuntime(tabId, { error: failureMessage(error) });
    }
  },

  async endGrpcStream(tabId: string) {
    try {
      await VulpesServices.endGrpcStream(requireToken(), tabId);
    } catch (error) {
      store().patchRuntime(tabId, { error: failureMessage(error) });
    }
  },

  async connect(tabId: string) {
    const tab = findTab(tabId);
    if (!tab) return;
    listenToTab(tabId);
    try {
      const result =
        tab.request.protocol === 'socketio'
          ? await VulpesServices.connectSocketIo(requireToken(), tabId, executionInput(tab))
          : await VulpesServices.connectWebSocket(requireToken(), tabId, executionInput(tab));
      applyReceivedCookies(tab.collectionId, result?.collectionCookies);
    } catch (error) {
      failConnection(tabId, error);
    }
  },

  async disconnect(tabId: string) {
    try {
      await VulpesServices.closeSession(requireToken(), tabId);
    } catch (error) {
      store().patchRuntime(tabId, { error: failureMessage(error) });
    }
  },

  async sendWebSocketMessage(tabId: string) {
    const webSocket = findTab(tabId)?.request.webSocket;
    if (!webSocket) return;
    try {
      await VulpesServices.sendWebSocketMessage(requireToken(), tabId, webSocket.message, webSocket.messageKind);
      store().patchRuntime(tabId, { error: null });
    } catch (error) {
      store().patchRuntime(tabId, { error: failureMessage(error) });
    }
  },

  async emitSocketIo(tabId: string) {
    const socketIo = findTab(tabId)?.request.socketIo;
    if (!socketIo) return;
    try {
      await VulpesServices.emitSocketIo(requireToken(), tabId, socketIo.event, socketIo.arguments, socketIo.withAck);
      store().patchRuntime(tabId, { error: null });
    } catch (error) {
      store().patchRuntime(tabId, { error: failureMessage(error) });
    }
  },

  async save(tabId: string): Promise<'saved' | 'needs-location'> {
    const tab = findTab(tabId);
    if (!tab) return 'saved';
    const collection = store().collections.find((candidate) => candidate.id === tab.collectionId);
    const existing = tab.itemId && collection ? findItem(collection.items, tab.itemId) : null;
    if (!collection || !existing) return 'needs-location';

    const updated = await VulpesServices.saveItem(requireToken(), collection.id, { ...existing, name: tab.name, request: tab.request });
    store().upsertCollection(updated);
    store().renameTabs(existing.id, tab.name);
    store().markSaved(tabId, { name: tab.name, itemId: existing.id, collectionId: collection.id }, tab.request);
    return 'saved';
  },

  async saveAs(tabId: string, collectionId: number, parentId: string, name: string) {
    const tab = findTab(tabId);
    if (!tab) return;
    const item: CollectionItem = {
      id: generateId(),
      kind: 'request',
      name,
      scripts: [],
      children: [],
      description: '',
      request: tab.request,
    };
    const result = await VulpesServices.createItem(requireToken(), collectionId, parentId, item);
    store().upsertCollection(result.collection);
    store().renameTab(tabId, name);
    store().markSaved(tabId, { name, itemId: result.itemId, collectionId }, tab.request);
  },

  releaseTab(tabId: string) {
    const tab = findTab(tabId);
    requestActions.cancel(tabId);
    VulpesServices.stopRealtime(tabId);
    const token = getToken();
    if (token && tab && isRealtimeTab(tab)) VulpesServices.closeSession(token, tabId).catch(() => undefined);
  },

  releaseAll(token: string) {
    pendingCalls.forEach((call) => call.cancel());
    pendingCalls.clear();
    VulpesServices.stopAllRealtime();
    return VulpesServices.closeAllSessions(token);
  },
};
