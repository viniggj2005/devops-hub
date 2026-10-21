import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Duration } from '../../../bindings/time/models';
import React, { useState, useEffect, useRef } from 'react';
import { errorMessage } from '../../features/shared/functions/ErrorMessage';
import { usePromptToast } from '../../features/shared/components/toasts/PromptToast';
import { useConfirmToast } from '../../features/shared/components/toasts/ConfirmToast';
import * as ferretshellDtos from '../../../bindings/docker-manager-go/src/ferretshell/dtos/models';
import SftpSidebar from '../../features/ferretShell-module/sftp/components/SftpSidebar';
import RenameModal from '../../features/ferretShell-module/sftp/components/RenameModal';
import * as Ssh from '../../../bindings/docker-manager-go/src/ferretshell/handlers/sshhandlerstruct';
import * as Sftp from '../../../bindings/docker-manager-go/src/ferretshell/handlers/sftphandlerstruct';
import SftpLocalPanel from '../../features/ferretShell-module/sftp/components/SftpLocalPanel';
import * as Local from '../../../bindings/docker-manager-go/src/ferretshell/handlers/localfilehandler';
import * as ferretshellHandlers from '../../../bindings/docker-manager-go/src/ferretshell/handlers/models';
import SftpRemotePanel from '../../features/ferretShell-module/sftp/components/SftpRemotePanel';
import { bytesToBase64, normalizeKey } from '../../features/ferretShell-module/terminal/functions/TreatmentFunctions';

