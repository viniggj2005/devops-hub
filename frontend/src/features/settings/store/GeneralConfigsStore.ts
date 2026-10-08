import iziToast from 'izitoast';
import { create } from 'zustand';
import { getToken } from '../../../contexts/AuthContext';
import { isHexColor } from '../functions/CustomThemePalette';
import { readStoredGlobalTheme } from '../functions/StoredGlobalTheme';
import { defaultOctohubColors } from '../constants/OctohubColorDefaults';
import { appModules, defaultCustomTheme } from '../../shared/constants/AppModules';
import { defaultTerminalTheme, terminalFontSizeRange } from '../constants/TerminalThemePresets';
import { findAllGeneralConfigsApi, saveGeneralConfigApi } from '../services/GeneralConfigsService';
import {
  ConfigType,
  ModuleConfig,
  OctohubColors,
  CustomThemeColors,
  ConfigurableModule,
  TerminalThemeConfig,
  ModuleThemePreference,
} from '../../../interfaces/GeneralConfigsInterfaces';

type ModulesConfig = Record<ConfigurableModule, ModuleConfig>;

interface GeneralConfigsState {
  loaded: boolean;
  reset: () => void;
  modules: ModulesConfig;
  load: () => Promise<void>;
  octohubColors: OctohubColors;
  terminalTheme: TerminalThemeConfig;
  setOctohubColors: (octohubColors: OctohubColors) => Promise<void>;
  setTerminalTheme: (terminalTheme: TerminalThemeConfig) => Promise<void>;
  setShowOnHome: (moduleName: ConfigurableModule, showOnHome: boolean) => Promise<void>;
  setModuleTheme: (moduleName: ConfigurableModule, theme: ModuleThemePreference) => Promise<void>;
  setModuleCustomTheme: (moduleName: ConfigurableModule, customTheme: CustomThemeColors) => Promise<void>;
}

const themePreferences: ModuleThemePreference[] = ['light', 'dark', 'custom'];

const buildDefaultModules = (): ModulesConfig => {
  const defaultTheme = readStoredGlobalTheme();
  return Object.fromEntries(
    appModules.map(module => [
      module.configName,
      { showOnHome: true, theme: defaultTheme, customTheme: defaultCustomTheme(module.configName) },
    ]),
  ) as ModulesConfig;
};

const parseConfig = (rawConfig: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(rawConfig);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const isThemePreference = (value: unknown): value is ModuleThemePreference =>
  themePreferences.includes(value as ModuleThemePreference);

const parseCustomTheme = (value: unknown, fallback: CustomThemeColors): CustomThemeColors => {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<CustomThemeColors>;
  return {
    base: candidate.base === 'light' || candidate.base === 'dark' ? candidate.base : fallback.base,
    text: isHexColor(candidate.text) ? candidate.text : fallback.text,
    primary: isHexColor(candidate.primary) ? candidate.primary : fallback.primary,
    background: isHexColor(candidate.background) ? candidate.background : fallback.background,
  };
};

const parseColorRecord = <Colors extends Record<string, string>>(value: unknown, fallback: Colors): Colors => {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackColor]) => [key, isHexColor(candidate[key]) ? candidate[key] : fallbackColor]),
  ) as Colors;
};

const parseTerminalTheme = (values: Record<string, unknown>): TerminalThemeConfig => {
  const fallback = defaultTerminalTheme();
  const fontSize = Number(values.fontSize);
  const isValidFontSize = Number.isInteger(fontSize) && fontSize >= terminalFontSizeRange.min && fontSize <= terminalFontSizeRange.max;
  return {
    preset: typeof values.preset === 'string' ? values.preset : fallback.preset,
    fontSize: isValidFontSize ? fontSize : fallback.fontSize,
    colors: parseColorRecord(values.colors, fallback.colors),
  };
};

const themeConfig = (moduleConfig: ModuleConfig) => ({
  mode: moduleConfig.theme,
  custom: moduleConfig.customTheme,
});

