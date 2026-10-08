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

export const octohubColorGroups: { title: string; description: string; keys: { key: OctohubColorKey; label: string; hint: string }[] }[] = [
  {
    title: 'Diff',
    description: 'Linhas exibidas ao comparar alterações.',
    keys: [
      { key: 'addition', label: 'Linha adicionada', hint: 'Fundo e texto das linhas com +' },
      { key: 'deletion', label: 'Linha removida', hint: 'Fundo e texto das linhas com -' },
    ],
  },
  {
    title: 'Status dos arquivos',
    description: 'Etiquetas da lista de alterações.',
    keys: [
      { key: 'added', label: 'Adicionado', hint: 'Etiqueta A' },
      { key: 'modified', label: 'Modificado', hint: 'Etiqueta M' },
      { key: 'deleted', label: 'Removido', hint: 'Etiqueta D' },
      { key: 'renamed', label: 'Renomeado', hint: 'Etiqueta R' },
      { key: 'untracked', label: 'Não rastreado', hint: 'Etiqueta U' },
      { key: 'conflicted', label: 'Em conflito', hint: 'Etiqueta !' },
    ],
  },
];
