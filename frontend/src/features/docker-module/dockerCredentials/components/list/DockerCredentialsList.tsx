import iziToast from 'izitoast';
import { useMemo, useEffect } from "react";
import { Key, Trash2 } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { DockerCredentialService } from "../../services/DockerCredentialService";
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';

const DockerCredentialsList: React.FC = () => {
    const { token } = useAuth();
    const confirmToast = useConfirmToast();
    const {
        refresh,
        connecting,
        credentials,
    } = useDockerClient();
    const sortedCredentials = useMemo(
        () => credentials.slice().sort((a, b) => a.alias.localeCompare(b.alias)),
        [credentials]
    );
    const handleDelete = (id: number, name: string) => {
        if (!token) return;
        confirmToast({
            id: `${id}`,
            title: `Conexão ${name} deletada!`,
            message: `Deseja deletar A conexão ${name} docker?`,
            onConfirm: async () => {
                await DockerCredentialService.delete(token, id)
                await refresh()
            },
        });
    };

    useEffect(() => {
        if (sortedCredentials.length === 0) {
            iziToast.info({
                title: 'Vazio',
                message: 'Nenhuma credencial cadastrada até o momento.',
                position: 'bottomRight',
            });
        }
        if (connecting) {
            iziToast.info({
                title: 'Conectando',
                message: 'Estabelecendo conexão segura com o Docker remoto...',
                position: 'bottomRight',
            });
        }
    }, [sortedCredentials.length, connecting]);

    return (
        <div>
            {sortedCredentials.length > 0 && (
                <div className="space-y-4">
                    {sortedCredentials.map((credential) => {
                        return (
                            <div
                                key={credential.id}
                                className="group flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                                        <Key className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                                            {credential.alias}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                            <span>
                                                {credential.description ? credential.description : "N/A"}
                                            </span>
                                            {credential.createdAt && (
                                                <>
                                                    <span className="text-gray-300 dark:text-gray-700">•</span>
                                                    <span>Criado em {new Date(credential.createdAt).toLocaleDateString('pt-BR')}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(credential.id, credential.alias);
                                        }}
                                        title="Excluir Conexão"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
export default DockerCredentialsList;

