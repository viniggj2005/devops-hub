import { TerminalColorKey, TerminalThemeColors, TerminalThemeConfig } from '../../../interfaces/GeneralConfigsInterfaces';

export interface TerminalThemePreset {
  id: string;
  name: string;
  colors: TerminalThemeColors;
}

export const customPresetId = 'custom';

export const defaultTerminalFontSize = 14;

export const terminalFontSizeRange = { min: 10, max: 24 };

export const terminalThemePresets: TerminalThemePreset[] = [
  {
    id: 'ferret',
    name: 'FerretShell',
    colors: {
      red: '#cd3131',
      blue: '#2472c8',
      cyan: '#11a8cd',
      black: '#000000',
      green: '#4ade80',
      white: '#e5e5e5',
      yellow: '#e5e510',
      cursor: '#734fa6',
      magenta: '#bc3fbc',
      brightRed: '#f14c4c',
      background: '#0e172a',
      foreground: '#d1d5db',
      brightBlue: '#3b8eea',
      brightCyan: '#29b8db',
      brightBlack: '#666666',
      brightGreen: '#23d18b',
      brightWhite: '#e5e5e5',
      brightYellow: '#f5f543',
      brightMagenta: '#d670d6',
      selectionBackground: '#334155',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      red: '#ff5555',
      blue: '#bd93f9',
      cyan: '#8be9fd',
      black: '#21222c',
      green: '#50fa7b',
      white: '#f8f8f2',
      yellow: '#f1fa8c',
      cursor: '#f8f8f2',
      magenta: '#ff79c6',
      brightRed: '#ff6e6e',
      background: '#282a36',
      foreground: '#f8f8f2',
      brightBlue: '#d6acff',
      brightCyan: '#a4ffff',
      brightBlack: '#6272a4',
      brightGreen: '#69ff94',
      brightWhite: '#ffffff',
      brightYellow: '#ffffa5',
      brightMagenta: '#ff92df',
      selectionBackground: '#44475a',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    colors: {
      red: '#e06c75',
      blue: '#61afef',
      cyan: '#56b6c2',
      black: '#282c34',
      green: '#98c379',
      white: '#abb2bf',
      yellow: '#e5c07b',
      cursor: '#528bff',
      magenta: '#c678dd',
      brightRed: '#e06c75',
      background: '#282c34',
      foreground: '#abb2bf',
      brightBlue: '#61afef',
      brightCyan: '#56b6c2',
      brightBlack: '#5c6370',
      brightGreen: '#98c379',
      brightWhite: '#ffffff',
      brightYellow: '#e5c07b',
      brightMagenta: '#c678dd',
      selectionBackground: '#3e4451',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    colors: {
      red: '#dc322f',
      blue: '#268bd2',
      cyan: '#2aa198',
      black: '#073642',
      green: '#859900',
      white: '#eee8d5',
      yellow: '#b58900',
      cursor: '#93a1a1',
      magenta: '#d33682',
      brightRed: '#cb4b16',
      background: '#002b36',
      foreground: '#839496',
      brightBlue: '#839496',
      brightCyan: '#93a1a1',
      brightBlack: '#586e75',
      brightGreen: '#586e75',
      brightWhite: '#fdf6e3',
      brightYellow: '#657b83',
      brightMagenta: '#6c71c4',
      selectionBackground: '#073642',
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    colors: {
      red: '#cf222e',
      blue: '#0969da',
      cyan: '#1b7c83',
      black: '#24292f',
      green: '#116329',
      white: '#6e7781',
      yellow: '#4d2d00',
      cursor: '#0969da',
      magenta: '#8250df',
      brightRed: '#a40e26',
      background: '#ffffff',
      foreground: '#24292f',
      brightBlue: '#218bff',
      brightCyan: '#3192aa',
      brightBlack: '#57606a',
      brightGreen: '#1a7f37',
      brightWhite: '#8c959f',
      brightYellow: '#633c01',
      brightMagenta: '#a475f9',
      selectionBackground: '#cce5ff',
    },
  },
];

export const terminalColorGroups: { title: string; keys: { key: TerminalColorKey; label: string }[] }[] = [
  {
    title: 'Principais',
    keys: [
      { key: 'background', label: 'Fundo' },
      { key: 'foreground', label: 'Texto' },
      { key: 'cursor', label: 'Cursor' },
      { key: 'selectionBackground', label: 'Seleção' },
    ],
  },
  {
    title: 'Cores ANSI',
    keys: [
      { key: 'black', label: 'Preto' },
      { key: 'red', label: 'Vermelho' },
      { key: 'green', label: 'Verde' },
      { key: 'yellow', label: 'Amarelo' },
      { key: 'blue', label: 'Azul' },
      { key: 'magenta', label: 'Magenta' },
      { key: 'cyan', label: 'Ciano' },
      { key: 'white', label: 'Branco' },
    ],
  },
  {
    title: 'Cores ANSI claras',
    keys: [
      { key: 'brightBlack', label: 'Preto claro' },
      { key: 'brightRed', label: 'Vermelho claro' },
      { key: 'brightGreen', label: 'Verde claro' },
      { key: 'brightYellow', label: 'Amarelo claro' },
      { key: 'brightBlue', label: 'Azul claro' },
      { key: 'brightMagenta', label: 'Magenta claro' },
      { key: 'brightCyan', label: 'Ciano claro' },
      { key: 'brightWhite', label: 'Branco claro' },
    ],
  },
];

export const defaultTerminalTheme = (): TerminalThemeConfig => ({
  preset: terminalThemePresets[0].id,
  fontSize: defaultTerminalFontSize,
  colors: { ...terminalThemePresets[0].colors },
});
