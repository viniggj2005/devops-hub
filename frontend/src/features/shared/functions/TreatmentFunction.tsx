import { currentDictionary } from '../../i18n/TranslateError';
import { formatMessage } from '../../i18n/Languages';

export function FmtAgo(created?: number) {
  if (!created) return '-';
  const miliseconds = Date.now() - created * 1000;
  const seconds = Math.max(1, Math.floor(miliseconds / 1000));
  const { ago, units: unitLabels } = currentDictionary().app.timeAgo;
  const units: [number, string][] = [
    [60, unitLabels.seconds],
    [60, unitLabels.minutes],
    [24, unitLabels.hours],
    [7, unitLabels.days],
    [4.345, unitLabels.weeks],
    [12, unitLabels.months],
  ];
  let value = seconds;
  let label = unitLabels.seconds;
  for (let index = 0; index < units.length; index++) {
    const [key, tag] = units[index];
    if (value < key) {
      label = tag;
      break;
    }
    value = Math.floor(value / key);
    label = tag;
  }
  return formatMessage(ago, { value, unit: label });
}

export function FmtName(names: string[]) {
  if (!names || names.length === 0) return '—';
  return names[0].startsWith('/') ? names[0].slice(1) : names[0];
}

export function FormatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null) return '';
  if (bytes === 0) return '0 B';
  const key = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(key));
  const value = parseFloat((bytes / Math.pow(key, index)).toFixed(1));
  return `${value} ${sizes[index]}`;
}

export function ParseNameAndTag(repoTags?: string[]) {
  if (!repoTags || repoTags.length === 0) return { name: '<dangling>', tag: '<none>' };
  const first = repoTags.find((t) => !t.startsWith('<none>')) ?? repoTags[0];
  const index = first.lastIndexOf(':');
  if (index === -1) return { name: first, tag: 'latest' };
  return { name: first.slice(0, index), tag: first.slice(index + 1) };
}

export function EpochToDateStr(created?: number) {
  if (created === undefined || created === null) return '';
  const date = new Date(created < 10_000_000_000 ? created * 1000 : created);
  return date.toLocaleString();
}

export function classState(state: string) {
  const status = state?.toLowerCase();

  const base = "border font-medium bg-opacity-10 backdrop-blur-sm";

  if (status === 'paused')
    return `${base} bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20`;

  if (status === 'running')
    return `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]`;

  if (status === 'exited')
    return `${base} bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20`;

  if (status === 'restarting')
    return `${base} bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 animate-pulse`;

  return `${base} bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20`;
}

export function BytesToMB(numberOfBytes: number) {
  return +(numberOfBytes / (1024 * 1024)).toFixed(1);
}
