import iziToast from 'izitoast';
import { useAuth } from '../../../contexts/AuthContext';
import * as octohubDtos from '../../../../bindings/docker-manager-go/src/octohub/dtos/models';
import { useConfirmToast } from '../../shared/components/toasts/ConfirmToast';
import { authHostFromError, escapeHtml, gitErrorMessage } from '../functions/gitStatus';
import { GetCurrentBranch } from '../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AddRepository, CloneRepository, CreateRepository, GetCurrentRepository, ListRepositories, PublishRepository, RemoveRepository, SelectRepository } from '../../../../bindings/docker-manager-go/src/octohub/handlers/repositoryhandler';

export interface PublishRepositoryInput {
    name: string;
    owner: string;
    private: boolean;
    description: string;
}

interface OctohubRepositoryContextValue {
    loading: boolean;
    revision: number;
    conflictsOpen: boolean;
    cloneModalOpen: boolean;
    createModalOpen: boolean;
    publishModalOpen: boolean;
    notifyChange: () => void;
    openConflicts: () => void;
    closeConflicts: () => void;
    openCloneModal: () => void;
    closeCloneModal: () => void;
    openCreateModal: () => void;
    closeCreateModal: () => void;
    openPublishModal: () => void;
    closePublishModal: () => void;
    credentialsRevision: number;
    currentBranch: string | null;
    closeCredentials: () => void;
    notifyCredentialsChange: () => void;
    addRepository: () => Promise<boolean>;
    repositories: octohubDtos.RepositoryDto[];
    credentialsTarget: CredentialsTarget | null;
    repository: octohubDtos.RepositoryDto | null;
    githubAccount: octohubDtos.GithubAccountDto | null;
    selectRepository: (repositoryId: number) => Promise<boolean>;
    openCredentials: (host?: string, retry?: () => void) => void;
    removeRepository: (repository: octohubDtos.RepositoryDto) => void;
    handleGitError: (error: unknown, prefix: string, retry?: () => void) => void;
    publishRepository: (input: PublishRepositoryInput) => Promise<boolean>;
    createRepository: (parentFolder: string, name: string, withReadme: boolean) => Promise<boolean>;
    cloneRepository: (remoteUrl: string, parentFolder: string, retry?: () => void) => Promise<boolean>;
}

export interface CredentialsTarget {
    host: string;
    retry?: () => void;
}

interface OctohubRepositoryProviderProps {
    children: React.ReactNode;
    githubAccount: octohubDtos.GithubAccountDto | null;
}

const OctohubRepositoryContext = createContext<OctohubRepositoryContextValue | undefined>(undefined);

const showError = (error: unknown) => iziToast.error({ title: 'OctoHub', message: escapeHtml(gitErrorMessage(error)), position: 'bottomRight' });

