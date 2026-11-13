import type { AppLanguage } from './Languages';
import type { UserDTO } from '../../interfaces/AuthInterfaces';
import { Language } from '../../../bindings/docker-manager-go/src/models/models';
import { UpdateLanguage } from '../../../bindings/docker-manager-go/src/user/handlers/userhandlerstruct';

export async function updateLanguageApi(token: string, language: AppLanguage): Promise<UserDTO> {
  const updatedUser = await UpdateLanguage(token, language as Language);
  if (!updatedUser) throw new Error('language was not saved');
  return updatedUser;
}
