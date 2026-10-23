import { ModuleType } from '../AppStore';
import { TabDropOutcome } from '../../../../bindings/docker-manager-go/src/desktop/dtos/models';
import {
  DropModule,
  DetachModule,
  PreviewTabDrop,
  ClaimModuleHandoff,
  ClearTabDropPreview,
  MoveModuleToMainWindow,
} from '../../../../bindings/docker-manager-go/src/desktop/handlers/windowhandlerstruct';

export interface ScreenPoint {
  screenX: number;
  screenY: number;
}

const toScreenPoint = (dropPoint?: ScreenPoint) => ({
  screenX: Math.round(dropPoint?.screenX ?? 0),
  screenY: Math.round(dropPoint?.screenY ?? 0),
});

export async function detachModuleApi(token: string, module: ModuleType, handoff: string, dropPoint?: ScreenPoint): Promise<void> {
  await DetachModule(token, { module, handoff, ...toScreenPoint(dropPoint) });
}

export async function dropModuleApi(
  token: string,
  module: ModuleType,
  handoff: string,
  dropPoint: ScreenPoint,
  allowNewWindow: boolean,
): Promise<boolean> {
  const result = await DropModule(token, { module, handoff, allowNewWindow, ...toScreenPoint(dropPoint) });
  return result.outcome !== TabDropOutcome.TabDropIgnored;
}

export async function moveModuleToMainWindowApi(token: string, module: ModuleType, handoff: string): Promise<void> {
  await MoveModuleToMainWindow(token, { module, handoff });
}

export async function claimModuleHandoffApi(): Promise<string> {
  return ClaimModuleHandoff();
}

export async function previewTabDropApi(dropPoint: ScreenPoint): Promise<boolean> {
  return PreviewTabDrop(toScreenPoint(dropPoint));
}

export async function clearTabDropPreviewApi(): Promise<void> {
  await ClearTabDropPreview();
}
