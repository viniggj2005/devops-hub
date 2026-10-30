import type { HttpResponse } from '../../../interfaces/VulpesInterfaces';

export type ResponseFieldKind = 'url' | 'raw' | 'body' | 'header';

export type ResponseTriggerKind = 'never' | 'always' | 'no-history' | 'when-expired';

export interface ParsedResponseTag {
  filter: string;
  valid: boolean;
  error?: string;
  maxAgeSeconds: number;
  field: ResponseFieldKind;
  requestReference: string;
  trigger: ResponseTriggerKind;
}

export interface DiscoveredJsonPath {
  path: string;
  type: string;
  value: string;
  preview: string;
}

const encodedFilterSuffix = '::46b';
const encodedFilterPrefix = 'b64::';
const validFields = new Set<ResponseFieldKind>(['url', 'raw', 'body', 'header']);
const validTriggers = new Set<ResponseTriggerKind>(['never', 'always', 'no-history', 'when-expired']);
const simpleIdentifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const responseFieldOptions: { value: ResponseFieldKind; label: string; description: string }[] = [
  { value: 'url', label: 'URL final', description: 'Usa a URL final da resposta (após redirecionamentos)' },
  { value: 'raw', label: 'Corpo inteiro', description: 'Usa o texto completo do corpo da resposta sem filtro' },
  { value: 'header', label: 'Header', description: 'Extrai o valor de um cabeçalho HTTP da resposta (ex: Authorization)' },
  { value: 'body', label: 'Corpo (JSONPath)', description: 'Extrai um campo do JSON da resposta usando JSONPath (ex: $.data.token)' },
];

export const responseTriggerOptions: { value: ResponseTriggerKind; label: string; description: string }[] = [
  { value: 'no-history', label: 'Apenas se não houver histórico', description: 'Envia a requisição de origem somente na primeira vez' },
  { value: 'always', label: 'Sempre reenviar antes', description: 'Executa a requisição de origem toda vez antes de enviar esta requisição' },
  { value: 'when-expired', label: 'Reenviar quando expirar', description: 'Reenvia a requisição de origem automaticamente se a resposta tiver mais de X segundos' },
  { value: 'never', label: 'Usar última resposta (enviar se não houver)', description: 'Reutiliza a resposta em memória; envia a requisição de origem apenas se ainda não houver resposta' },
];

