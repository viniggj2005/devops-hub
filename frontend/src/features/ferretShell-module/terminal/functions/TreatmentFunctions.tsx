import type { SshDto } from '../../../../interfaces/TerminalInterfaces';

export function normalizeKey(key: SshDto['key']): Uint8Array {
  if (!key) return new Uint8Array();
  if (typeof key === 'string') return new TextEncoder().encode(key);
  return new Uint8Array(key);
}

function isBase64(value: string): boolean {
  const trimmedValue = value.trim().replace(/\r?\n/g, '');
  if (!trimmedValue || trimmedValue.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmedValue);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function toBase64(key: SshDto['key']): string | undefined {
  if (key == null) return undefined;

  if (typeof key === 'string') {
    const trimmedKey = key.trim();
    if (isBase64(trimmedKey.replace(/\r?\n/g, ''))) return trimmedKey.replace(/\r?\n/g, '');
    return bytesToBase64(new TextEncoder().encode(trimmedKey));
  }

  return bytesToBase64(Uint8Array.from(key));
}
