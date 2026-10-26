import type { CloudSyncStatusDto } from '../../../../bindings/docker-manager-go/src/cloudSync/dtos/models';
import {
  Status,
  Connect,
  UploadNow,
  Disconnect,
  LoginScreenStatus,
  RestoreAndRestart,
  ConnectFromLoginScreen,
} from '../../../../bindings/docker-manager-go/src/cloudSync/handlers/cloudsynchandlerstruct';

export type CloudSyncStatus = CloudSyncStatusDto;

export async function findCloudSyncStatusApi(token: string): Promise<CloudSyncStatus> {
  return Status(token);
}

export function connectGoogleDriveApi(token: string) {
  return Connect(token);
}

export async function uploadDatabaseNowApi(token: string): Promise<CloudSyncStatus> {
  return UploadNow(token);
}

export async function disconnectGoogleDriveApi(token: string): Promise<void> {
  return Disconnect(token);
}

export async function findLoginScreenCloudStatusApi(): Promise<CloudSyncStatus> {
  return LoginScreenStatus();
}

export function connectGoogleDriveFromLoginApi() {
  return ConnectFromLoginScreen();
}

export async function restoreFromCloudAndRestartApi(): Promise<void> {
  return RestoreAndRestart();
}
