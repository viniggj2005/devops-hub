import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { CloudUpload, Globe, Lock } from 'lucide-react';
import { Modal } from '../../shared/components/modals/Modal';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { ListGithubOwners } from '../../../../bindings/docker-manager-go/src/octohub/handlers/repositoryhandler';

const PublishRepositoryModal: React.FC = () => {
    const { token } = useAuth();
    const [name, setName] = useState('');
    const [owner, setOwner] = useState('');
    const [owners, setOwners] = useState<string[]>([]);
    const [isPrivate, setIsPrivate] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [description, setDescription] = useState('');
    const [ownersError, setOwnersError] = useState<string | null>(null);
    const { repository, githubAccount, publishModalOpen, closePublishModal, publishRepository } = useOctohubRepository();

    useEffect(() => {
        if (!publishModalOpen || !token || !githubAccount) return;
        setIsPrivate(true);
        setDescription('');
        setOwnersError(null);
        setName(repository?.name ?? '');
        setOwner(githubAccount.login);
        setOwners([githubAccount.login]);
        ListGithubOwners(token)
            .then((list) => setOwners(list?.length ? list : [githubAccount.login]))
            .catch((error) => setOwnersError(errorMessage(error)));
    }, [publishModalOpen, token, githubAccount?.id, repository?.id]);

    const repositoryName = name.trim().replace(/\s+/g, '-');

    const close = () => {
        if (!publishing) closePublishModal();
    };

    const handlePublish = async () => {
        if (!repositoryName || !owner || publishing) return;
        setPublishing(true);
        const published = await publishRepository({ name: repositoryName, owner, private: isPrivate, description });
        setPublishing(false);
        if (published) closePublishModal();
    };

    const visibilityClass = (active: boolean) =>
        `flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${active
            ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`;

    const fieldClass = 'w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500';

    return (
        <Modal
            size="md"
            onClose={close}
            isOpen={publishModalOpen}
            title="Publicar repositório no GitHub"
            description={githubAccount ? `@${githubAccount.login}` : undefined}
            icon={<CloudUpload className="w-5 h-5 text-emerald-500" />}
            footer={
                <>
                    <button
                        onClick={close}
                        disabled={publishing}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={!githubAccount || !repositoryName || !owner || publishing}
                        className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 flex items-center gap-2"
                    >
                        {publishing ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <CloudUpload className="w-4 h-4" />
                        )}
                        {publishing ? 'Publicando...' : 'Publicar'}
                    </button>
                </>
            }
        >
            {!githubAccount ? (
                <p className="text-xs text-zinc-500">Conecte uma conta do GitHub para publicar este repositório.</p>
            ) : (
                <div className="space-y-5">
                    <div className="flex gap-2">
                        <div className="w-2/5 space-y-2">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Dono</label>
                            <select
                                value={owner}
                                disabled={publishing}
                                onChange={(event) => setOwner(event.target.value)}
                                className={fieldClass}
                            >
                                {owners.map((login) => (
                                    <option key={login} value={login}>{login}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nome</label>
                            <input
                                autoFocus
                                type="text"
                                value={name}
                                disabled={publishing}
                                onChange={(event) => setName(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handlePublish()}
                                className={`${fieldClass} font-mono`}
                            />
                        </div>
                    </div>
                    {ownersError && <p className="text-[11px] text-rose-500">{ownersError}</p>}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Descrição (opcional)</label>
                        <input
                            type="text"
                            value={description}
                            disabled={publishing}
                            onChange={(event) => setDescription(event.target.value)}
                            className={fieldClass}
                        />
                    </div>

                    <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                        <button className={visibilityClass(isPrivate)} disabled={publishing} onClick={() => setIsPrivate(true)}>
                            <Lock className="w-3.5 h-3.5" />
                            Privado
                        </button>
                        <button className={visibilityClass(!isPrivate)} disabled={publishing} onClick={() => setIsPrivate(false)}>
                            <Globe className="w-3.5 h-3.5" />
                            Público
                        </button>
                    </div>

                    <p className="text-[11px] text-zinc-500">
                        Cria <span className="font-mono text-zinc-700 dark:text-zinc-300">{owner}/{repositoryName || '...'}</span> no GitHub, adiciona como origin e envia a branch atual.
                    </p>
                </div>
            )}
        </Modal>
    );
};

export default PublishRepositoryModal;
