import React from 'react';
import { EyeOff } from 'lucide-react';
import SettingsModuleRow from './SettingsModuleRow';
import { useTranslation } from '../../i18n/useTranslation';
import { appModules } from '../../shared/constants/AppModules';
import { useGeneralConfigsStore } from '../store/GeneralConfigsStore';
import ToggleSwitch from '../../shared/components/forms/ToggleSwitch';

const HomeModulesSettings: React.FC = () => {
  const { dictionary, formatMessage } = useTranslation();
  const modules = useGeneralConfigsStore(state => state.modules);
  const setShowOnHome = useGeneralConfigsStore(state => state.setShowOnHome);
  const allHidden = appModules.every(module => !modules[module.configName].showOnHome);
  const homeModulesTexts = dictionary.settings.homeModules;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">{homeModulesTexts.title}</h2>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">{homeModulesTexts.description}</p>
      </header>

      {allHidden && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <EyeOff className="w-4 h-4 shrink-0" />
          {homeModulesTexts.allHidden}
        </div>
      )}

      <div className="space-y-3">
        {appModules.map(module => (
          <SettingsModuleRow
            key={module.id}
            icon={module.icon}
            title={module.title}
            color={module.color}
            moduleName={module.configName}
            description={dictionary.app.modules[module.configName]}
          >
            <ToggleSwitch
              label={formatMessage(homeModulesTexts.showOnHome, { module: module.title })}
              checked={modules[module.configName].showOnHome}
              onChange={checked => setShowOnHome(module.configName, checked)}
            />
          </SettingsModuleRow>
        ))}
      </div>
    </section>
  );
};

export default HomeModulesSettings;
