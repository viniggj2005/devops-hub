import type { AppTab } from './AppStore';
import type { Dictionary } from '../i18n/Languages';

export const tabTitle = (tab: AppTab, dictionary: Dictionary) => {
  if (tab.type === 'home') return dictionary.app.tabs.home;
  if (tab.type === 'settings') return dictionary.settings.title;
  return tab.title;
};
