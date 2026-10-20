import { useNavigate } from 'react-router-dom';
import { remoteHost } from '../functions/gitStatus';
import { useAuth } from '../../../contexts/AuthContext';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import * as octohubDtos from '../../../../bindings/docker-manager-go/src/octohub/dtos/models';
import { Modal } from '../../shared/components/modals/Modal';
import { Events } from '@wailsio/runtime';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { Archive, Check, CloudDownload, FolderOpen, GitFork, Globe, KeyRound, Link, Lock, Plus, RefreshCw, Search, Server } from 'lucide-react';
import { ChooseCloneFolder, GetCloneFolder, ListGitCredentials, ListGitlabProjects, ListRemoteRepositories } from '../../../../bindings/docker-manager-go/src/octohub/handlers/repositoryhandler';

interface RemoteListState {
    loading: boolean;
    error: string | null;
    items: octohubDtos.RemoteRepositoryDto[];
}

const emptyList: RemoteListState = { loading: true, error: null, items: [] };

const nameFromUrl = (value: string) =>
    value.trim().replace(/[\\/]+$/, '').replace(/\.git$/, '').split(/[\\/:]/).pop() ?? '';

const CloneRepositoryModal: React.FC = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [url, setUrl] = useState('');
    const openAddedServer = useRef(false);
    const [tab, setTab] = useState('github');
    const [filter, setFilter] = useState('');
    const [folder, setFolder] = useState('');
    const knownServers = useRef<string[]>([]);
    const [progress, setProgress] = useState('');
    const [cloning, setCloning] = useState(false);
    const [servers, setServers] = useState<string[]>([]);
    const [github, setGithub] = useState<RemoteListState>(emptyList);
    const [serverLists, setServerLists] = useState<Record<string, RemoteListState>>({});
    const [selected, setSelected] = useState<octohubDtos.RemoteRepositoryDto | null>(null);
    const { githubAccount, cloneModalOpen, closeCloneModal, cloneRepository, selectRepository, openCredentials, credentialsRevision } = useOctohubRepository();

    const serverHost = tab.startsWith('server:') ? tab.slice('server:'.length) : null;

    const changeTab = (value: string) => {
        setTab(value);
        setFilter('');
        setSelected(null);
    };

    useEffect(() => {
        if (!cloneModalOpen || !token) return;
        setUrl('');
        setFilter('');
        setProgress('');
        setSelected(null);
        setServerLists({});
        knownServers.current = [];
        openAddedServer.current = false;
        setTab(githubAccount ? 'github' : 'url');
        GetCloneFolder(token).then(setFolder).catch(() => setFolder(''));
        if (!githubAccount) return;

        setGithub(emptyList);
        ListRemoteRepositories(token)
            .then((items) => setGithub({ loading: false, error: null, items: items || [] }))
            .catch((err) => setGithub({ loading: false, error: errorMessage(err), items: [] }));
    }, [cloneModalOpen, token, githubAccount?.id]);

    useEffect(() => {
        if (!cloneModalOpen || !token) return;
        setServerLists({});
        ListGitCredentials(token)
            .then((credentials) => {
                const hosts = (credentials || []).map((credential) => credential.host).filter((host) => host !== 'github.com');
                const added = hosts.find((host) => !knownServers.current.includes(host));
                if (added && openAddedServer.current) {
                    openAddedServer.current = false;
                    changeTab(`server:${added}`);
                }
                knownServers.current = hosts;
                setServers(hosts);
            })
            .catch(() => setServers([]));
    }, [cloneModalOpen, token, credentialsRevision]);

    const loadServer = (host: string) => {
        if (!token) return;
        setServerLists((previous) => ({ ...previous, [host]: emptyList }));
        ListGitlabProjects(token, host)
            .then((items) => setServerLists((previous) => ({ ...previous, [host]: { loading: false, error: null, items: items || [] } })))
            .catch((err) => setServerLists((previous) => ({ ...previous, [host]: { loading: false, error: errorMessage(err), items: [] } })));
    };

    useEffect(() => {
        if (cloneModalOpen && serverHost && !serverLists[serverHost]) loadServer(serverHost);
    }, [cloneModalOpen, serverHost, serverLists]);

    useEffect(() => {
        if (!cloning) return;
        return Events.On('octohub:clone-progress', ({ data: line }) => setProgress(line));
    }, [cloning]);

    const listState = tab === 'github' ? github : serverHost ? serverLists[serverHost] ?? emptyList : null;
    const query = filter.trim().toLowerCase();
    const filtered = useMemo(
        () => (listState?.items ?? []).filter((remote) =>
            remote.fullName.toLowerCase().includes(query) || (remote.description || '').toLowerCase().includes(query)
        ),
        [listState, query]
    );

    const cloneUrl = tab === 'url' ? url.trim() : selected?.cloneUrl ?? '';
    const targetName = tab === 'url' ? nameFromUrl(url) : selected?.name ?? '';
    const urlHost = tab === 'url' ? remoteHost(url) : '';
    const separator = folder.includes('\\') ? '\\' : '/';
    const destination = folder && targetName ? `${folder.replace(/[\\/]+$/, '')}${separator}${targetName}` : '';

    const close = () => {
        if (!cloning) closeCloneModal();
    };

    const chooseFolder = async () => {
        const chosen = await ChooseCloneFolder(folder);
        if (chosen) setFolder(chosen);
    };

    const handleClone = async () => {
        if (!cloneUrl || !folder || cloning) return;
        setCloning(true);
        setProgress('Iniciando...');
        const cloned = await cloneRepository(cloneUrl, folder, handleClone);
        setCloning(false);
        if (cloned) {
            closeCloneModal();
            navigate('/octohub/history');
        }
    };

    const openLocal = async (remote: octohubDtos.RemoteRepositoryDto) => {
        if (await selectRepository(remote.localRepositoryId)) {
            closeCloneModal();
            navigate('/octohub/history');
        }
    };

    const tabClass = (value: string) =>
        `flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${tab === value
            ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`;

    const smallButton = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold';

    const renderRemoteList = () => {
        if (!listState) return null;
        const source = serverHost ?? 'GitHub';
        return (
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        autoFocus
                        type="text"
                        value={filter}
                        disabled={cloning}
                        placeholder="Buscar repositório..."
                        onChange={(event) => setFilter(event.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                </div>
                <div className="h-72 overflow-y-auto custom-scrollbar border border-zinc-200 dark:border-white/10 rounded-xl divide-y divide-zinc-100 dark:divide-white/5">
                    {listState.loading ? (
                        <div className="h-full flex items-center justify-center gap-2 text-xs text-zinc-500">
                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            Buscando repositórios em {source}...
                        </div>
                    ) : listState.error ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                            <p className="text-xs text-rose-500">{listState.error}</p>
                            {serverHost && (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openCredentials(serverHost)} className={`${smallButton} text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20`}>
                                        <KeyRound className="w-3.5 h-3.5" />
                                        Configurar login
                                    </button>
                                    <button onClick={() => loadServer(serverHost)} className={`${smallButton} text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20`}>
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Tentar de novo
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="p-6 text-center text-xs text-zinc-500 italic">
                            {listState.items.length === 0 ? `Nenhum repositório encontrado em ${source}.` : 'Nenhum repositório corresponde à busca.'}
                        </p>
                    ) : (
                        filtered.map((remote) => {
                            const isSelected = selected?.fullName === remote.fullName;
                            const isLocal = remote.localRepositoryId > 0;
                            return (
                                <div
                                    key={remote.fullName}
                                    title={remote.cloneUrl}
                                    onClick={() => !isLocal && !cloning && setSelected(remote)}
                                    className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${isLocal ? 'cursor-default' : 'cursor-pointer'} ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-zinc-50 dark:hover:bg-white/5'}`}
                                >
                                    {remote.private ? (
                                        <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                                    ) : (
                                        <Globe className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-semibold truncate text-zinc-800 dark:text-zinc-200">
                                                <span className="text-zinc-400 font-normal">{remote.owner}/</span>{remote.name}
                                            </span>
                                            {remote.fork && <GitFork className="w-3 h-3 shrink-0 text-zinc-400" aria-label="Fork" />}
                                            {remote.archived && <Archive className="w-3 h-3 shrink-0 text-zinc-400" aria-label="Arquivado" />}
                                        </div>
                                        {remote.description && (
                                            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{remote.description}</p>
                                        )}
                                        {isLocal && (
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate mt-0.5" title={remote.localPath}>
                                                Já clonado em {remote.localPath}
                                            </p>
                                        )}
                                    </div>
                                    {isLocal ? (
                                        <button
                                            onClick={() => openLocal(remote)}
                                            className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                        >
                                            Abrir
                                        </button>
                                    ) : (
                                        isSelected && <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
                {selected && (
                    <p className="text-[11px] text-zinc-500 truncate" title={selected.cloneUrl}>
                        Via {selected.cloneUrl.startsWith('http') ? 'HTTPS' : 'SSH'}: <span className="font-mono">{selected.cloneUrl}</span>
                    </p>
                )}
            </div>
        );
    };

    return (
        <Modal
            size="lg"
            onClose={close}
            isOpen={cloneModalOpen}
            title="Clonar repositório"
            description={githubAccount ? `@${githubAccount.login}` : undefined}
            icon={<CloudDownload className="w-5 h-5 text-emerald-500" />}
            footer={
                <>
                    {cloning && (
                        <span className="mr-auto min-w-0 truncate text-[11px] font-mono text-zinc-500" title={progress}>
                            {progress}
                        </span>
                    )}
                    <button
                        onClick={close}
                        disabled={cloning}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleClone}
                        disabled={!cloneUrl || !folder || cloning}
                        className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 flex items-center gap-2"
                    >
                        {cloning ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <CloudDownload className="w-4 h-4" />
                        )}
                        {cloning ? 'Clonando...' : 'Clonar'}
                    </button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="flex flex-wrap gap-1 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                    <button className={tabClass('github')} disabled={!githubAccount || cloning} onClick={() => changeTab('github')}>
                        <img src="/gitoctocat.svg" alt="" className="w-3.5 h-3.5 brightness-0 dark:invert" />
                        {githubAccount ? `@${githubAccount.login}` : 'GitHub (sem conta)'}
                    </button>
                    {servers.map((host) => (
                        <button key={host} className={tabClass(`server:${host}`)} disabled={cloning} onClick={() => changeTab(`server:${host}`)}>
                            <Server className="w-3.5 h-3.5" />
                            {host}
                        </button>
                    ))}
                    <button className={tabClass('url')} disabled={cloning} onClick={() => changeTab('url')}>
                        <Link className="w-3.5 h-3.5" />
                        URL
                    </button>
                    <button
                        disabled={cloning}
                        onClick={() => {
                            openAddedServer.current = true;
                            openCredentials('gitlab.com');
                        }}
                        title="Cadastrar um servidor GitLab (gitlab.com ou o da sua empresa) para listar os projetos aqui"
                        className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        GitLab
                    </button>
                </div>

                {tab === 'url' ? (
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">URL do repositório</label>
                        <input
                            autoFocus
                            type="text"
                            value={url}
                            disabled={cloning}
                            placeholder="https://gitlab.com/grupo/projeto.git ou git@gitlab.com:grupo/projeto.git"
                            onChange={(event) => setUrl(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && handleClone()}
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {urlHost && urlHost !== 'github.com' ? (
                            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                                <p className="text-[11px] text-zinc-500">
                                    {urlHost} usa o login salvo nas Credenciais Git (usuário e senha/token para HTTPS, chave SSH para git@...).
                                </p>
                                <button
                                    onClick={() => openCredentials(urlHost)}
                                    className={`shrink-0 ${smallButton} text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20`}
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    Configurar login
                                </button>
                            </div>
                        ) : (
                            <p className="text-[11px] text-zinc-500">
                                {githubAccount
                                    ? `Repositórios do github.com são clonados com o acesso de @${githubAccount.login}.`
                                    : 'Sem conta do GitHub conectada, repositórios privados vão pedir o login do git.'}
                            </p>
                        )}
                    </div>
                ) : (
                    renderRemoteList()
                )}

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Pasta de destino</label>
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0 px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs font-mono truncate" title={folder}>
                            {folder || 'Escolha uma pasta'}
                        </div>
                        <button
                            onClick={chooseFolder}
                            disabled={cloning}
                            className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            <FolderOpen className="w-4 h-4" />
                            Alterar
                        </button>
                    </div>
                    {destination && (
                        <p className="text-[11px] text-zinc-500">
                            Será clonado em <span className="font-mono text-zinc-700 dark:text-zinc-300">{destination}</span>
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default CloneRepositoryModal;
