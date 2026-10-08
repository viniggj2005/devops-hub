import React from 'react';
import SettingsModuleRow from './SettingsModuleRow';
import CustomThemeEditor from './CustomThemeEditor';
import { Moon, Sun, Home, Palette } from 'lucide-react';
import { Themes, useTheme } from '../../../hooks/use-theme';
import { appModules } from '../../shared/constants/AppModules';
import ThemeOptionPicker, { ThemeOption } from './ThemeOptionPicker';
import { useGeneralConfigsStore } from '../store/GeneralConfigsStore';
import { ModuleThemePreference } from '../../../interfaces/GeneralConfigsInterfaces';

const globalThemeOptions: ThemeOption<Themes>[] = [
  { value: Themes.LIGHT, label: 'Claro', icon: Sun },
  { value: Themes.DARK, label: 'Escuro', icon: Moon },
];

const moduleThemeOptions: ThemeOption<ModuleThemePreference>[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'custom', label: 'Personalizado', icon: Palette },
];

const ModuleThemeSettings: React.FC = () => {
  const { globalTheme, setGlobalTheme } = useTheme();
  const modules = useGeneralConfigsStore(state => state.modules);
  const setModuleTheme = useGeneralConfigsStore(state => state.setModuleTheme);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Tema por módulo</h2>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">
          Cada módulo pode usar o tema claro, o escuro ou cores personalizadas. O botão de sol/lua dentro de um módulo altera só o tema dele.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-5">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shrink-0 self-start sm:self-center">
          <Home className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">Tela inicial</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Tema da tela inicial e das configurações.
          </p>
        </div>
        <ThemeOptionPicker
          label="Tema da tela inicial"
          selected={globalTheme}
          options={globalThemeOptions}
          onSelect={setGlobalTheme}
        />
      </div>

      <div className="space-y-3">
        {appModules.map(module => (
          <SettingsModuleRow
            key={module.id}
            icon={module.icon}
            title={module.title}
            color={module.color}
            description={module.description}
            expandedContent={modules[module.configName].theme === 'custom' && (
              <CustomThemeEditor moduleName={module.configName} />
            )}
          >
            <ThemeOptionPicker
              label={`Tema do ${module.title}`}
              options={moduleThemeOptions}
              selected={modules[module.configName].theme}
              onSelect={theme => setModuleTheme(module.configName, theme)}
            />
          </SettingsModuleRow>
        ))}
      </div>
    </section>
  );
};

export default ModuleThemeSettings;
