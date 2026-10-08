import { generalConfigsDtos } from '../../../../wailsjs/go/models';
import { SaveGeneralConfigPayload } from '../../../interfaces/GeneralConfigsInterfaces';
import { FindAll, Save } from '../../../../wailsjs/go/generalConfigsHandlers/GeneralConfigsHandlerStruct';

export async function findAllGeneralConfigsApi(token: string): Promise<generalConfigsDtos.GeneralConfigDto[]> {
  return FindAll(token);
}

export async function saveGeneralConfigApi(token: string, payload: SaveGeneralConfigPayload): Promise<generalConfigsDtos.GeneralConfigDto> {
  return Save(token, generalConfigsDtos.SaveGeneralConfigInputDto.createFrom({
    configType: payload.configType,
    moduleName: payload.moduleName,
    config: JSON.stringify(payload.config),
  }));
}
