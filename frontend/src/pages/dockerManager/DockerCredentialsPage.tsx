import { Plus, RefreshCcw } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDockerClient } from '../../contexts/DockerClientContext';
import DockerCredentialsList from '../../features/docker-module/dockerCredentials/components/list/DockerCredentialsList';
import { CreateDockerCredentialModal } from '../../features/docker-module/dockerCredentials/components/modals/CreateDockerCredentialModal';

const DockerCredentialsPage: React.FC = () => {
  const { user, token } = useAuth();
  const { loading, refresh } = useDockerClient();
  const [showNewCredentialForm, setShowNewCredentialForm] = useState(false);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-white/5">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Credenciais Docker
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Gerencie conexões TLS do Docker para acessar servidores remotos ou daemons protegidos.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl hover:border-blue-500/40 disabled:opacity-50 transition-all flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-200 cursor-pointer"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewCredentialForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Conexão</span>
          </button>
        </div>
      </div>

      <CreateDockerCredentialModal
        open={showNewCredentialForm}
        onClose={() => setShowNewCredentialForm(false)}
        token={token || ''}
        userId={user?.id || 0}
        refresh={refresh}
      />

      <DockerCredentialsList />
    </div>
  );
};

export default DockerCredentialsPage;
