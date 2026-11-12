import { ptBR } from './dictionaries/ptBR';
import { enUS } from './dictionaries/enUS';
import { esES } from './dictionaries/esES';

export type Dictionary = typeof ptBR;

export type AppLanguage = 'pt-BR' | 'en-US' | 'es-ES';

export const defaultLanguage: AppLanguage = 'pt-BR';

export const dictionaries: Record<AppLanguage, Dictionary> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': esES,
};

export const supportedLanguages = Object.keys(dictionaries) as AppLanguage[];

export const isAppLanguage = (value: unknown): value is AppLanguage =>
  supportedLanguages.includes(value as AppLanguage);

export const nativeLanguageName = (language: AppLanguage) => dictionaries[language].languages[language];

export const resolveBrowserLanguage = (): AppLanguage => {
  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith('es')) return 'es-ES';
  if (browserLanguage.startsWith('en')) return 'en-US';
  return defaultLanguage;
};

export const formatMessage = (template: string, params: Record<string, string | number | null | undefined>) =>
  template.replace(/\{(\w+)\}/g, (placeholder, paramName: string) =>
    paramName in params ? String(params[paramName] ?? '') : placeholder);