const decodeBase64Utf8 = (encoded: string): string | null => {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

const encodeBase64Utf8 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export const decodeResponseFilter = (filter: string): string => {
  if (!filter.startsWith(encodedFilterPrefix)) return filter;
  const trimmed = filter.endsWith(encodedFilterSuffix)
    ? filter.slice(encodedFilterPrefix.length, -encodedFilterSuffix.length)
    : filter.slice(encodedFilterPrefix.length);
  return decodeBase64Utf8(trimmed) ?? filter;
};

const quoteTagArgument = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export const parseTagArguments = (text: string): string[] => {
  let quote = '';
  let current = '';
  let hasValue = false;
  const parsedArguments: string[] = [];

  for (let position = 0; position < text.length; position++) {
    const character = text[position];
    if (quote && character === '\\' && position + 1 < text.length) {
      position++;
      current += text[position];
    } else if (quote && character === quote) {
      quote = '';
    } else if (quote) {
      current += character;
    } else if (character === "'" || character === '"') {
      quote = character;
      hasValue = true;
    } else if (character === ',') {
      parsedArguments.push(current);
      current = '';
      hasValue = false;
    } else if (!/\s/.test(character)) {
      current += character;
      hasValue = true;
    }
  }
  if (hasValue || parsedArguments.length > 0) {
    parsedArguments.push(current);
  }
  return parsedArguments;
};

export const parseResponseTag = (expression: string): ParsedResponseTag => {
  const normalized = expression.trim().replace(/^\{\{|\}\}$/g, '').trim();
  const remainder = normalized.startsWith('$response') ? normalized.slice('$response'.length) : normalized;
  const parsedArguments = parseTagArguments(remainder);
  const argumentAt = (position: number, fallback: string) => {
    const candidate = parsedArguments[position]?.trim() ?? '';
    return candidate || fallback;
  };

  const rawField = argumentAt(0, 'body').toLowerCase();
  const requestReference = argumentAt(1, '');
  const filter = decodeResponseFilter(argumentAt(2, ''));
  const rawTrigger = argumentAt(3, 'never').toLowerCase();
  const rawMaxAge = argumentAt(4, '60');
  const parsedMaxAge = Number(rawMaxAge);

  const field: ResponseFieldKind = validFields.has(rawField as ResponseFieldKind) ? (rawField as ResponseFieldKind) : 'body';
  const trigger: ResponseTriggerKind = validTriggers.has(rawTrigger as ResponseTriggerKind) ? (rawTrigger as ResponseTriggerKind) : 'never';
  const maxAgeSeconds = Number.isFinite(parsedMaxAge) && parsedMaxAge >= 0 ? parsedMaxAge : 60;

  if (!requestReference) {
    return { field, filter, trigger, maxAgeSeconds, requestReference, valid: false, error: 'Informe a requisição de origem' };
  }
  if (!validFields.has(rawField as ResponseFieldKind)) {
    return { field, filter, trigger, maxAgeSeconds, requestReference, valid: false, error: `Atributo "${rawField}" inválido (use body, header, raw ou url)` };
  }
  if (!validTriggers.has(rawTrigger as ResponseTriggerKind)) {
    return { field, filter, trigger, maxAgeSeconds, requestReference, valid: false, error: `Reenvio "${rawTrigger}" inválido` };
  }
  if (field === 'header' && !filter.trim()) {
    return { field, filter, trigger, maxAgeSeconds, requestReference, valid: false, error: 'Informe o nome do header da resposta' };
  }
  if (field === 'body' && filter.trim() && !filter.trim().startsWith('$')) {
    return { field, filter, trigger, maxAgeSeconds, requestReference, valid: false, error: 'O filtro do body deve ser um JSONPath começando com $ (ex: $.token)' };
  }
  if (argumentAt(4, '') !== '' && (!Number.isFinite(parsedMaxAge) || parsedMaxAge < 0)) {
    return { field, filter, trigger, maxAgeSeconds, requestReference, valid: false, error: 'A validade em segundos deve ser um número positivo' };
  }

  return { field, filter, trigger, maxAgeSeconds, requestReference, valid: true };
};

export const buildResponseTag = (
  config: {
    filter?: string;
    field?: ResponseFieldKind;
    requestReference: string;
    maxAgeSeconds?: number;
    trigger?: ResponseTriggerKind;
  },
  wrapBraces = true
): string => {
  const field = config.field ?? 'body';
  const trigger = config.trigger ?? 'never';
  const rawFilter = field === 'raw' || field === 'url' ? '' : (config.filter ?? '');
  const encodedFilter =
    rawFilter && /['"\\{}]/.test(rawFilter)
      ? `${encodedFilterPrefix}${encodeBase64Utf8(rawFilter)}${encodedFilterSuffix}`
      : rawFilter;

  const parts = [
    quoteTagArgument(field),
    quoteTagArgument(config.requestReference),
    quoteTagArgument(encodedFilter),
    quoteTagArgument(trigger),
  ];

  if (trigger === 'when-expired' || (config.maxAgeSeconds && config.maxAgeSeconds > 0 && trigger !== 'never')) {
    parts.push(String(config.maxAgeSeconds ?? 60));
  }

  const inner = `$response ${parts.join(', ')}`;
  return wrapBraces ? `{{${inner}}}` : inner;
};

const formatChildPath = (parentPath: string, propertyKey: string) =>
  simpleIdentifierPattern.test(propertyKey)
    ? `${parentPath}.${propertyKey}`
    : `${parentPath}['${propertyKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;

const stringifyScalar = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const summarizePreview = (value: string, maxLength = 56): string => {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}…` : singleLine;
};

export const discoverJsonPaths = (rawBody: string, maxPaths = 80): DiscoveredJsonPath[] => {
  if (!rawBody || !rawBody.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return [];
  }

  const results: DiscoveredJsonPath[] = [];
  const queue: { path: string; node: unknown; depth: number }[] = [{ path: '$', node: parsed, depth: 0 }];

  while (queue.length > 0 && results.length < maxPaths) {
    const current = queue.shift()!;
    const { path, node, depth } = current;

    if (node !== null && node !== undefined && typeof node !== 'object') {
      if (path !== '$') {
        const textValue = stringifyScalar(node);
        results.push({
          path,
          value: textValue,
          type: typeof node,
          preview: typeof node === 'string' ? `"${summarizePreview(textValue)}"` : summarizePreview(textValue),
        });
      }
      continue;
    }

    if (depth > 6 || node === null || node === undefined) continue;

    if (Array.isArray(node)) {
      if (path !== '$' && node.length > 0 && typeof node[0] !== 'object') {
        const textValue = stringifyScalar(node[0]);
        results.push({
          path: `${path}[0]`,
          value: textValue,
          type: typeof node[0],
          preview: typeof node[0] === 'string' ? `"${summarizePreview(textValue)}"` : summarizePreview(textValue),
        });
        continue;
      }
      const sampleCount = Math.min(node.length, 3);
      for (let index = 0; index < sampleCount; index++) {
        queue.push({ path: `${path}[${index}]`, node: node[index], depth: depth + 1 });
      }
      continue;
    }

    const entries = Object.entries(node as Record<string, unknown>);
    for (const [propertyKey, propertyValue] of entries) {
      const nextPath = formatChildPath(path, propertyKey);
      if (propertyValue !== null && propertyValue !== undefined && typeof propertyValue !== 'object') {
        const textValue = stringifyScalar(propertyValue);
        results.push({
          path: nextPath,
          value: textValue,
          type: typeof propertyValue,
          preview: typeof propertyValue === 'string' ? `"${summarizePreview(textValue)}"` : summarizePreview(textValue),
        });
        if (results.length >= maxPaths) break;
      } else {
        queue.push({ path: nextPath, node: propertyValue, depth: depth + 1 });
      }
    }
  }

  return results;
};

type PathStep =
  | { kind: 'key'; key: string }
  | { kind: 'index'; index: number }
  | { kind: 'wildcard' }
  | { kind: 'recursive'; key: string };

const parseJsonPathSteps = (expression: string): PathStep[] | null => {
  const trimmed = expression.trim();
  if (!trimmed.startsWith('$')) return null;
  const steps: PathStep[] = [];
  let cursor = 1;

  while (cursor < trimmed.length) {
    if (trimmed.startsWith('..', cursor)) {
      cursor += 2;
      const match = /^[A-Za-z0-9_$-]+/.exec(trimmed.slice(cursor));
      if (!match) return null;
      steps.push({ kind: 'recursive', key: match[0] });
      cursor += match[0].length;
      continue;
    }
    if (trimmed[cursor] === '.') {
      cursor++;
      if (trimmed[cursor] === '*') {
        steps.push({ kind: 'wildcard' });
        cursor++;
        continue;
      }
      const match = /^[A-Za-z0-9_$-]+/.exec(trimmed.slice(cursor));
      if (!match) return null;
      steps.push({ kind: 'key', key: match[0] });
      cursor += match[0].length;
      continue;
    }
    if (trimmed[cursor] === '[') {
      cursor++;
      while (cursor < trimmed.length && /\s/.test(trimmed[cursor])) cursor++;
      if (trimmed[cursor] === '*') {
        cursor++;
        while (cursor < trimmed.length && /\s/.test(trimmed[cursor])) cursor++;
        if (trimmed[cursor] !== ']') return null;
        cursor++;
        steps.push({ kind: 'wildcard' });
        continue;
      }
      if (trimmed[cursor] === "'" || trimmed[cursor] === '"') {
        const quote = trimmed[cursor];
        cursor++;
        let key = '';
        while (cursor < trimmed.length && trimmed[cursor] !== quote) {
          if (trimmed[cursor] === '\\' && cursor + 1 < trimmed.length) {
            cursor++;
          }
          key += trimmed[cursor];
          cursor++;
        }
        if (trimmed[cursor] !== quote) return null;
        cursor++;
        while (cursor < trimmed.length && /\s/.test(trimmed[cursor])) cursor++;
        if (trimmed[cursor] !== ']') return null;
        cursor++;
        steps.push({ kind: 'key', key });
        continue;
      }
      const indexMatch = /^-?\d+/.exec(trimmed.slice(cursor));
      if (!indexMatch) return null;
      const parsedIndex = Number(indexMatch[0]);
      cursor += indexMatch[0].length;
      while (cursor < trimmed.length && /\s/.test(trimmed[cursor])) cursor++;
      if (trimmed[cursor] !== ']') return null;
      cursor++;
      steps.push({ kind: 'index', index: parsedIndex });
      continue;
    }
    return null;
  }

  return steps;
};

const collectRecursiveKey = (node: unknown, targetKey: string, found: unknown[] = []): unknown[] => {
  if (node === null || node === undefined || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    node.forEach((child) => collectRecursiveKey(child, targetKey, found));
    return found;
  }
  const record = node as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, targetKey)) {
    found.push(record[targetKey]);
  }
  Object.values(record).forEach((child) => collectRecursiveKey(child, targetKey, found));
  return found;
};

