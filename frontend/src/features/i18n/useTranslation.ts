import { useLanguageStore } from './LanguageStore';
import { dictionaries, formatMessage } from './Languages';

export const useTranslation = () => {
  const language = useLanguageStore(state => state.language);
  return { language, dictionary: dictionaries[language], formatMessage };
};
