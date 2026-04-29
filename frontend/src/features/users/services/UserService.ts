import type { UserDTO } from '../../../interfaces/AuthInterfaces';
import { CreateUserPayload } from '../../../interfaces/UsersInterface';
import { Create } from '../../../../wailsjs/go/userHandlers/UserHandlerStruct';

export async function createUserApi(payload: CreateUserPayload): Promise<UserDTO> {
  return Create({
    nome: payload.name,
    email: payload.email,
    password: payload.password,
  });
}
