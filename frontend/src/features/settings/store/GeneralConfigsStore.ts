import { create } from 'zustand';
import toast from 'react-hot-toast';
import { Events } from '@wailsio/runtime';
import { getToken } from '../../../contexts/AuthContext';
import { isHexColor } from '../functions/CustomThemePalette';
import { windowInstanceId } from '../../appFrame/WindowContext';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { readStoredGlobalTheme } from '../functions/StoredGlobalTheme';
import { defaultOctohubColors } from '../constants/OctohubColorDefaults';
import { appModules, defaultCustomTheme } from '../../shared/constants/AppModules';
import { defaultTerminalTheme, terminalFontSizeRange } from '../constants/TerminalThemePresets';
import { defaultSqlEditorTheme, sqlEditorFontSizeRange } from '../constants/SqlEditorThemePresets';
import {
  saveThemeProfileApi,
  saveGeneralConfigApi,
  deleteThemeProfileApi,
  findAllThemeProfilesApi,
  findAllGeneralConfigsApi,
  saveManyGeneralConfigsApi,
} from '../services/GeneralConfigsService';
import {
  ThemeBase,
  ConfigType,
  ThemeProfile,
  ModuleConfig,
  OctohubColors,
  CustomThemeColors,
  ConfigurableModule,
  ThemeProfileConfig,
  TerminalThemeConfig,
  SqlEditorThemeConfig,
  ModuleThemePreference,
  SaveGeneralConfigPayload,
} from '../../../interfaces/GeneralConfigsInterfaces';
import * as generalConfigsDtos from '../../../../bindings/docker-manager-go/src/generalConfigs/dtos/models';

type ModulesConfig = Record<ConfigurableModule, ModuleConfig>;

interface GeneralConfigsState {
  loaded: boolean;
  reset: () => void;
  modules: ModulesConfig;
  load: () => Promise<void>;
  octohubColors: OctohubColors;
  themeProfiles: ThemeProfile[];
  terminalTheme: TerminalThemeConfig;
  sqlEditorTheme: SqlEditorThemeConfig;
  restoreDefaultThemes: () => Promise<ThemeBase | null>;
  deleteThemeProfile: (profile: ThemeProfile) => Promise<void>;
  applyThemeProfile: (profile: ThemeProfile) => Promise<boolean>;
  buildThemeSnapshot: (globalTheme: ThemeBase) => ThemeProfileConfig;
  setOctohubColors: (octohubColors: OctohubColors) => Promise<void>;
  setTerminalTheme: (terminalTheme: TerminalThemeConfig) => Promise<void>;
  setSqlEditorTheme: (sqlEditorTheme: SqlEditorThemeConfig) => Promise<void>;
  renameThemeProfile: (profile: ThemeProfile, name: string) => Promise<boolean>;
  createThemeProfile: (name: string, globalTheme: ThemeBase) => Promise<boolean>;
  setShowOnHome: (moduleName: ConfigurableModule, showOnHome: boolean) => Promise<void>;
  overwriteThemeProfile: (profile: ThemeProfile, globalTheme: ThemeBase) => Promise<void>;
  setModuleTheme: (moduleName: ConfigurableModule, theme: ModuleThemePreference) => Promise<void>;
  setModuleCustomTheme: (moduleName: ConfigurableModule, customTheme: CustomThemeColors) => Promise<void>;
}

const themePreferences: ModuleThemePreference[] = ['light', 'dark', 'custom'];

export const generalConfigsChangedEvent = 'general-configs:changed';

const notifyConfigsChanged = () => Events.Emit(generalConfigsChangedEvent, windowInstanceId);

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

const parseFontTheme = <Config extends { preset: string; fontSize: number; colors: Record<string, string> }>(
  values: Record<string, unknown>,
  fallback: Config,
  fontSizeRange: { min: number; max: number },
): Config => {
  const fontSize = Number(values.fontSize);
  const isValidFontSize = Number.isInteger(fontSize) && fontSize >= fontSizeRange.min && fontSize <= fontSizeRange.max;
  return {
    ...fallback,
    preset: typeof values.preset === 'string' ? values.preset : fallback.preset,
    fontSize: isValidFontSize ? fontSize : fallback.fontSize,
    colors: parseColorRecord(values.colors, fallback.colors),
  };
};

const parseTerminalTheme = (values: Record<string, unknown>): TerminalThemeConfig =>
  parseFontTheme(values, defaultTerminalTheme(), terminalFontSizeRange);

const parseSqlEditorTheme = (values: Record<string, unknown>): SqlEditorThemeConfig =>
  parseFontTheme(values, defaultSqlEditorTheme(), sqlEditorFontSizeRange);

const asValues = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

