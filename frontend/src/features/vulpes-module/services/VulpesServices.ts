import { CancellablePromise, Events } from '@wailsio/runtime';
import { windowInstanceId } from '../../appFrame/WindowContext';
import * as CollectionsApi from '../../../../bindings/docker-manager-go/src/vulpes/handlers/vulpeshandlerstruct';
import * as ClientApi from '../../../../bindings/docker-manager-go/src/vulpes/handlers/vulpesclienthandlerstruct';
import type {
  Cookie,
  Collection,
  Environment,
  GrpcService,
  ExportFormat,
  ExportResult,
  GrpcResponse,
  HttpResponse,
  ImportResult,
  MoveItemInput,
  RealtimeEvent,
  CollectionItem,
  ExecutionInput,
  CollectionInput,
  ConnectionResult,
  EnvironmentInput,
  ItemMutationResult,
} from '../../../interfaces/VulpesInterfaces';

export const vulpesDataChangedEvent = 'vulpes:data-changed';

const realtimeEventPrefix = 'vulpes:realtime:';

const realtimeSubscriptions = new Map<string, () => void>();

const notifyDataChanged = () => Events.Emit(vulpesDataChangedEvent, windowInstanceId);

const withNotification = async <Result>(operation: Promise<Result>) => {
  const result = await operation;
  notifyDataChanged();
  return result;
};

