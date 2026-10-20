import type { ModuleType } from './AppStore';

const detachableModules: ModuleType[] = ['docker', 'octohub', 'talpadb', 'settings', 'ferretshell'];

const readDetachedModule = (): ModuleType | null => {
  const requestedModule = new URLSearchParams(window.location.search).get('module');
  return detachableModules.find(module => module === requestedModule) ?? null;
};

export const detachedModule = readDetachedModule();

export const isDetachedWindow = detachedModule !== null;

export const windowInstanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const isDetachableModule = (type: ModuleType) => detachableModules.includes(type);
