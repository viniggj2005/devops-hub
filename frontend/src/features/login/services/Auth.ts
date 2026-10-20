import { MyInfo } from '../../../../bindings/docker-manager-go/src/user/handlers/userhandlerstruct';
import { ClaimWindowSession, Login, Logout } from '../../../../bindings/docker-manager-go/src/auth/handlers/authhandlerstruct';

export const myInfo = (token: string) => MyInfo(token);

export async function logoutApi(token: string) {
  return Logout(token);
}
export async function loginApi(email: string, password: string) {
  return Login({ email, password });
}
export async function claimWindowSessionApi() {
  return ClaimWindowSession();
}
