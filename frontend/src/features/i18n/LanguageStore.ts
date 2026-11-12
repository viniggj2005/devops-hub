import { create } from 'zustand';
import toast from 'react-hot-toast';
import { Events } from '@wailsio/runtime';
import { updateLanguageApi } from './LanguageService';
import { getToken } from '../../contexts/AuthContext';
import { windowInstanceId } from '../appFrame/WindowContext';
import { errorMessage } from '../shared/functions/ErrorMessage';
import {
  AppLanguage,
  dictionaries,
  isAppLanguage,
  formatMessage,
  resolveBrowserLanguage,
} from './Languages';

interface LanguageState {
  saving: boolean;
  language: AppLanguage;
  applyLanguage: (language: unknown) => void;
  setLanguage: (language: AppLanguage) => Promise<void>;
}

export const languageChangedEvent = 'user:language-changed';

const storageKey = 'language';

const readStoredLanguage = (): AppLanguage => {
  try {
    const storedLanguage = localStorage.getItem(storageKey);
    return isAppLanguage(storedLanguage) ? storedLanguage : resolveBrowserLanguage();
  } catch {
    return resolveBrowserLanguage();
  }
};

const persistLanguage = (language: AppLanguage) => {
  document.documentElement.lang = language;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    return;
  }
};

export const useLanguageStore = create<LanguageState>((set, get) => ({
  saving: false,
  language: readStoredLanguage(),

  applyLanguage: language => {
    if (!isAppLanguage(language) || language === get().language) return;
    persistLanguage(language);
    set({ language });
  },

  setLanguage: async language => {
    const previousLanguage = get().language;
    if (language === previousLanguage) return;
    persistLanguage(language);
    set({ language, saving: true });
    const token = getToken();
    try {
      if (token) await updateLanguageApi(token, language);
      Events.Emit(languageChangedEvent, { language, originWindowId: windowInstanceId });
      toast.success(dictionaries[language].settings.language.saved);
    } catch (error) {
      persistLanguage(previousLanguage);
      set({ language: previousLanguage });
      toast.error(formatMessage(dictionaries[previousLanguage].settings.language.saveError, { error: errorMessage(error) }));
    } finally {
      set({ saving: false });
    }
  },
}));

document.documentElement.lang = useLanguageStore.getState().language;
