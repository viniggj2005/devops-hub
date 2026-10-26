import toast from 'react-hot-toast';
import { errorMessage } from '../shared/functions/ErrorMessage';
import { CloudDownload, Loader2, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudSyncStatus, findLoginScreenCloudStatusApi, connectGoogleDriveFromLoginApi, restoreFromCloudAndRestartApi } from '../settings/services/CloudSyncService';

type PanelAction = 'checking' | 'connecting' | 'restoring';

const outlineButtonClass =
  'w-full py-2.5 px-4 border border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-200 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const formatMoment = (isoMoment: string) =>
  new Date(isoMoment).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const CloudRestorePanel: React.FC = () => {
  const [status, setStatus] = useState<CloudSyncStatus | null>(null);
  const [action, setAction] = useState<PanelAction | null>('checking');
  const loginCancelled = useRef(false);
  const pendingLogin = useRef<ReturnType<typeof connectGoogleDriveFromLoginApi> | null>(null);

  const checkCloud = useCallback(async () => {
    setAction('checking');
    try {
      setStatus(await findLoginScreenCloudStatusApi());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAction(null);
    }
  }, []);

  useEffect(() => {
    checkCloud();
    return () => {
      loginCancelled.current = true;
      pendingLogin.current?.cancel();
    };
  }, [checkCloud]);

  const connect = async () => {
    setAction('connecting');
    try {
      pendingLogin.current = connectGoogleDriveFromLoginApi();
      const nextStatus = await pendingLogin.current;
      setStatus(nextStatus);
      if (!nextStatus.remoteSyncedAt) toast('Nenhum backup encontrado nesta conta do Google.');
    } catch (error) {
      if (!loginCancelled.current) toast.error(errorMessage(error));
    } finally {
      loginCancelled.current = false;
      pendingLogin.current = null;
      setAction(null);
    }
  };

  const cancelLogin = () => {
    loginCancelled.current = true;
    pendingLogin.current?.cancel();
  };

  const restore = async () => {
    setAction('restoring');
    try {
      await restoreFromCloudAndRestartApi();
    } catch (error) {
      toast.error(errorMessage(error));
      setAction(null);
    }
  };

  if (!status?.configured && !status?.connected) return null;

  if (action === 'restoring') {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs text-blue-200 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        Restaurando o backup do Google Drive. O app vai reiniciar em instantes…
      </div>
    );
  }

  if (action === 'connecting') {
    return (
      <div className="flex items-center gap-3">
        <span className="flex-1 flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Aguardando o login no navegador…
        </span>
        <button
          type="button"
          onClick={cancelLogin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={connect} disabled={action !== null} className={outlineButtonClass}>
          <CloudDownload className="w-4 h-4 text-blue-400" />
          Restaurar do Google Drive
        </button>
        <p className="text-[11px] text-zinc-500 text-center">
          Já usa o Devops Hub em outro computador? Entre com o Google para trazer seus dados.
        </p>
      </div>
    );
  }

  if (status.restorePending) {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
        <p className="text-xs text-zinc-200 leading-relaxed">
          Encontramos um backup de <strong>{formatMoment(status.remoteSyncedAt)}</strong> em{' '}
          <strong>{status.accountEmail}</strong>. Ao restaurar, o app reinicia com esses dados, e o banco atual deste computador fica
          guardado como cópia.
        </p>
        <button type="button" onClick={restore} className={outlineButtonClass}>
          <CloudDownload className="w-4 h-4 text-blue-400" />
          Restaurar e reiniciar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
      <span className="truncate">
        {status.remoteError
          ? `Não foi possível consultar o Google Drive de ${status.accountEmail}.`
          : status.remoteSyncedAt
            ? `Sincronizado com o Google Drive de ${status.accountEmail}.`
            : `Conectado a ${status.accountEmail}, ainda sem backup na nuvem.`}
      </span>
      <button
        type="button"
        onClick={checkCloud}
        disabled={action !== null}
        title="Verificar de novo"
        className="p-1 rounded-md hover:bg-white/5 hover:text-zinc-300 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${action === 'checking' ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

export default CloudRestorePanel;
