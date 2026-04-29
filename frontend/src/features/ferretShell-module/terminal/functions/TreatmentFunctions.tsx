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

export function toBase64(key: SshDto['key']): string | undefined {
  if (key == null) return undefined;

  if (typeof key === 'string') {
    const trimmedKey = key.trim();
    if (isBase64(trimmedKey.replace(/\r?\n/g, ''))) return trimmedKey.replace(/\r?\n/g, '');
    const bytes = new TextEncoder().encode(trimmedKey);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  const uint8 = Uint8Array.from(key);
  let bin = '';
  for (let index = 0; index < uint8.length; index++) bin += String.fromCharCode(uint8[index]);
  return btoa(bin);
}
