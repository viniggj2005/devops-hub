import toast from 'react-hot-toast';
import { getToken } from '../../../contexts/AuthContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { useTranslation } from '../../i18n/useTranslation';
import { AlertTriangle, Cloud, CloudUpload, Loader2, LogIn, LogOut, X } from 'lucide-react';
import {
  CloudSyncStatus,
  connectGoogleDriveApi,
  uploadDatabaseNowApi,
  findCloudSyncStatusApi,
  disconnectGoogleDriveApi,
} from '../services/CloudSyncService';

type CloudSyncAction = 'connecting' | 'uploading' | 'disconnecting';

const primaryButtonClass =
  'flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const secondaryButtonClass =
  'flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const formatMoment = (isoMoment: string, fallback: string, language: string) =>
  isoMoment ? new Date(isoMoment).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' }) : fallback;

const CloudSyncSettings: React.FC = () => {
  const { language, dictionary, formatMessage } = useTranslation();
  const [status, setStatus] = useState<CloudSyncStatus | null>(null);
  const syncTexts = dictionary.preferences.cloudSync;
  const [action, setAction] = useState<CloudSyncAction | null>(null);
  const loginCancelled = useRef(false);
  const pendingLogin = useRef<ReturnType<typeof connectGoogleDriveApi> | null>(null);

  const cancelLogin = () => {
    loginCancelled.current = true;
    pendingLogin.current?.cancel();
  };

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await findCloudSyncStatusApi(getToken() ?? ''));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    loadStatus();
    return () => {
      loginCancelled.current = true;
      pendingLogin.current?.cancel();
    };
  }, [loadStatus]);

  const runAction = async (nextAction: CloudSyncAction, operation: () => Promise<CloudSyncStatus | void>, successMessage: string) => {
    setAction(nextAction);
    try {
      const nextStatus = await operation();
      if (nextStatus) setStatus(nextStatus);
      else await loadStatus();
      toast.success(successMessage);
    } catch (error) {
      if (!loginCancelled.current) toast.error(errorMessage(error));
    } finally {
      loginCancelled.current = false;
      pendingLogin.current = null;
      setAction(null);
    }
  };

  const connect = () =>
    runAction('connecting', () => {
      pendingLogin.current = connectGoogleDriveApi(getToken() ?? '');
      return pendingLogin.current;
    }, syncTexts.connected);

  const uploadNow = () =>
    runAction('uploading', () => uploadDatabaseNowApi(getToken() ?? ''), syncTexts.uploaded);

  const disconnect = () =>
    runAction('disconnecting', () => disconnectGoogleDriveApi(getToken() ?? ''), syncTexts.disconnected);

  const busy = action !== null;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">{syncTexts.title}</h2>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">
          {syncTexts.description}
        </p>
      </header>

      {status && !status.configured && !status.connected && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {syncTexts.notConfigured}
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-white/5 p-5 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shrink-0">
              <Cloud className="w-8 h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg">Google Drive</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                {!status ? syncTexts.loading : status.connected ? status.accountEmail : syncTexts.noAccount}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {action === 'connecting' && (
              <>
                <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {syncTexts.waitingLogin}
                </span>
                <button type="button" onClick={cancelLogin} className={secondaryButtonClass}>
                  <X className="w-4 h-4" />
                  {dictionary.app.common.cancel}
                </button>
              </>
            )}
            {action !== 'connecting' && status && !status.connected && (
              <button type="button" onClick={connect} disabled={busy || !status.configured} className={primaryButtonClass}>
                <LogIn className="w-4 h-4" />
                {syncTexts.signIn}
              </button>
            )}
            {status?.connected && (
              <>
                <button type="button" onClick={uploadNow} disabled={busy} className={primaryButtonClass}>
                  {action === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                  {syncTexts.uploadNow}
                </button>
                <button type="button" onClick={disconnect} disabled={busy} className={secondaryButtonClass}>
                  <LogOut className="w-4 h-4" />
                  {syncTexts.disconnect}
                </button>
              </>
            )}
          </div>
        </div>

        {status?.connected && (
          <dl className="grid sm:grid-cols-2 gap-4 border-t border-gray-200 dark:border-white/5 pt-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-zinc-400">{syncTexts.lastUpload}</dt>
              <dd className="font-semibold mt-0.5">{formatMoment(status.lastSyncedAt, syncTexts.notUploaded, language)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-zinc-400">{syncTexts.cloudVersion}</dt>
              <dd className="font-semibold mt-0.5">
                {status.remoteError ? syncTexts.unavailable : formatMoment(status.remoteSyncedAt, syncTexts.noneYet, language)}
              </dd>
            </div>
          </dl>
        )}

        {status?.connected && status.remoteError && (
          <p className="text-sm text-red-500 dark:text-red-400">{formatMessage(syncTexts.queryFailed, { error: status.remoteError })}</p>
        )}

        {status?.connected && status.restorePending && (
          <div className="flex flex-col md:flex-row md:items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="flex-1">
              {formatMessage(syncTexts.newerInCloud, { date: formatMoment(status.remoteSyncedAt, '', language) })}
            </p>
            <button type="button" onClick={uploadNow} disabled={busy} className={secondaryButtonClass}>
              {syncTexts.keepLocal}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/5 p-5">
        <h3 className="font-semibold mb-3">{syncTexts.howItWorks}</h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-zinc-400 list-disc pl-5">
          {syncTexts.howItWorksSteps.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default CloudSyncSettings;
