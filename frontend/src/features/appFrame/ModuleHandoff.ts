import type { ModuleType } from './AppStore';

export interface ModuleHandoff {
  release: () => void;
  capture: () => string;
  adopt: (payload: string) => void;
}

const handoffs = new Map<ModuleType, ModuleHandoff>();

export function registerModuleHandoff(module: ModuleType, handoff: ModuleHandoff) {
  handoffs.set(module, handoff);
}

export function captureModuleHandoff(module: ModuleType) {
  return handoffs.get(module)?.capture() ?? '';
}

export function releaseModuleHandoff(module: ModuleType) {
  handoffs.get(module)?.release();
}

export function adoptModuleHandoff(module: ModuleType, payload: string | undefined) {
  if (payload) handoffs.get(module)?.adopt(payload);
}