const themeConfig = (moduleConfig: ModuleConfig) => ({
  mode: moduleConfig.theme,
  custom: moduleConfig.customTheme,
});

const parseThemeProfileConfig = (rawConfig: string): ThemeProfileConfig => {
  const values = parseConfig(rawConfig);
  const defaultModules = buildDefaultModules();
  const savedModules = (values.modules && typeof values.modules === 'object' ? values.modules : {}) as Record<string, Record<string, unknown>>;
  const modules = Object.fromEntries(
    appModules.map(module => {
      const fallback = defaultModules[module.configName];
      const savedModule = savedModules[module.configName] ?? {};
      return [module.configName, {
        theme: isThemePreference(savedModule.theme) ? savedModule.theme : fallback.theme,
        customTheme: parseCustomTheme(savedModule.customTheme, fallback.customTheme),
      }];
    }),
  ) as ThemeProfileConfig['modules'];
  return {
    globalTheme: values.globalTheme === 'dark' || values.globalTheme === 'light' ? values.globalTheme : readStoredGlobalTheme(),
    octohubColors: parseColorRecord(values.octohubColors, { ...defaultOctohubColors }),
    terminalTheme: parseTerminalTheme(asValues(values.terminalTheme)),
    sqlEditorTheme: parseSqlEditorTheme(asValues(values.sqlEditorTheme)),
    modules,
  };
};

const toThemeProfile = (profileDto: generalConfigsDtos.ThemeProfileDto): ThemeProfile => ({
  id: profileDto.id,
  name: profileDto.name,
  config: parseThemeProfileConfig(profileDto.config),
});

const sortProfiles = (profiles: ThemeProfile[]) =>
  [...profiles].sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }));

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([first], [second]) => first.localeCompare(second));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const isSameThemeConfig = (first: ThemeProfileConfig, second: ThemeProfileConfig) =>
  stableStringify(first) === stableStringify(second);

const showError = (message: string, error: unknown) => {
  toast.error(`${message}: ${errorMessage(error)}`);
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
      notifyConfigsChanged();
    } catch (error) {
      set(state => ({ modules: { ...state.modules, [moduleName]: previousConfig } }));
      showError('Falha ao salvar a configuração', error);
    }
  };

  const saveModuleColors = async <Key extends 'terminalTheme' | 'octohubColors' | 'sqlEditorTheme'>(
    stateKey: Key,
    moduleName: ConfigurableModule,
    nextValue: GeneralConfigsState[Key],
  ) => {
    const previousValue = get()[stateKey];
    set({ [stateKey]: nextValue } as Pick<GeneralConfigsState, Key>);
    try {
      await saveGeneralConfigApi(getToken() ?? '', { moduleName, configType: 'colors', config: { ...nextValue } });
      notifyConfigsChanged();
    } catch (error) {
      set({ [stateKey]: previousValue } as Pick<GeneralConfigsState, Key>);
      showError('Falha ao salvar as cores', error);
    }
  };

  const saveProfile = async (profile: { id: number; name: string; config: ThemeProfileConfig }) => {
    const savedProfile = toThemeProfile(await saveThemeProfileApi(getToken() ?? '', profile));
    set(state => ({
      themeProfiles: sortProfiles([...state.themeProfiles.filter(item => item.id !== savedProfile.id), savedProfile]),
    }));
    notifyConfigsChanged();
  };

  const buildThemeSnapshot = (globalTheme: ThemeBase): ThemeProfileConfig => {
    const { modules, octohubColors, terminalTheme, sqlEditorTheme } = get();
    return {
      globalTheme,
      octohubColors: { ...octohubColors },
      terminalTheme: { ...terminalTheme, colors: { ...terminalTheme.colors } },
      sqlEditorTheme: { ...sqlEditorTheme, colors: { ...sqlEditorTheme.colors } },
      modules: Object.fromEntries(
        appModules.map(module => [module.configName, {
          theme: modules[module.configName].theme,
          customTheme: { ...modules[module.configName].customTheme },
        }]),
      ) as ThemeProfileConfig['modules'],
    };
  };

  return {
    loaded: false,
    themeProfiles: [],
    modules: buildDefaultModules(),
    terminalTheme: defaultTerminalTheme(),
    sqlEditorTheme: defaultSqlEditorTheme(),
    octohubColors: { ...defaultOctohubColors },

    buildThemeSnapshot,

    reset: () => set({
      loaded: false,
      themeProfiles: [],
      modules: buildDefaultModules(),
      terminalTheme: defaultTerminalTheme(),
      sqlEditorTheme: defaultSqlEditorTheme(),
      octohubColors: { ...defaultOctohubColors },
    }),

    load: async () => {
      const token = getToken();
      if (!token) return;
      try {
        const [savedConfigs, savedProfiles] = await Promise.all([
          findAllGeneralConfigsApi(token),
          findAllThemeProfilesApi(token),
        ]);
        const themeProfiles = sortProfiles((savedProfiles ?? []).map(toThemeProfile));
        const modules = buildDefaultModules();
        let terminalTheme = defaultTerminalTheme();
        let sqlEditorTheme = defaultSqlEditorTheme();
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
          if (savedConfig.configType === 'colors' && moduleName === 'talpadb') {
            sqlEditorTheme = parseSqlEditorTheme(values);
          }
          if (savedConfig.configType === 'colors' && moduleName === 'octohub') {
            octohubColors = parseColorRecord(values, octohubColors);
          }
        }
        set({ modules, terminalTheme, sqlEditorTheme, octohubColors, themeProfiles, loaded: true });
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

    setSqlEditorTheme: sqlEditorTheme => saveModuleColors('sqlEditorTheme', 'talpadb', sqlEditorTheme),

    createThemeProfile: async (name, globalTheme) => {
      try {
        await saveProfile({ id: 0, name, config: buildThemeSnapshot(globalTheme) });
        return true;
      } catch (error) {
        showError('Falha ao salvar o perfil de tema', error);
        return false;
      }
    },

    renameThemeProfile: async (profile, name) => {
      try {
        await saveProfile({ ...profile, name });
        return true;
      } catch (error) {
        showError('Falha ao renomear o perfil de tema', error);
        return false;
      }
    },

    overwriteThemeProfile: async (profile, globalTheme) => {
      try {
        await saveProfile({ ...profile, config: buildThemeSnapshot(globalTheme) });
      } catch (error) {
        showError('Falha ao atualizar o perfil de tema', error);
      }
    },

    deleteThemeProfile: async profile => {
      try {
        await deleteThemeProfileApi(getToken() ?? '', profile.id);
        set(state => ({ themeProfiles: state.themeProfiles.filter(item => item.id !== profile.id) }));
        notifyConfigsChanged();
      } catch (error) {
        showError('Falha ao excluir o perfil de tema', error);
      }
    },

    applyThemeProfile: profile => applyThemeConfig(profile.config, 'Falha ao aplicar o perfil de tema'),

    restoreDefaultThemes: async () => {
      const defaultConfig = buildDefaultThemeConfig();
      const restored = await applyThemeConfig(defaultConfig, 'Falha ao restaurar os temas');
      return restored ? defaultConfig.globalTheme : null;
    },
  };
});

