import { currentDictionary } from '../../i18n/TranslateError';
import type { UserDTO } from '../../../interfaces/AuthInterfaces';
import { CreateUserPayload } from '../../../interfaces/UsersInterface';
import { Create } from '../../../../bindings/docker-manager-go/src/user/handlers/userhandlerstruct';

export async function createUserApi(payload: CreateUserPayload): Promise<UserDTO> {
  const createdUser = await Create({
    nome: payload.name,
    email: payload.email,
    password: payload.password,
  });
  if (!createdUser) throw new Error(currentDictionary().app.auth.accountNotCreated);
  return createdUser;
}
