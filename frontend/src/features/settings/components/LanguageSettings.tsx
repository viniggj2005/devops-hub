import React from 'react';
import { Check, Languages } from 'lucide-react';
import { useLanguageStore } from '../../i18n/LanguageStore';
import { useTranslation } from '../../i18n/useTranslation';
import { nativeLanguageName, supportedLanguages } from '../../i18n/Languages';

const LanguageSettings: React.FC = () => {
  const { language, dictionary } = useTranslation();
  const saving = useLanguageStore(state => state.saving);
  const setLanguage = useLanguageStore(state => state.setLanguage);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">{dictionary.settings.language.title}</h2>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">{dictionary.settings.language.description}</p>
      </header>

      <div role="radiogroup" aria-label={dictionary.settings.language.title} className="space-y-3">
        {supportedLanguages.map(supportedLanguage => {
          const isSelected = supportedLanguage === language;
          const nativeName = nativeLanguageName(supportedLanguage);
          const translatedName = dictionary.languages[supportedLanguage];
          return (
            <button
              type="button"
              role="radio"
              disabled={saving}
              key={supportedLanguage}
              aria-checked={isSelected}
              onClick={() => setLanguage(supportedLanguage)}
              className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${isSelected
                ? 'border-blue-500/60 bg-blue-500/10'
                : 'border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-white/5'}`}
            >
              <div className={`p-3 rounded-xl shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400'}`}>
                <Languages className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg">{nativeName}</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  {translatedName === nativeName ? supportedLanguage : `${translatedName} · ${supportedLanguage}`}
                </p>
              </div>
              {isSelected && <Check className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default LanguageSettings;
