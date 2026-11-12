import { OctohubColorKey, OctohubColors } from '../../../interfaces/GeneralConfigsInterfaces';

export const defaultOctohubColors: OctohubColors = {
  added: '#10b981',
  deleted: '#ef4444',
  renamed: '#3b82f6',
  addition: '#10b981',
  deletion: '#f43f5e',
  modified: '#f59e0b',
  untracked: '#10b981',
  conflicted: '#f97316',
};

export const octohubColorGroups: { id: 'diff' | 'fileStatus'; keys: OctohubColorKey[] }[] = [
  { id: 'diff', keys: ['addition', 'deletion'] },
  { id: 'fileStatus', keys: ['added', 'modified', 'deleted', 'renamed', 'untracked', 'conflicted'] },
];