export const evaluateJsonPath = (rawBody: string, pathExpression: string): { ok: boolean; value: string } => {
  let root: unknown;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return { ok: false, value: 'O corpo da resposta não é um JSON válido' };
  }

  const steps = parseJsonPathSteps(pathExpression);
  if (!steps) return { ok: false, value: 'JSONPath inválido (ex: $.data.token)' };

  let candidates: unknown[] = [root];
  for (const step of steps) {
    const nextCandidates: unknown[] = [];
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined || typeof candidate !== 'object') continue;
      if (step.kind === 'key' && !Array.isArray(candidate)) {
        const record = candidate as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(record, step.key)) nextCandidates.push(record[step.key]);
      } else if (step.kind === 'index' && Array.isArray(candidate)) {
        const normalizedIndex = step.index < 0 ? candidate.length + step.index : step.index;
        if (normalizedIndex >= 0 && normalizedIndex < candidate.length) nextCandidates.push(candidate[normalizedIndex]);
      } else if (step.kind === 'wildcard') {
        if (Array.isArray(candidate)) nextCandidates.push(...candidate);
        else nextCandidates.push(...Object.values(candidate as Record<string, unknown>));
      } else if (step.kind === 'recursive') {
        collectRecursiveKey(candidate, step.key, nextCandidates);
      }
    }
    candidates = nextCandidates;
    if (candidates.length === 0) break;
  }

  if (candidates.length === 0 || candidates[0] === undefined || candidates[0] === null) {
    return { ok: false, value: `Nenhum valor encontrado em ${pathExpression}` };
  }

  return { ok: true, value: stringifyScalar(candidates[0]) };
};

export const decodeResponseBodyText = (response: HttpResponse): string => {
  if (response.bodyEncoding === 'base64') {
    return decodeBase64Utf8(response.body) ?? '';
  }
  return response.body ?? '';
};

export const extractResponsePreview = (
  response: HttpResponse | undefined,
  parsed: ParsedResponseTag
): { ok: boolean; value: string } => {
  if (!response) return { ok: false, value: '' };
  const bodyText = decodeResponseBodyText(response);
  const filter = parsed.filter.trim();

  if (parsed.field === 'url') return { ok: true, value: response.url };
  if (parsed.field === 'raw') return { ok: true, value: bodyText };
  if (parsed.field === 'header') {
    if (!filter) return { ok: false, value: 'Informe o nome do header' };
    const matched = response.headers.find((header) => header.key.toLowerCase() === filter.toLowerCase());
    if (!matched) return { ok: false, value: `Header "${filter}" não encontrado na última resposta` };
    return { ok: true, value: matched.value };
  }

  if (!filter) return { ok: true, value: bodyText };
  return evaluateJsonPath(bodyText, filter);
};

