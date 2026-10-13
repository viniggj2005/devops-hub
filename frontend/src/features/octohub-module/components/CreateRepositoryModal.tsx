import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { Modal } from '../../shared/components/modals/Modal';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { ChooseCloneFolder, GetCloneFolder } from '../../../../wailsjs/go/octohubHandler/RepositoryHandler';

const CreateRepositoryModal: React.FC = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [folder, setFolder] = useState('');
    const [creating, setCreating] = useState(false);
    const [withReadme, setWithReadme] = useState(true);
    const { createModalOpen, closeCreateModal, createRepository } = useOctohubRepository();

    useEffect(() => {
        if (!createModalOpen || !token) return;
        setName('');
        setWithReadme(true);
        GetCloneFolder(token).then(setFolder).catch(() => setFolder(''));
    }, [createModalOpen, token]);

    const repositoryName = name.trim().replace(/\s+/g, '-');
    const separator = folder.includes('\\') ? '\\' : '/';
    const destination = folder && repositoryName ? `${folder.replace(/[\\/]+$/, '')}${separator}${repositoryName}` : '';

    const close = () => {
        if (!creating) closeCreateModal();
    };

    const chooseFolder = async () => {
        const chosen = await ChooseCloneFolder(folder);
        if (chosen) setFolder(chosen);
    };

    const handleCreate = async () => {
        if (!repositoryName || !folder || creating) return;
        setCreating(true);
        const created = await createRepository(folder, repositoryName, withReadme);
        setCreating(false);
        if (created) {
            closeCreateModal();
            navigate('/octohub/history');
        }
    };

    return (
        <Modal
            size="md"
            onClose={close}
            isOpen={createModalOpen}
            title="Criar repositório local"
            icon={<FolderPlus className="w-5 h-5 text-emerald-500" />}
            footer={
                <>
                    <button
                        onClick={close}
                        disabled={creating}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!repositoryName || !folder || creating}
                        className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 flex items-center gap-2"
                    >
                        {creating ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <FolderPlus className="w-4 h-4" />
                        )}
                        {creating ? 'Criando...' : 'Criar'}
                    </button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nome</label>
                    <input
                        autoFocus
                        type="text"
                        value={name}
                        disabled={creating}
                        placeholder="meu-projeto"
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Pasta de destino</label>
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0 px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs font-mono truncate" title={folder}>
                            {folder || 'Escolha uma pasta'}
                        </div>
                        <button
                            onClick={chooseFolder}
                            disabled={creating}
                            className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            <FolderOpen className="w-4 h-4" />
                            Alterar
                        </button>
                    </div>
                    {destination && (
                        <p className="text-[11px] text-zinc-500">
                            Será criado em <span className="font-mono text-zinc-700 dark:text-zinc-300">{destination}</span>
                        </p>
                    )}
                </div>

                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={withReadme}
                        disabled={creating}
                        className="accent-emerald-600"
                        onChange={(event) => setWithReadme(event.target.checked)}
                    />
                    Criar README.md e fazer o commit inicial
                </label>
            </div>
        </Modal>
    );
};

export default CreateRepositoryModal;
