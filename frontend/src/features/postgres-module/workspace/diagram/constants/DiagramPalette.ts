import type { DiagramBadge } from '../../../functions/DiagramLayout';

export interface BadgeColors {
  fill: string;
  text: string;
}

export interface DiagramPalette {
  dot: string;
  node: string;
  text: string;
  edge: string;
  muted: string;
  canvas: string;
  border: string;
  accent: string;
  header: string;
  headerText: string;
  partitionedHeader: string;
  badges: Record<DiagramBadge, BadgeColors>;
}

export const diagramPalettes: Record<'light' | 'dark', DiagramPalette> = {
  light: {
    dot: '#d4d4d8',
    node: '#ffffff',
    text: '#18181b',
    edge: '#0891b2',
    muted: '#71717a',
    canvas: '#fafafa',
    border: '#d4d4d8',
    accent: '#06b6d4',
    header: '#0891b2',
    headerText: '#ffffff',
    partitionedHeader: '#2563eb',
    badges: {
      PK: { fill: '#fef3c7', text: '#b45309' },
      FK: { fill: '#e0f2fe', text: '#0369a1' },
      UQ: { fill: '#ede9fe', text: '#6d28d9' },
      NN: { fill: '#f4f4f5', text: '#52525b' },
    },
  },
  dark: {
    dot: '#3f3f46',
    node: '#18181b',
    text: '#e4e4e7',
    edge: '#22d3ee',
    muted: '#a1a1aa',
    canvas: '#0c0c0f',
    border: '#3f3f46',
    accent: '#22d3ee',
    header: '#0e7490',
    headerText: '#ffffff',
    partitionedHeader: '#1d4ed8',
    badges: {
      PK: { fill: '#451a03', text: '#fbbf24' },
      FK: { fill: '#082f49', text: '#38bdf8' },
      UQ: { fill: '#2e1065', text: '#c4b5fd' },
      NN: { fill: '#27272a', text: '#a1a1aa' },
    },
  },
};
