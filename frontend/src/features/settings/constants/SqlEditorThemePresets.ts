import { customThemeShades, hexToRgb } from '../functions/CustomThemePalette';
import {
  SqlEditorColors,
  CustomThemeColors,
  SqlEditorColorKey,
  SqlEditorThemeConfig,
} from '../../../interfaces/GeneralConfigsInterfaces';

export interface SqlEditorThemePreset {
  id: string;
  name: string;
  colors: SqlEditorColors;
}

export const sqlEditorAutoPresetId = 'auto';

export const sqlEditorCustomPresetId = 'custom';

export const defaultSqlEditorFontSize = 13;

export const sqlEditorFontSizeRange = { min: 10, max: 22 };

const devopsDark: SqlEditorColors = {
  type: '#e5c07b',
  cursor: '#22d3ee',
  string: '#98c379',
  number: '#d19a66',
  keyword: '#c678dd',
  comment: '#7d8799',
  operator: '#56b6c2',
  function: '#61afef',
  selection: '#164e63',
  background: '#0b1120',
  foreground: '#e4e4e7',
  identifier: '#e4e4e7',
  activeLine: '#111a2e',
  lineNumbers: '#52525b',
};

const devopsLight: SqlEditorColors = {
  type: '#0f766e',
  cursor: '#0891b2',
  string: '#b91c1c',
  number: '#15803d',
  keyword: '#7c3aed',
  comment: '#a16207',
  operator: '#0e7490',
  function: '#1d4ed8',
  selection: '#cdeff5',
  background: '#ffffff',
  foreground: '#18181b',
  identifier: '#18181b',
  activeLine: '#f3fbfd',
  lineNumbers: '#9ca3af',
};

export const sqlEditorThemePresets: SqlEditorThemePreset[] = [
  { id: 'devops-dark', name: 'DevOps Escuro', colors: devopsDark },
  { id: 'devops-light', name: 'DevOps Claro', colors: devopsLight },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      type: '#8be9fd',
      cursor: '#f8f8f2',
      string: '#f1fa8c',
      number: '#bd93f9',
      keyword: '#ff79c6',
      comment: '#6272a4',
      operator: '#ff79c6',
      function: '#50fa7b',
      selection: '#44475a',
      background: '#282a36',
      foreground: '#f8f8f2',
      identifier: '#f8f8f2',
      activeLine: '#2f3240',
      lineNumbers: '#6272a4',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    colors: {
      type: '#66d9ef',
      cursor: '#f8f8f0',
      string: '#e6db74',
      number: '#ae81ff',
      keyword: '#f92672',
      comment: '#75715e',
      operator: '#f92672',
      function: '#a6e22e',
      selection: '#49483e',
      background: '#272822',
      foreground: '#f8f8f2',
      identifier: '#f8f8f2',
      activeLine: '#3e3d32',
      lineNumbers: '#75715e',
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    colors: {
      type: '#953800',
      cursor: '#0969da',
      string: '#0a3069',
      number: '#0550ae',
      keyword: '#cf222e',
      comment: '#6e7781',
      operator: '#cf222e',
      function: '#8250df',
      selection: '#b6e3ff',
      background: '#ffffff',
      foreground: '#24292f',
      identifier: '#24292f',
      activeLine: '#f6f8fa',
      lineNumbers: '#8c959f',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    colors: {
      type: '#b58900',
      cursor: '#93a1a1',
      string: '#2aa198',
      number: '#d33682',
      keyword: '#859900',
      comment: '#586e75',
      operator: '#859900',
      function: '#268bd2',
      selection: '#073642',
      background: '#002b36',
      foreground: '#93a1a1',
      identifier: '#93a1a1',
      activeLine: '#06313d',
      lineNumbers: '#586e75',
    },
  },
];

export const sqlEditorColorGroups: { title: string; keys: { key: SqlEditorColorKey; label: string }[] }[] = [
  {
    title: 'Editor',
    keys: [
      { key: 'background', label: 'Fundo' },
      { key: 'foreground', label: 'Texto' },
      { key: 'lineNumbers', label: 'Números de linha' },
      { key: 'cursor', label: 'Cursor' },
      { key: 'selection', label: 'Seleção' },
      { key: 'activeLine', label: 'Linha atual' },
    ],
  },
  {
    title: 'Sintaxe',
    keys: [
      { key: 'keyword', label: 'Palavras-chave' },
      { key: 'type', label: 'Tipos' },
      { key: 'string', label: 'Textos' },
      { key: 'number', label: 'Números e booleanos' },
      { key: 'comment', label: 'Comentários' },
      { key: 'operator', label: 'Operadores' },
      { key: 'identifier', label: 'Tabelas e colunas' },
      { key: 'function', label: 'Funções' },
    ],
  },
];

export const defaultSqlEditorTheme = (): SqlEditorThemeConfig => ({
  preset: sqlEditorAutoPresetId,
  fontSize: defaultSqlEditorFontSize,
  colors: { ...devopsDark },
});

const customThemeEditorColors = (customTheme: CustomThemeColors): SqlEditorColors => {
  const shade = customThemeShades(customTheme);
  if (customTheme.base === 'dark') {
    return {
      ...devopsDark,
      cursor: shade('cyan', 400),
      selection: shade('cyan', 900),
      background: shade('zinc', 950),
      foreground: shade('zinc', 100),
      identifier: shade('zinc', 100),
      activeLine: shade('zinc', 900),
      lineNumbers: shade('zinc', 600),
    };
  }
  return {
    ...devopsLight,
    cursor: shade('cyan', 600),
    selection: shade('cyan', 100),
    background: shade('zinc', 50),
    foreground: shade('zinc', 900),
    identifier: shade('zinc', 900),
    activeLine: shade('zinc', 100),
    lineNumbers: shade('zinc', 400),
  };
};

export const resolveSqlEditorColors = (
  config: SqlEditorThemeConfig,
  moduleIsDark: boolean,
  customTheme: CustomThemeColors | null = null,
): SqlEditorColors => {
  if (config.preset !== sqlEditorAutoPresetId) return config.colors;
  if (customTheme) return customThemeEditorColors(customTheme);
  return moduleIsDark ? devopsDark : devopsLight;
};

export const isDarkBackground = (hex: string) => {
  const [red, green, blue] = hexToRgb(hex);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 128;
};
