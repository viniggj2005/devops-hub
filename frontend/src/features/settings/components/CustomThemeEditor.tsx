import ColorField from './ColorField';
import React, { useCallback } from 'react';
import { Moon, RotateCcw, Sun } from 'lucide-react';
import { useDebouncedDraft } from '../hooks/useDebouncedDraft';
import { useTranslation } from '../../i18n/useTranslation';
import ThemeOptionPicker, { ThemeOption } from './ThemeOptionPicker';
import { useGeneralConfigsStore } from '../store/GeneralConfigsStore';
import { defaultCustomTheme } from '../../shared/constants/AppModules';
import { ThemeBase, ConfigurableModule, CustomThemeColors } from '../../../interfaces/GeneralConfigsInterfaces';

interface CustomThemeEditorProps {
  moduleName: ConfigurableModule;
}

const CustomThemeEditor: React.FC<CustomThemeEditorProps> = ({ moduleName }) => {
  const { dictionary } = useTranslation();
  const savedTheme = useGeneralConfigsStore(state => state.modules[moduleName].customTheme);
  const { common, customTheme: themeTexts } = dictionary.preferences;
  const baseOptions: ThemeOption<ThemeBase>[] = [
    { value: 'light', label: common.light, icon: Sun },
    { value: 'dark', label: common.dark, icon: Moon },
  ];
  const setModuleCustomTheme = useGeneralConfigsStore(state => state.setModuleCustomTheme);
  const saveTheme = useCallback(
    (customTheme: CustomThemeColors) => setModuleCustomTheme(moduleName, customTheme),
    [moduleName, setModuleCustomTheme],
  );
  const [draftTheme, setDraftTheme] = useDebouncedDraft(savedTheme, saveTheme);

  const updateDraft = (changes: Partial<CustomThemeColors>) => setDraftTheme(current => ({ ...current, ...changes }));

  return (
    <div className="mt-4 grid gap-5 border-t border-gray-200 dark:border-white/5 pt-5 lg:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ThemeOptionPicker
            options={baseOptions}
            label={themeTexts.base}
            selected={draftTheme.base}
            onSelect={base => updateDraft({ base })}
          />
          <button
            type="button"
            onClick={() => setDraftTheme(defaultCustomTheme(moduleName))}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <RotateCcw className="w-4 h-4" />
            {themeTexts.restoreColors}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField
            label={themeTexts.primary}
            value={draftTheme.primary}
            hint={themeTexts.primaryHint}
            onChange={primary => updateDraft({ primary })}
          />
          <ColorField
            label={themeTexts.background}
            value={draftTheme.background}
            hint={themeTexts.backgroundHint}
            onChange={background => updateDraft({ background })}
          />
          <ColorField
            label={themeTexts.text}
            value={draftTheme.text}
            hint={themeTexts.textHint}
            onChange={text => updateDraft({ text })}
          />
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{ backgroundColor: draftTheme.background, color: draftTheme.text }}
        className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 dark:border-white/10 p-4"
      >
        <div>
          <p className="text-xs uppercase tracking-wider opacity-60">{common.preview}</p>
          <p className="mt-1 font-semibold">{themeTexts.sampleTitle}</p>
          <p className="text-sm opacity-70">{themeTexts.sampleText}</p>
        </div>
        <span
          style={{ backgroundColor: draftTheme.primary }}
          className="self-start rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
        >
          {themeTexts.sampleAction}
        </span>
      </div>
    </div>
  );
};

export default CustomThemeEditor;