export const OctohubRepositoryProvider: React.FC<OctohubRepositoryProviderProps> = ({ children, githubAccount }) => {
    const { token } = useAuth();
    const confirmToast = useConfirmToast();
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [conflictsOpen, setConflictsOpen] = useState(false);
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [credentialsRevision, setCredentialsRevision] = useState(0);
    const [currentBranch, setCurrentBranch] = useState<string | null>(null);
    const [repositories, setRepositories] = useState<octohubDtos.RepositoryDto[]>([]);
    const [repository, setRepository] = useState<octohubDtos.RepositoryDto | null>(null);
    const [credentialsTarget, setCredentialsTarget] = useState<CredentialsTarget | null>(null);

    const refresh = useCallback(async () => {
        if (!token) return;
        try {
            setRepository((await GetCurrentRepository(token)) ?? null);
            setRepositories(await ListRepositories(token));
        } catch (error) {
            showError(error);
        } finally {
            setLoading(false);
        }
    }, [token, githubAccount?.id]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (!repository?.exists) {
            setCurrentBranch(null);
            return;
        }
        GetCurrentBranch()
            .then(setCurrentBranch)
            .catch(() => setCurrentBranch(null));
    }, [repository?.id, repository?.exists, revision]);

    const notifyChange = useCallback(() => setRevision((previous) => previous + 1), []);

    const openCredentials = useCallback((host = '', retry?: () => void) => setCredentialsTarget({ host, retry }), []);

    const handleGitError = useCallback((error: unknown, prefix: string, retry?: () => void) => {
        const host = authHostFromError(error);
        if (host) {
            openCredentials(host, retry);
            iziToast.info({ title: 'Login necessário', message: `${escapeHtml(host)} pediu usuário e senha (ou chave SSH).`, position: 'bottomRight' });
            return;
        }
        iziToast.error({ title: 'Erro', message: escapeHtml(`${prefix}: ${gitErrorMessage(error)}`), position: 'bottomRight' });
    }, [openCredentials]);

    const selectRepository = useCallback(async (repositoryId: number) => {
        if (!token) return false;
        try {
            setRepository(await SelectRepository(token, repositoryId));
            setRepositories(await ListRepositories(token));
            return true;
        } catch (error) {
            showError(error);
            return false;
        }
    }, [token]);

    const addRepository = useCallback(async () => {
        if (!token) return false;
        try {
            const added = await AddRepository(token);
            if (!added) return false;
            setRepository(added);
            setRepositories(await ListRepositories(token));
            iziToast.success({ title: 'OctoHub', message: `Repositório ${added.name} aberto.`, position: 'bottomRight' });
            return true;
        } catch (error) {
            showError(error);
            return false;
        }
    }, [token]);

    const cloneRepository = useCallback(async (remoteUrl: string, parentFolder: string, retry?: () => void) => {
        if (!token) return false;
        try {
            const cloned = await CloneRepository(token, remoteUrl, parentFolder);
            setRepository(cloned);
            setRepositories(await ListRepositories(token));
            iziToast.success({ title: 'OctoHub', message: `Repositório ${escapeHtml(cloned?.name ?? remoteUrl)} clonado.`, position: 'bottomRight' });
            return true;
        } catch (error) {
            handleGitError(error, 'Erro ao clonar', retry);
            return false;
        }
    }, [token, handleGitError]);

    const createRepository = useCallback(async (parentFolder: string, name: string, withReadme: boolean) => {
        if (!token) return false;
        try {
            const created = await CreateRepository(token, parentFolder, name, withReadme);
            setRepository(created);
            setRepositories(await ListRepositories(token));
            iziToast.success({ title: 'OctoHub', message: `Repositório ${escapeHtml(created?.name ?? name)} criado.`, position: 'bottomRight' });
            return true;
        } catch (error) {
            showError(error);
            await refresh();
            return false;
        }
    }, [token, refresh]);

    const publishRepository = useCallback(async (input: PublishRepositoryInput) => {
        if (!token) return false;
        try {
            await PublishRepository(token, input.owner, input.name, input.description, input.private);
            iziToast.success({ title: 'OctoHub', message: `Repositório publicado em ${escapeHtml(`${input.owner}/${input.name}`)}.`, position: 'bottomRight' });
            return true;
        } catch (error) {
            handleGitError(error, 'Erro ao publicar');
            return false;
        } finally {
            notifyChange();
        }
    }, [token, handleGitError, notifyChange]);

    const removeRepository = (target: octohubDtos.RepositoryDto) => {
        if (!token) return;
        confirmToast({
            id: `repository-${target.id}`,
            title: `Repositório ${escapeHtml(target.name)} removido da lista!`,
            message: `Remover ${escapeHtml(target.name)} do OctoHub? A pasta e os arquivos não serão apagados.`,
            onConfirm: async () => {
                await RemoveRepository(token, target.id);
                await refresh();
            },
        });
    };

    return (
        <OctohubRepositoryContext.Provider
            value={{
                loading,
                revision,
                repository,
                repositories,
                notifyChange,
                githubAccount,
                currentBranch,
                addRepository,
                conflictsOpen,
                cloneModalOpen,
                handleGitError,
                createModalOpen,
                openCredentials,
                cloneRepository,
                publishModalOpen,
                createRepository,
                selectRepository,
                removeRepository,
                publishRepository,
                credentialsTarget,
                credentialsRevision,
                openConflicts: () => setConflictsOpen(true),
                openCloneModal: () => setCloneModalOpen(true),
                closeConflicts: () => setConflictsOpen(false),
                openCreateModal: () => setCreateModalOpen(true),
                closeCloneModal: () => setCloneModalOpen(false),
                openPublishModal: () => setPublishModalOpen(true),
                closeCreateModal: () => setCreateModalOpen(false),
                closePublishModal: () => setPublishModalOpen(false),
                closeCredentials: () => setCredentialsTarget(null),
                notifyCredentialsChange: () => setCredentialsRevision((previous) => previous + 1),
            }}
        >
            {children}
        </OctohubRepositoryContext.Provider>
    );
};

export function useOctohubRepository() {
    const context = useContext(OctohubRepositoryContext);
    if (!context) throw new Error('useOctohubRepository deve ser usado dentro de OctohubRepositoryProvider');
    return context;
}
