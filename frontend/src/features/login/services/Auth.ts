import { MyInfo } from '../../../../wailsjs/go/handlers/UserHandlerStruct';
import { Login, Logout } from '../../../../wailsjs/go/authHandlers/AuthHandlerStruct';

export const myInfo = (token: string) => MyInfo(token);

export async function logoutApi(token: string) {
  return Logout(token);
}
export async function loginApi(email: string, password: string) {
  return Login({ email, password });
}