export const VulpesServices = {
  announceDataChange: notifyDataChanged,

  async findAllCollections(token: string): Promise<Collection[]> {
    return ((await CollectionsApi.FindAllCollections(token)) ?? []) as Collection[];
  },

  createCollection(token: string, input: CollectionInput) {
    return withNotification(CollectionsApi.CreateCollection(token, input) as Promise<Collection>);
  },

  updateCollection(token: string, collectionId: number, input: CollectionInput) {
    return withNotification(CollectionsApi.UpdateCollection(token, collectionId, input) as Promise<Collection>);
  },

  deleteCollection(token: string, collectionId: number) {
    return withNotification(CollectionsApi.DeleteCollection(token, collectionId));
  },

  saveCollectionCookies(token: string, collectionId: number, cookies: Cookie[]) {
    return withNotification(CollectionsApi.SaveCollectionCookies(token, collectionId, cookies) as Promise<Collection>);
  },

  createItem(token: string, collectionId: number, parentId: string, item: CollectionItem) {
    return withNotification(CollectionsApi.CreateItem(token, collectionId, parentId, item) as Promise<ItemMutationResult>);
  },

  saveItem(token: string, collectionId: number, item: CollectionItem) {
    return withNotification(CollectionsApi.SaveItem(token, collectionId, item) as Promise<Collection>);
  },

  deleteItem(token: string, collectionId: number, itemId: string) {
    return withNotification(CollectionsApi.DeleteItem(token, collectionId, itemId) as Promise<Collection>);
  },

  duplicateItem(token: string, collectionId: number, itemId: string) {
    return withNotification(CollectionsApi.DuplicateItem(token, collectionId, itemId) as Promise<ItemMutationResult>);
  },

  moveItem(token: string, input: MoveItemInput) {
    return withNotification(CollectionsApi.MoveItem(token, input) as Promise<Collection[]>);
  },

  async findAllEnvironments(token: string): Promise<Environment[]> {
    return ((await CollectionsApi.FindAllEnvironments(token)) ?? []) as Environment[];
  },

  createEnvironment(token: string, input: EnvironmentInput) {
    return withNotification(CollectionsApi.CreateEnvironment(token, input) as Promise<Environment>);
  },

  updateEnvironment(token: string, environmentId: number, input: EnvironmentInput) {
    return withNotification(CollectionsApi.UpdateEnvironment(token, environmentId, input) as Promise<Environment>);
  },

  deleteEnvironment(token: string, environmentId: number) {
    return withNotification(CollectionsApi.DeleteEnvironment(token, environmentId));
  },

  async importFromFiles(token: string): Promise<ImportResult> {
    const result = (await CollectionsApi.ImportFromFiles(token)) as ImportResult;
    if (result.collections.length || result.environments.length) notifyDataChanged();
    return result;
  },

  importFromText(token: string, content: string) {
    return withNotification(CollectionsApi.ImportFromText(token, content) as Promise<ImportResult>);
  },

  exportCollection(token: string, collectionId: number, format: ExportFormat) {
    return CollectionsApi.ExportCollection(token, collectionId, format) as Promise<ExportResult>;
  },

  exportEnvironment(token: string, environmentId: number, format: ExportFormat) {
    return CollectionsApi.ExportEnvironment(token, environmentId, format) as Promise<ExportResult>;
  },

  sendHttpRequest(token: string, input: ExecutionInput) {
    return ClientApi.SendHttpRequest(token, input) as CancellablePromise<HttpResponse>;
  },

  async listGrpcServices(token: string, input: ExecutionInput): Promise<GrpcService[]> {
    return ((await ClientApi.ListGrpcServices(token, input)) ?? []) as GrpcService[];
  },

  invokeGrpc(token: string, input: ExecutionInput) {
    return ClientApi.InvokeGrpc(token, input) as CancellablePromise<GrpcResponse>;
  },

  startGrpcStream(token: string, sessionId: string, input: ExecutionInput) {
    return ClientApi.StartGrpcStream(token, sessionId, input);
  },

  sendGrpcStreamMessage(token: string, sessionId: string, message: string) {
    return ClientApi.SendGrpcStreamMessage(token, sessionId, message);
  },

  endGrpcStream(token: string, sessionId: string) {
    return ClientApi.EndGrpcStream(token, sessionId);
  },

  connectWebSocket(token: string, sessionId: string, input: ExecutionInput) {
    return ClientApi.ConnectWebSocket(token, sessionId, input) as Promise<ConnectionResult | null>;
  },

  sendWebSocketMessage(token: string, sessionId: string, data: string, kind: string) {
    return ClientApi.SendWebSocketMessage(token, sessionId, { data, kind });
  },

  connectSocketIo(token: string, sessionId: string, input: ExecutionInput) {
    return ClientApi.ConnectSocketIo(token, sessionId, input) as Promise<ConnectionResult | null>;
  },

  emitSocketIo(token: string, sessionId: string, event: string, eventArguments: string[], withAck: boolean) {
    return ClientApi.EmitSocketIo(token, sessionId, { event, withAck, arguments: eventArguments });
  },

  closeSession(token: string, sessionId: string) {
    return ClientApi.CloseSession(token, sessionId);
  },

  closeAllSessions(token: string) {
    return ClientApi.CloseAllSessions(token);
  },

  chooseRequestFile(token: string) {
    return ClientApi.ChooseRequestFile(token);
  },

  async chooseProtoFiles(token: string): Promise<string[]> {
    return (await ClientApi.ChooseProtoFiles(token)) ?? [];
  },

  chooseImportPath(token: string) {
    return ClientApi.ChooseImportPath(token);
  },

  saveResponseBody(token: string, fileName: string, body: string, encoding: string) {
    return ClientApi.SaveResponseBody(token, fileName, body, encoding);
  },

  listenRealtime(sessionId: string, onEvent: (event: RealtimeEvent) => void) {
    VulpesServices.stopRealtime(sessionId);
    const unsubscribe = Events.On(`${realtimeEventPrefix}${sessionId}`, ({ data }) => onEvent(data as RealtimeEvent));
    realtimeSubscriptions.set(sessionId, unsubscribe);
  },

  stopRealtime(sessionId: string) {
    realtimeSubscriptions.get(sessionId)?.();
    realtimeSubscriptions.delete(sessionId);
  },

  stopAllRealtime() {
    realtimeSubscriptions.forEach((unsubscribe) => unsubscribe());
    realtimeSubscriptions.clear();
  },
};
