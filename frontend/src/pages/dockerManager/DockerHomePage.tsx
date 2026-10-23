import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Key, RefreshCcw, Server } from 'lucide-react';
import { useDockerClient } from '../../contexts/DockerClientContext';
import React, { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../features/shared/functions/ErrorMessage';
import * as dockerDtos from '../../../bindings/docker-manager-go/src/dockermanager/dtos/models';
import StatsGrid from '../../features/docker-module/dashboard/components/cards/StatsGrid';
import RecentActivity from '../../features/docker-module/dashboard/components/cards/RecentActivity';
import ManagementCards from '../../features/docker-module/dashboard/components/cards/ManagementCards';
import { GetInfo } from '../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';

const DockerHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [info, setInfo] = useState<dockerDtos.SystemInfoDto | null>(null);
  const { connecting, credentials, dockerClientId, selectedCredentialId } = useDockerClient();

  const activeCredential = credentials.find((credential) => credential.id === selectedCredentialId) ?? null;

  const fetchInfo = useCallback(async () => {
    if (!dockerClientId || dockerClientId !== selectedCredentialId) {
      setInfo(null);
      return;
    }

    try {
      setLoadingInfo(true);
      const data = await GetInfo(dockerClientId);
      setInfo(data);
    } catch (error) {
      setInfo(null);
      toast.error(`Falha ao buscar informações do sistema: ${errorMessage(error)}`);
    } finally {
      setLoadingInfo(false);
    }
  }, [dockerClientId, selectedCredentialId]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Visão Geral do Ambiente
            </h1>
            {activeCredential && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Server className="w-3 h-3" />
                {activeCredential.alias}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {info
              ? `Host ${info.Name} • ${info.OperatingSystem} • Docker Engine v${info.ServerVersion} (${info.Architecture})`
              : connecting
                ? 'Estabelecendo conexão TLS com o daemon Docker...'
                : 'Acompanhe recursos, contêineres, imagens, volumes e redes do seu host Docker.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/docker/credentials')}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 hover:border-blue-500/40 text-xs font-semibold text-gray-700 dark:text-zinc-200 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-blue-500" />
            <span>Credenciais</span>
          </button>

          <button
            type="button"
            onClick={fetchInfo}
            disabled={!dockerClientId || loadingInfo || connecting}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loadingInfo ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {!selectedCredentialId && !connecting && (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Nenhuma credencial Docker ativa
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Cadastre ou selecione uma credencial TLS para conectar ao seu daemon Docker remoto ou local.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/docker/credentials')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shrink-0 transition-colors cursor-pointer"
          >
            Configurar Credencial
          </button>
        </div>
      )}

      <StatsGrid info={info} />
      <ManagementCards />
      <RecentActivity info={info} />
    </div>
  );
};

export default DockerHomePage;
