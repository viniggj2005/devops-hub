export type ConfigType = 'user' | 'theme' | 'colors';

export type ThemeBase = 'light' | 'dark';

export type ModuleThemePreference = 'light' | 'dark' | 'custom';

export type AccentFamily = 'blue' | 'purple' | 'amber' | 'emerald';

export type ConfigurableModule = 'vulpes' | 'octohub' | 'ferretshell' | 'docker-manager';

export interface CustomThemeColors {
  text: string;
  base: ThemeBase;
  primary: string;
  background: string;
}

export interface ModuleConfig {
  showOnHome: boolean;
  theme: ModuleThemePreference;
  customTheme: CustomThemeColors;
}

export interface SaveGeneralConfigPayload {
  configType: ConfigType;
  moduleName: ConfigurableModule;
  config: Record<string, unknown>;
}

export type TerminalColorKey =
  | 'red'
  | 'blue'
  | 'cyan'
  | 'black'
  | 'green'
  | 'white'
  | 'yellow'
  | 'cursor'
  | 'magenta'
  | 'brightRed'
  | 'background'
  | 'foreground'
  | 'brightBlue'
  | 'brightCyan'
  | 'brightBlack'
  | 'brightGreen'
  | 'brightWhite'
  | 'brightYellow'
  | 'brightMagenta'
  | 'selectionBackground';

export type TerminalThemeColors = Record<TerminalColorKey, string>;

export interface TerminalThemeConfig {
  preset: string;
  fontSize: number;
  colors: TerminalThemeColors;
}

export type OctohubColorKey =
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'addition'
  | 'deletion'
  | 'modified'
  | 'untracked'
  | 'conflicted';

export type OctohubColors = Record<OctohubColorKey, string>;
