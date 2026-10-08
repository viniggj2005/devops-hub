import { useAppStore } from '../features/appFrame/AppStore';
import { createContext, useContext, useEffect, useState } from 'react';
import { useGeneralConfigsStore } from '../features/settings/store/GeneralConfigsStore';
import { readStoredGlobalTheme } from '../features/settings/functions/StoredGlobalTheme';
import { configNameByModuleType, moduleByConfigName } from '../features/shared/constants/AppModules';
import {
  buildCustomThemeVariables,
  clearCustomThemeVariables,
  applyCustomThemeVariables,
} from '../features/settings/functions/CustomThemePalette';

export enum Themes {
  DARK = 'dark',
  LIGHT = 'light',
}

interface ThemeContextData {
  theme: Themes;
  globalTheme: Themes;
  toggleTheme: () => void;
  setGlobalTheme: (theme: Themes) => void;
}

const ThemeContext = createContext({} as ThemeContextData);
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return context;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const setModuleTheme = useGeneralConfigsStore(state => state.setModuleTheme);
  const setModuleCustomTheme = useGeneralConfigsStore(state => state.setModuleCustomTheme);
  const [globalTheme, setGlobalThemeState] = useState<Themes>(() => readStoredGlobalTheme() as Themes);
  const activeTabType = useAppStore(state => state.tabs.find(tab => tab.id === state.activeTabId)?.type);
  const activeModule = activeTabType ? configNameByModuleType[activeTabType] : undefined;
  const activeModuleConfig = useGeneralConfigsStore(state => (activeModule ? state.modules[activeModule] : undefined));

  const modulePreference = activeModuleConfig?.theme;
  const customTheme = modulePreference === 'custom' ? activeModuleConfig?.customTheme : undefined;

  let theme = modulePreference ? (modulePreference as Themes) : globalTheme;
  if (customTheme) theme = customTheme.base === 'dark' ? Themes.DARK : Themes.LIGHT;

  useEffect(() => {
    document.documentElement.classList.toggle(Themes.DARK, theme === Themes.DARK);
  }, [theme]);

  useEffect(() => {
    if (!customTheme || !activeModule) {
      clearCustomThemeVariables();
      return;
    }
    applyCustomThemeVariables(buildCustomThemeVariables(customTheme, [moduleByConfigName[activeModule].accentFamily, 'blue']));
  }, [customTheme, activeModule]);

  const setGlobalTheme = (nextTheme: Themes) => {
    localStorage.setItem('theme', nextTheme);
    setGlobalThemeState(nextTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === Themes.DARK ? Themes.LIGHT : Themes.DARK;
    if (activeModule && customTheme) {
      setModuleCustomTheme(activeModule, { ...customTheme, base: nextTheme });
      return;
    }
    if (activeModule) {
      setModuleTheme(activeModule, nextTheme);
      return;
    }
    setGlobalTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, globalTheme, toggleTheme, setGlobalTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
