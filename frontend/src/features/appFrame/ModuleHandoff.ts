import type { ModuleType } from './AppStore';

export interface ModuleHandoff {
  release: () => void;
  capture: () => string;
  adopt: (payload: string) => void;
}

const handoffs = new Map<ModuleType, ModuleHandoff>();
const pendingPayloads = new Map<ModuleType, string>();

export function registerModuleHandoff(module: ModuleType, handoff: ModuleHandoff) {
  handoffs.set(module, handoff);
  const pendingPayload = pendingPayloads.get(module);
  if (pendingPayload === undefined) return;
  pendingPayloads.delete(module);
  handoff.adopt(pendingPayload);
}

export function captureModuleHandoff(module: ModuleType) {
  return handoffs.get(module)?.capture() ?? '';
}

export function releaseModuleHandoff(module: ModuleType) {
  handoffs.get(module)?.release();
}

export function adoptModuleHandoff(module: ModuleType, payload: string | undefined) {
  if (!payload) return;
  const handoff = handoffs.get(module);
  if (handoff) handoff.adopt(payload);
  else pendingPayloads.set(module, payload);
}
