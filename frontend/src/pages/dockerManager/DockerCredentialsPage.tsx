import { Plus } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDockerClient } from '../../contexts/DockerClientContext';
import DockerCredentialsList from '../../features/docker-module/dockerCredentials/components/list/DockerCredentialsList';
import { CreateDockerCredentialModal } from '../../features/docker-module/dockerCredentials/components/modals/CreateDockerCredentialModal';


const DockerCredentialsPage: React.FC = () => {
  const { user, token } = useAuth();
  const { refresh } = useDockerClient();
  const [showNewCredentialForm, setShowNewCredentialForm] = useState(false);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Credenciais Docker
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Gerencie conexões TLS do Docker para acessar servidores remotos.
        </p>
      </div>
      <div className="mb-6">
        <button
          onClick={() => setShowNewCredentialForm(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[0.99] hover:bg-blue-700 hover:shadow-md sm:w-fit"
        >
          <Plus className="h-5 w-5" />
          Nova conexão
        </button>
      </div>
      <CreateDockerCredentialModal
        open={showNewCredentialForm}
        onClose={() => setShowNewCredentialForm(false)}
        token={token || ''}
        userId={user?.id || 0}
        refresh={refresh}
      />

      <div className="space-y-4">
        <DockerCredentialsList />
      </div>
    </div>
  );
};

export default DockerCredentialsPage;

