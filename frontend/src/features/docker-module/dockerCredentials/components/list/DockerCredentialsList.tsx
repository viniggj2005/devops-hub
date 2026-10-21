import React, { useMemo } from 'react';
import { CheckCircle2, Key, Trash2 } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { DockerCredentialService } from '../../services/DockerCredentialService';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';

const DockerCredentialsList: React.FC = () => {
  const { token } = useAuth();
  const confirmToast = useConfirmToast();
  const {
    refresh,
    credentials,
    selectedCredentialId,
    setSelectedCredentialId,
  } = useDockerClient();

  const sortedCredentials = useMemo(
    () => credentials.slice().sort((first, second) => first.alias.localeCompare(second.alias)),
    [credentials]
  );

  const handleDelete = (id: number, name: string) => {
    if (!token) return;
    confirmToast({
      id: `${id}`,
      title: 'Remover credencial?',
      message: `Deseja realmente excluir a conexão "${name}"?`,
      onConfirm: async () => {
        await DockerCredentialService.delete(token, id);
        await refresh();
      },
    });
  };

  if (sortedCredentials.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-2">
        <Key className="w-8 h-8 text-gray-400 dark:text-zinc-500 mx-auto" />
        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
          Nenhuma credencial cadastrada
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Clique em "Nova Conexão" para cadastrar certificados TLS de acesso ao seu daemon Docker.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sortedCredentials.map((credential) => {
        const isSelected = credential.id === selectedCredentialId;
        return (
          <div
            key={credential.id}
            onClick={() => setSelectedCredentialId(credential.id)}
            className={`group flex items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm transition-all cursor-pointer ${
              isSelected
                ? 'border-blue-500/60 bg-blue-500/[0.03] dark:border-blue-500/50 dark:bg-blue-500/[0.05]'
                : 'border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/60 hover:border-blue-500/30 dark:hover:border-white/15'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Key className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white truncate">
                    {credential.alias}
                  </h3>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Ativa
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 truncate">
                  <span className="truncate">
                    {credential.description ? credential.description : 'Sem descrição'}
                  </span>
                  {credential.createdAt && (
                    <>
                      <span className="text-gray-300 dark:text-zinc-700">•</span>
                      <span className="shrink-0">
                        {new Date(credential.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDelete(credential.id, credential.alias);
                }}
                title="Excluir conexão"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DockerCredentialsList;
