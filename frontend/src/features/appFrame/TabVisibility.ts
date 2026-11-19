import { createContext, useContext, useSyncExternalStore } from 'react';

export const TabVisibilityContext = createContext(true);

const isDocumentVisible = () => document.visibilityState === 'visible';

const subscribeToDocumentVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

export function useTabVisible() {
  const tabActive = useContext(TabVisibilityContext);
  const documentVisible = useSyncExternalStore(subscribeToDocumentVisibility, isDocumentVisible);
  return tabActive && documentVisible;
}
