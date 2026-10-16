import type { DiagramBadge } from '../../../functions/DiagramLayout';
import { customThemeShades } from '../../../../settings/functions/CustomThemePalette';
import type { CustomThemeColors } from '../../../../../interfaces/GeneralConfigsInterfaces';

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

export function buildDiagramPalette(dark: boolean, customTheme: CustomThemeColors | null): DiagramPalette {
  const base = diagramPalettes[dark ? 'dark' : 'light'];
  if (!customTheme) return base;
  const shade = customThemeShades(customTheme);

  if (dark) {
    return {
      ...base,
      dot: shade('zinc', 700),
      node: shade('zinc', 900),
      text: shade('zinc', 200),
      edge: shade('cyan', 400),
      muted: shade('zinc', 400),
      canvas: shade('zinc', 950),
      border: shade('zinc', 700),
      accent: shade('cyan', 300),
      header: shade('cyan', 700),
      partitionedHeader: shade('cyan', 800),
      badges: { ...base.badges, NN: { fill: shade('zinc', 800), text: shade('zinc', 400) } },
    };
  }
  return {
    ...base,
    dot: shade('zinc', 300),
    node: shade('zinc', 50),
    text: shade('zinc', 900),
    edge: shade('cyan', 600),
    muted: shade('zinc', 500),
    canvas: shade('zinc', 50),
    border: shade('zinc', 300),
    accent: shade('cyan', 500),
    header: shade('cyan', 600),
    partitionedHeader: shade('cyan', 700),
    badges: { ...base.badges, NN: { fill: shade('zinc', 100), text: shade('zinc', 600) } },
  };
}