const SftpPage: React.FC = () => {
    const { token, user } = useAuth();
    const promptToast = usePromptToast();
    const confirmToast = useConfirmToast();
    const sessionIdRef = useRef<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [localPath, setLocalPath] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [remotePath, setRemotePath] = useState<string>('/');
    const [sessionId, setSessionId] = useState<string | null>(null);

    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [selectedLocalIndices, setSelectedLocalIndices] = useState<number[]>([]);
    const [lastSelectedLocalIndex, setLastSelectedLocalIndex] = useState<number | null>(null);

    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [itemToRename, setItemToRename] = useState<{ path: string, name: string } | null>(null);

    const [activeConnectionId, setActiveConnectionId] = useState<number | null>(null);
    const [localFiles, setLocalFiles] = useState<ferretshellHandlers.LocalFileInfo[]>([]);
    const [savedConnections, setSavedConnections] = useState<ferretshellDtos.SshDto[]>([]);
    const [remoteFiles, setRemoteFiles] = useState<ferretshellHandlers.SftpFileInfo[]>([]);

    useEffect(() => {
        if (token && user) {
            loadSavedConnections();
            loadHomeDir();
        }
        return () => {
            if (sessionIdRef.current) {
                Sftp.DisconnectSFTP(sessionIdRef.current);
            }
        };
    }, [token, user]);

    const loadHomeDir = async () => {
        try {
            const home = await Local.GetHomeDir();
            setLocalPath(home);
            loadLocalFiles(home);
        } catch (homeError) { console.error(homeError); }
    };

    const loadSavedConnections = async () => {
        try {
            const connections = await Ssh.FindAllConnectionByUser(token!, user!.id);
            setSavedConnections(connections);
        } catch (connectionsError) { console.error(connectionsError); }
    };

    const loadRemoteFiles = async (currentSessionId: string, path: string) => {
        try {
            const list = await Sftp.ListFiles(currentSessionId, path);
            setRemoteFiles(list.sort((first, second) => (first.isDir === second.isDir ? first.name.localeCompare(second.name) : first.isDir ? -1 : 1)));
        } catch (remoteError: any) {
            setError(remoteError.message);
        }
    };

    const loadLocalFiles = async (path: string) => {
        try {
            const list = await Local.ListLocalFiles(path);
            setLocalFiles(list.sort((first, second) => (first.isDir === second.isDir ? first.name.localeCompare(second.name) : first.isDir ? -1 : 1)));
        } catch (localError: any) { console.error(localError); }
    };

    const handleConnect = async (sshDto: ferretshellDtos.SshDto) => {
        if (activeConnectionId === sshDto.id) return;
        setConnecting(true);
        setError(null);
        setSelectedIndices([]);
        setSelectedLocalIndices([]);
        try {
            if (sessionId) await Sftp.DisconnectSFTP(sessionId);
            const config = new ferretshellDtos.SSHConnectionDto();
            config.Host = sshDto.host;
            config.Port = sshDto.port || 22;
            config.User = sshDto.systemUser;
            config.InsecureIgnoreHostKey = true;
            if (sshDto.key) {
                config.Key = bytesToBase64(normalizeKey(sshDto.key));
            } else if (sshDto.password) {
                config.Password = sshDto.password;
            } else {
                const password = await promptToast({
                    title: 'Senha SSH',
                    inputType: 'password',
                    confirmLabel: 'Conectar',
                    placeholder: 'sua senha',
                    message: `Digite a senha para ${sshDto.systemUser}@${sshDto.host}`,
                });
                if (!password) { setConnecting(false); return; }
                config.Password = password;
            }
            config.Timeout = 10 * Duration.Second;
            const newSessionId = await Sftp.ConnectSFTP(config);
            setSessionId(newSessionId);
            sessionIdRef.current = newSessionId;
            setActiveConnectionId(sshDto.id);
            setRemotePath('/');
            await loadRemoteFiles(newSessionId, '/');
            toast.success('Conectado ao servidor SFTP');
        } catch (connectError: any) {
            setError(connectError.message || 'Erro ao conectar');
            toast.error(connectError.message || 'Falha na conexão');
        } finally {
            setConnecting(false);
        }
    };

    const handleDownload = async (items: { name: string, isDir: boolean }[], overridePath?: string) => {
        if (!sessionId) return;
        const targetDir = overridePath || localPath;
        try {
            for (const item of items) {
                const remote = remotePath.endsWith('/') ? remotePath + item.name : remotePath + '/' + item.name;
                if (item.isDir) {
                    await Sftp.DownloadDirectory(sessionId, remote, targetDir);
                } else {
                    const separator = targetDir.includes('\\') ? '\\' : '/';
                    const local = targetDir.endsWith('/') || targetDir.endsWith('\\') ? targetDir + item.name : targetDir + separator + item.name;
                    await Sftp.DownloadFile(sessionId, remote, local);
                }
            }
            toast.success('Download concluído');
            loadLocalFiles(localPath);
        } catch (downloadError: any) {
            toast.error(errorMessage(downloadError));
        }
    };

    const handleUpload = async (items: { path: string, name: string, isDir: boolean }[], overridePath?: string) => {
        if (!sessionId) return;
        const targetRemotePath = overridePath || remotePath;
        try {
            for (const item of items) {
                if (item.isDir) {
                    await Sftp.UploadDirectory(sessionId, targetRemotePath, item.path);
                } else {
                    const remote = targetRemotePath.endsWith('/') ? targetRemotePath + item.name : targetRemotePath + '/' + item.name;
                    await Sftp.UploadFile(sessionId, remote, item.path);
                }
            }
            toast.success('Upload concluído');
            loadRemoteFiles(sessionId, remotePath);
        } catch (uploadError: any) {
            toast.error(errorMessage(uploadError));
        }
    };

    const handleLocalDelete = async () => {
        if (selectedLocalIndices.length === 0) return;
        const pathsToDelete = selectedLocalIndices.map(index => localFiles[index].path);
        const itemName = selectedLocalIndices.length === 1 ? `"${localFiles[selectedLocalIndices[0]].name}"` : `${pathsToDelete.length} itens`;

        confirmToast({
            id: 'sftp-local-delete',
            title: 'Confirmar Exclusão',
            message: `Tem certeza que deseja excluir ${itemName}?`,
            onConfirm: async () => {
                await Local.DeleteLocalFiles(pathsToDelete);
                setSelectedLocalIndices([]);
                loadLocalFiles(localPath);
            },
        });
    };

    const handleLocalRenameRequest = (index: number) => {
        const file = localFiles[index];
        setItemToRename({ path: file.path, name: file.name });
        setIsRenameModalOpen(true);
    };

    const handleLocalRenameSave = async (newName: string) => {
        if (!itemToRename) return;
        try {
            const parentPath = itemToRename.path.substring(0, itemToRename.path.lastIndexOf(itemToRename.name));
            const newPath = parentPath + newName;
            await Local.RenameLocalFile(itemToRename.path, newPath);
            toast.success('Arquivo renomeado');
            loadLocalFiles(localPath);
        } catch (renameError: any) {
            toast.error(errorMessage(renameError));
        } finally {
            setIsRenameModalOpen(false);
            setItemToRename(null);
        }
    };

    const handleFileClick = (index: number, event: React.MouseEvent) => {
        if (event.shiftKey && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            const newSelection = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
            setSelectedIndices(previous => Array.from(new Set([...previous, ...newSelection])));
        } else if (event.ctrlKey || event.metaKey) {
            setSelectedIndices(previous => previous.includes(index) ? previous.filter(itemIndex => itemIndex !== index) : [...previous, index]);
        } else { setSelectedIndices([index]); }
        setLastSelectedIndex(index);
    };

    const handleLocalFileClick = (index: number, event: React.MouseEvent) => {
        if (event.shiftKey && lastSelectedLocalIndex !== null) {
            const start = Math.min(lastSelectedLocalIndex, index);
            const end = Math.max(lastSelectedLocalIndex, index);
            const newSelection = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
            setSelectedLocalIndices(previous => Array.from(new Set([...previous, ...newSelection])));
        } else if (event.ctrlKey || event.metaKey) {
            setSelectedLocalIndices(previous => previous.includes(index) ? previous.filter(itemIndex => itemIndex !== index) : [...previous, index]);
        } else { setSelectedLocalIndices([index]); }
        setLastSelectedLocalIndex(index);
    };

    const onDragStart = (event: React.DragEvent, index: number) => {
        const file = remoteFiles[index];
        if (!file) return;
        let items = [{ name: file.name, isDir: file.isDir }];
        if (selectedIndices.includes(index)) {
            items = selectedIndices.map(itemIndex => ({ name: remoteFiles[itemIndex].name, isDir: remoteFiles[itemIndex].isDir }));
        }
        event.dataTransfer.setData('application/json', JSON.stringify({ type: 'download', items }));
        event.dataTransfer.effectAllowed = 'copy';
    };

    const onLocalDragStart = (event: React.DragEvent, index: number) => {
        const file = localFiles[index];
        if (!file) return;
        let items = [{ path: file.path, name: file.name, isDir: file.isDir }];
        if (selectedLocalIndices.includes(index)) {
            items = selectedLocalIndices.map(itemIndex => ({ path: localFiles[itemIndex].path, name: localFiles[itemIndex].name, isDir: localFiles[itemIndex].isDir }));
        }
        event.dataTransfer.setData('application/json', JSON.stringify({ type: 'upload', items }));
        event.dataTransfer.effectAllowed = 'copy';
    };

    const onDropOnLocal = (event: React.DragEvent, overridePath?: string) => {
        event.preventDefault(); event.stopPropagation();
        try {
            const data = event.dataTransfer.getData('application/json');
            if (data) {
                const payload = JSON.parse(data);
                if (payload.type === 'download') { handleDownload(payload.items, overridePath); }
            }
        } catch (dropError) { console.error('Erro ao processar drop no local:', dropError); }
    };

    const onDropOnRemote = (event: React.DragEvent, overridePath?: string) => {
        event.preventDefault(); event.stopPropagation();
        const targetPath = overridePath || remotePath;
        try {
            const data = event.dataTransfer.getData('application/json');
            if (data) {
                const payload = JSON.parse(data);
                if (payload.type === 'upload') { handleUpload(payload.items, targetPath); return; }
            }
            if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                toast('Para arquivos externos, arraste primeiro para o painel Local.');
            }
        } catch (dropError) { console.error('Erro ao processar drop no remoto:', dropError); }
    };

    return (
        <div className="flex h-[calc(100vh-180px)] gap-4 p-4">
            <SftpSidebar
                connections={savedConnections}
                activeConnectionId={activeConnectionId}
                connecting={connecting}
                onConnect={handleConnect}
            />

            <SftpRemotePanel
                sessionId={sessionId}
                remotePath={remotePath}
                remoteFiles={remoteFiles}
                selectedIndices={selectedIndices}
                error={error}
                onUp={() => {
                    if (remotePath === '/') return;
                    const parts = remotePath.split('/').filter(Boolean);
                    parts.pop();
                    const path = '/' + parts.join('/');
                    setRemotePath(path);
                    loadRemoteFiles(sessionId!, path);
                }}
                onDirClick={(name) => {
                    const path = remotePath.endsWith('/') ? remotePath + name : remotePath + '/' + name;
                    setRemotePath(path);
                    loadRemoteFiles(sessionId!, path);
                }}
                onFileClick={handleFileClick}
                onDragStart={onDragStart}
                onDrop={onDropOnRemote}
            />

            <SftpLocalPanel
                localPath={localPath}
                localFiles={localFiles}
                selectedIndices={selectedLocalIndices}
                onUp={() => {
                    const path = localPath.substring(0, localPath.lastIndexOf('\\')) || localPath.substring(0, localPath.lastIndexOf('/')) || '/';
                    setLocalPath(path);
                    loadLocalFiles(path);
                }}
                onDirClick={(path) => {
                    setLocalPath(path);
                    loadLocalFiles(path);
                }}
                onFileClick={handleLocalFileClick}
                onDragStart={onLocalDragStart}
                onDrop={onDropOnLocal}
                onDelete={handleLocalDelete}
                onRename={handleLocalRenameRequest}
                onSetSelection={setSelectedLocalIndices}
            />

            <RenameModal
                isOpen={isRenameModalOpen}
                oldName={itemToRename?.name || ''}
                onClose={() => { setIsRenameModalOpen(false); setItemToRename(null); }}
                onSave={handleLocalRenameSave}
            />
        </div>
    );
};

export default SftpPage;
