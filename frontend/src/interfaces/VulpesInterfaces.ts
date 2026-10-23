export type ItemKind = 'folder' | 'request';

export type FormFieldKind = 'text' | 'file';

export type ApiKeyLocation = 'header' | 'query';

export type SocketIoVersion = 'v2' | 'v3' | 'v4';

export type BodyEncoding = 'text' | 'base64';

export type DescriptorSource = 'reflection' | 'proto';

export type WebSocketMessageKind = 'text' | 'json' | 'binary';

export type VulpesProtocol = 'http' | 'grpc' | 'websocket' | 'socketio';

export type RealtimeDirection = 'incoming' | 'outgoing' | 'system';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed';

export type AuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'apikey';

export type RawLanguage = 'json' | 'text' | 'xml' | 'html' | 'javascript';

export type BodyMode = 'none' | 'raw' | 'urlencoded' | 'formdata' | 'binary' | 'graphql';

export type RealtimeKind = 'connecting' | 'connected' | 'message' | 'metadata' | 'ack' | 'error' | 'closed';

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
  description: string;
}

export interface Variable {
  key: string;
  value: string;
  secret: boolean;
  enabled: boolean;
}

export interface FormField {
  key: string;
  value: string;
  enabled: boolean;
  filePath: string;
  kind: FormFieldKind;
  contentType: string;
}

export interface Auth {
  key: string;
  type: AuthType;
  token: string;
  value: string;
  location: string;
  username: string;
  password: string;
}

export interface HttpBody {
  raw: string;
  mode: BodyMode;
  binaryPath: string;
  language: RawLanguage;
  formData: FormField[];
  urlEncoded: KeyValue[];
  graphqlQuery: string;
  graphqlVariables: string;
}

export interface HttpSettings {
  timeoutMs: number;
  skipTlsVerify: boolean;
  disableRedirects: boolean;
}

export interface HttpRequest {
  url: string;
  body: HttpBody;
  method: string;
  params: KeyValue[];
  headers: KeyValue[];
  settings: HttpSettings;
  pathVariables: KeyValue[];
}

export interface GrpcRequest {
  url: string;
  method: string;
  useTls: boolean;
  message: string;
  timeoutMs: number;
  metadata: KeyValue[];
  protoFiles: string[];
  importPaths: string[];
  skipTlsVerify: boolean;
  descriptorSource: DescriptorSource;
}

export interface WebSocketRequest {
  url: string;
  message: string;
  params: KeyValue[];
  headers: KeyValue[];
  subprotocols: string[];
  skipTlsVerify: boolean;
  messageKind: WebSocketMessageKind;
}

export interface SocketIoRequest {
  url: string;
  path: string;
  event: string;
  withAck: boolean;
  params: KeyValue[];
  headers: KeyValue[];
  namespace: string;
  arguments: string[];
  version: SocketIoVersion;
  handshakeAuth: string;
  skipTlsVerify: boolean;
}

export interface VulpesRequest {
  auth: Auth;
  protocol: VulpesProtocol;
  http?: HttpRequest | null;
  grpc?: GrpcRequest | null;
  socketIo?: SocketIoRequest | null;
  webSocket?: WebSocketRequest | null;
}

export interface Script {
  listen: string;
  source: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  kind: ItemKind;
  scripts: Script[];
  auth?: Auth | null;
  description: string;
  children: CollectionItem[];
  request?: VulpesRequest | null;
}

export interface Collection {
  id: number;
  auth: Auth;
  name: string;
  scripts: Script[];
  description: string;
  variables: Variable[];
  items: CollectionItem[];
}

export interface CollectionInput {
  auth: Auth;
  name: string;
  description: string;
  variables: Variable[];
}

export interface ItemMutationResult {
  itemId: string;
  collection: Collection;
}

export interface MoveItemInput {
  itemId: string;
  targetIndex: number;
  collectionId: number;
  targetParentId: string;
  targetCollectionId: number;
}

export interface Environment {
  id: number;
  name: string;
  variables: Variable[];
}

export interface EnvironmentInput {
  name: string;
  variables: Variable[];
}

export interface ImportResult {
  warnings: string[];
  collections: Collection[];
  environments: Environment[];
}

export interface ExecutionScope {
  itemId: string;
  collectionId: number;
  environmentId: number;
}

export interface ExecutionInput {
  scope: ExecutionScope;
  request: VulpesRequest;
}

export interface HeaderEntry {
  key: string;
  value: string;
}

export interface ResponseCookie {
  name: string;
  path: string;
  value: string;
  domain: string;
  secure: boolean;
  expires: string;
  httpOnly: boolean;
  sameSite: string;
}

export interface ResponseTimings {
  dnsMs: number;
  tlsMs: number;
  waitMs: number;
  totalMs: number;
  connectMs: number;
  downloadMs: number;
}

export interface HttpResponse {
  url: string;
  body: string;
  status: string;
  method: string;
  protocol: string;
  sizeBytes: number;
  truncated: boolean;
  statusCode: number;
  contentType: string;
  headers: HeaderEntry[];
  timings: ResponseTimings;
  cookies: ResponseCookie[];
  bodyEncoding: BodyEncoding;
  requestHeaders: HeaderEntry[];
}

export interface GrpcMethod {
  name: string;
  fullName: string;
  inputType: string;
  outputType: string;
  exampleMessage: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
}

export interface GrpcService {
  name: string;
  methods: GrpcMethod[];
}

export interface GrpcResponse {
  code: string;
  message: string;
  statusCode: number;
  durationMs: number;
  headers: HeaderEntry[];
  statusMessage: string;
  trailers: HeaderEntry[];
}

export interface RealtimeEvent {
  data: string;
  ackId: number;
  event: string;
  hasAck: boolean;
  kind: RealtimeKind;
  sizeBytes: number;
  timestamp: number;
  encoding: BodyEncoding;
  direction: RealtimeDirection;
}

export interface LoggedRealtimeEvent extends RealtimeEvent {
  sequence: number;
}

export interface RequestTab {
  id: string;
  name: string;
  dirty: boolean;
  itemId: string | null;
  request: VulpesRequest;
  collectionId: number | null;
}

export interface TabRuntime {
  running: boolean;
  error: string | null;
  connection: ConnectionStatus;
  events: LoggedRealtimeEvent[];
  httpResponse: HttpResponse | null;
  grpcResponse: GrpcResponse | null;
  grpcServices: GrpcService[] | null;
}
