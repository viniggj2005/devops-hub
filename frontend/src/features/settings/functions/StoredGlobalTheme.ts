import { ThemeBase } from '../../../interfaces/GeneralConfigsInterfaces';

export const readStoredGlobalTheme = (): ThemeBase => {
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
