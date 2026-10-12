import { generalConfigsDtos } from '../../../../wailsjs/go/models';
import { SaveGeneralConfigPayload } from '../../../interfaces/GeneralConfigsInterfaces';
import {
  Save,
  FindAll,
  SaveMany,
  SaveThemeProfile,
  DeleteThemeProfile,
  FindAllThemeProfiles,
} from '../../../../wailsjs/go/generalConfigsHandlers/GeneralConfigsHandlerStruct';

const toSaveInput = (payload: SaveGeneralConfigPayload) => generalConfigsDtos.SaveGeneralConfigInputDto.createFrom({
  configType: payload.configType,
  moduleName: payload.moduleName,
  config: JSON.stringify(payload.config),
});

export async function findAllGeneralConfigsApi(token: string): Promise<generalConfigsDtos.GeneralConfigDto[]> {
  return FindAll(token);
}

export async function saveGeneralConfigApi(token: string, payload: SaveGeneralConfigPayload): Promise<generalConfigsDtos.GeneralConfigDto> {
  return Save(token, toSaveInput(payload));
}

export async function saveManyGeneralConfigsApi(token: string, payloads: SaveGeneralConfigPayload[]): Promise<generalConfigsDtos.GeneralConfigDto[]> {
  return SaveMany(token, payloads.map(toSaveInput));
}

export async function findAllThemeProfilesApi(token: string): Promise<generalConfigsDtos.ThemeProfileDto[]> {
  return FindAllThemeProfiles(token);
}

export async function saveThemeProfileApi(token: string, profile: { id: number; name: string; config: object }): Promise<generalConfigsDtos.ThemeProfileDto> {
  return SaveThemeProfile(token, generalConfigsDtos.SaveThemeProfileInputDto.createFrom({
    id: profile.id,
    name: profile.name,
    config: JSON.stringify(profile.config),
  }));
}

export async function deleteThemeProfileApi(token: string, profileId: number): Promise<void> {
  return DeleteThemeProfile(token, profileId);
}