const showError = (message: string, error: unknown) => {
  iziToast.error({
    title: 'Erro',
    position: 'bottomRight',
    message: `${message}: ${error}`,
  });
};

export const useGeneralConfigsStore = create<GeneralConfigsState>((set, get) => {
  const updateModule = async (
    moduleName: ConfigurableModule,
    changes: Partial<ModuleConfig>,
    configType: ConfigType,
    buildConfig: (moduleConfig: ModuleConfig) => Record<string, unknown>,
  ) => {
    const previousConfig = get().modules[moduleName];
    const nextConfig = { ...previousConfig, ...changes };
    set(state => ({ modules: { ...state.modules, [moduleName]: nextConfig } }));
    try {
      await saveGeneralConfigApi(getToken() ?? '', { moduleName, configType, config: buildConfig(nextConfig) });
    } catch (error) {
      set(state => ({ modules: { ...state.modules, [moduleName]: previousConfig } }));
      showError('Falha ao salvar a configuração', error);
    }
  };

  const saveModuleColors = async <Key extends 'terminalTheme' | 'octohubColors'>(
    stateKey: Key,
    moduleName: ConfigurableModule,
    nextValue: GeneralConfigsState[Key],
  ) => {
    const previousValue = get()[stateKey];
    set({ [stateKey]: nextValue } as Pick<GeneralConfigsState, Key>);
    try {
      await saveGeneralConfigApi(getToken() ?? '', { moduleName, configType: 'colors', config: { ...nextValue } });
    } catch (error) {
      set({ [stateKey]: previousValue } as Pick<GeneralConfigsState, Key>);
      showError('Falha ao salvar as cores', error);
    }
  };

  return {
    loaded: false,
    modules: buildDefaultModules(),
    terminalTheme: defaultTerminalTheme(),
    octohubColors: { ...defaultOctohubColors },

    reset: () => set({
      loaded: false,
      modules: buildDefaultModules(),
      terminalTheme: defaultTerminalTheme(),
      octohubColors: { ...defaultOctohubColors },
    }),

    load: async () => {
      const token = getToken();
      if (!token) return;
      try {
        const savedConfigs = await findAllGeneralConfigsApi(token);
        const modules = buildDefaultModules();
        let terminalTheme = defaultTerminalTheme();
        let octohubColors = { ...defaultOctohubColors };
        for (const savedConfig of savedConfigs) {
          const moduleName = savedConfig.moduleName as ConfigurableModule;
          if (!(moduleName in modules)) continue;
          const values = parseConfig(savedConfig.config);
          if (savedConfig.configType === 'user' && typeof values.showOnHome === 'boolean') {
            modules[moduleName].showOnHome = values.showOnHome;
          }
          if (savedConfig.configType === 'theme') {
            if (isThemePreference(values.mode)) modules[moduleName].theme = values.mode;
            modules[moduleName].customTheme = parseCustomTheme(values.custom, modules[moduleName].customTheme);
          }
          if (savedConfig.configType === 'colors' && moduleName === 'ferretshell') {
            terminalTheme = parseTerminalTheme(values);
          }
          if (savedConfig.configType === 'colors' && moduleName === 'octohub') {
            octohubColors = parseColorRecord(values, octohubColors);
          }
        }
        set({ modules, terminalTheme, octohubColors, loaded: true });
      } catch (error) {
        set({ loaded: true });
        showError('Falha ao carregar as configurações', error);
      }
    },

    setShowOnHome: (moduleName, showOnHome) =>
      updateModule(moduleName, { showOnHome }, 'user', moduleConfig => ({ showOnHome: moduleConfig.showOnHome })),

    setModuleTheme: (moduleName, theme) =>
      updateModule(moduleName, { theme }, 'theme', themeConfig),

    setModuleCustomTheme: (moduleName, customTheme) =>
      updateModule(moduleName, { customTheme }, 'theme', themeConfig),

    setOctohubColors: octohubColors => saveModuleColors('octohubColors', 'octohub', octohubColors),

    setTerminalTheme: terminalTheme => saveModuleColors('terminalTheme', 'ferretshell', terminalTheme),
  };
});
