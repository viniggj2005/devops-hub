import type { Auth, AuthType, KeyValue, FormField, VulpesRequest, VulpesProtocol } from '../../../interfaces/VulpesInterfaces';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const PROTOCOLS: VulpesProtocol[] = ['http', 'grpc', 'websocket', 'socketio'];

export const authLabels: Record<AuthType, string> = {
  apikey: 'API Key',
  basic: 'Basic Auth',
  bearer: 'Bearer Token',
  none: 'Sem autenticação',
  inherit: 'Herdar do pai',
};

export const protocolLabels: Record<VulpesProtocol, string> = {
  http: 'HTTP',
  grpc: 'gRPC',
  socketio: 'Socket.IO',
  websocket: 'WebSocket',
};

const methodColors: Record<string, string> = {
  PUT: 'text-blue-600 dark:text-blue-400',
  HEAD: 'text-cyan-600 dark:text-cyan-400',
  POST: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-rose-600 dark:text-rose-400',
  GET: 'text-emerald-600 dark:text-emerald-400',
  PATCH: 'text-purple-600 dark:text-purple-400',
};

const protocolBadgeColors: Record<Exclude<VulpesProtocol, 'http'>, { label: string; className: string }> = {
  grpc: { label: 'gRPC', className: 'text-teal-600 dark:text-teal-400' },
  websocket: { label: 'WS', className: 'text-sky-600 dark:text-sky-400' },
  socketio: { label: 'SIO', className: 'text-fuchsia-600 dark:text-fuchsia-400' },
};

export const methodColor = (method: string) => methodColors[method.toUpperCase()] ?? 'text-zinc-500 dark:text-zinc-400';

export const requestBadge = (request?: VulpesRequest | null) => {
  if (!request || request.protocol === 'http') {
    const method = request?.http?.method ?? 'GET';
    return { label: method.length > 6 ? method.slice(0, 5) : method, className: methodColor(method) };
  }
  return protocolBadgeColors[request.protocol];
};

export const emptyKeyValue = (): KeyValue => ({ key: '', value: '', enabled: true, description: '' });

export const emptyFormField = (): FormField => ({
  key: '',
  value: '',
  kind: 'text',
  enabled: true,
  filePath: '',
  contentType: '',
});

export const emptyAuth = (type: AuthType): Auth => ({
  key: '',
  type,
  token: '',
  value: '',
  username: '',
  password: '',
  location: 'header',
});

export const createRequest = (protocol: VulpesProtocol): VulpesRequest => {
  const auth = emptyAuth('inherit');
  switch (protocol) {
    case 'grpc':
      return {
        auth,
        protocol,
        grpc: {
          url: '',
          method: '',
          useTls: false,
          message: '{}',
          timeoutMs: 0,
          metadata: [],
          protoFiles: [],
          importPaths: [],
          skipTlsVerify: false,
          descriptorSource: 'reflection',
        },
      };
    case 'websocket':
      return {
        auth,
        protocol,
        webSocket: { url: '', message: '', params: [], headers: [], subprotocols: [], skipTlsVerify: false, messageKind: 'text' },
      };
    case 'socketio':
      return {
        auth,
        protocol,
        socketIo: {
          url: '',
          path: '/socket.io/',
          event: 'message',
          withAck: false,
          params: [],
          headers: [],
          version: 'v4',
          namespace: '',
          arguments: [''],
          handshakeAuth: '',
          skipTlsVerify: false,
        },
      };
    default:
      return {
        auth,
        protocol: 'http',
        http: {
          url: '',
          method: 'GET',
          params: [],
          headers: [],
          pathVariables: [],
          settings: { timeoutMs: 0, skipTlsVerify: false, disableRedirects: false },
          body: {
            raw: '',
            mode: 'none',
            formData: [],
            binaryPath: '',
            urlEncoded: [],
            language: 'json',
            graphqlQuery: '',
            graphqlVariables: '',
          },
        },
      };
  }
};

export const cloneRequest = (request: VulpesRequest): VulpesRequest => structuredClone(request);

export const requestUrl = (request?: VulpesRequest | null) =>
  request?.http?.url ?? request?.grpc?.url ?? request?.webSocket?.url ?? request?.socketIo?.url ?? '';

export const generateId = () => crypto.randomUUID();
