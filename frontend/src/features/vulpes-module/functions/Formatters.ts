import type { HttpResponse, RawLanguage } from '../../../interfaces/VulpesInterfaces';

const maxPrettyPrintLength = 8 * 1024 * 1024;

const extensionsByMediaType: Record<string, string> = {
  'text/csv': '.csv',
  'text/html': '.html',
  'image/png': '.png',
  'image/gif': '.gif',
  'text/plain': '.txt',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/xml': '.xml',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/json': '.json',
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const formatDuration = (milliseconds: number) =>
  milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(2)} s`;

export const formatClock = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};

export const prettyJson = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > maxPrettyPrintLength || !'{["'.includes(trimmed[0])) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
};

export const statusTone = (statusCode: number) => {
  if (statusCode >= 500) return 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
  if (statusCode >= 400) return 'bg-orange-500/15 text-orange-600 dark:text-orange-400';
  if (statusCode >= 300) return 'bg-sky-500/15 text-sky-600 dark:text-sky-400';
  return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
};

export const mediaTypeOf = (contentType: string) => contentType.split(';')[0].trim().toLowerCase();

export const languageForContentType = (contentType: string): RawLanguage => {
  const mediaType = mediaTypeOf(contentType);
  if (mediaType.includes('json')) return 'json';
  if (mediaType.includes('html')) return 'html';
  if (mediaType.includes('xml')) return 'xml';
  if (mediaType.includes('javascript') || mediaType.includes('ecmascript')) return 'javascript';
  return 'text';
};

export const responseFileName = (response: HttpResponse) => {
  const mediaType = mediaTypeOf(response.contentType);
  let baseName = 'resposta';
  try {
    const lastSegment = new URL(response.url).pathname.split('/').filter(Boolean).pop();
    if (lastSegment) baseName = decodeURIComponent(lastSegment);
  } catch {
    baseName = 'resposta';
  }
  const extension = extensionsByMediaType[mediaType] ?? '';
  return baseName.includes('.') || !extension ? baseName : `${baseName}${extension}`;
};