function buildDefaultThemeConfig(): ThemeProfileConfig {
  const globalTheme: ThemeBase = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return {
    globalTheme,
    terminalTheme: defaultTerminalTheme(),
    sqlEditorTheme: defaultSqlEditorTheme(),
    octohubColors: { ...defaultOctohubColors },
    modules: Object.fromEntries(
      appModules.map(module => [module.configName, { theme: globalTheme, customTheme: defaultCustomTheme(module.configName) }]),
    ) as ThemeProfileConfig['modules'],
  };
}

async function applyThemeConfig(config: ThemeProfileConfig, errorMessageText: string): Promise<boolean> {
  const { getState, setState } = useGeneralConfigsStore;
  const {
    modules: previousModules,
    octohubColors: previousOctohubColors,
    terminalTheme: previousTerminalTheme,
    sqlEditorTheme: previousSqlEditorTheme,
  } = getState();
  const modules = Object.fromEntries(
    appModules.map(module => [module.configName, {
      ...previousModules[module.configName],
      theme: config.modules[module.configName].theme,
      customTheme: config.modules[module.configName].customTheme,
    }]),
  ) as ModulesConfig;
  const payloads: SaveGeneralConfigPayload[] = [
    ...appModules.map(module => ({
      configType: 'theme' as const,
      moduleName: module.configName,
      config: themeConfig(modules[module.configName]),
    })),
    { moduleName: 'octohub', configType: 'colors', config: { ...config.octohubColors } },
    { moduleName: 'ferretshell', configType: 'colors', config: { ...config.terminalTheme } },
    { moduleName: 'talpadb', configType: 'colors', config: { ...config.sqlEditorTheme } },
  ];
  setState({
    modules,
    octohubColors: config.octohubColors,
    terminalTheme: config.terminalTheme,
    sqlEditorTheme: config.sqlEditorTheme,
  });
  try {
    await saveManyGeneralConfigsApi(getToken() ?? '', payloads);
    notifyConfigsChanged();
    return true;
  } catch (error) {
    setState({
      modules: previousModules,
      octohubColors: previousOctohubColors,
      terminalTheme: previousTerminalTheme,
      sqlEditorTheme: previousSqlEditorTheme,
    });
    showError(errorMessageText, error);
    return false;
  }
}
