import iziToast from 'izitoast';
import { useAuth } from '../../contexts/AuthContext';
import React, { useState, useEffect, useRef } from 'react';
import * as Ssh from '../../../wailsjs/go/ferretShellHandlers/SshHandlerStruct';
import * as Sftp from '../../../wailsjs/go/ferretShellHandlers/SftpHandlerStruct';
import * as Local from '../../../wailsjs/go/ferretShellHandlers/LocalFileHandler';
import { ferretshellHandlers, ferretshellDtos } from '../../../wailsjs/go/models';
import SftpSidebar from '../../features/ferretShell-module/sftp/components/SftpSidebar';
import RenameModal from '../../features/ferretShell-module/sftp/components/RenameModal';
import SftpLocalPanel from '../../features/ferretShell-module/sftp/components/SftpLocalPanel';
import SftpRemotePanel from '../../features/ferretShell-module/sftp/components/SftpRemotePanel';

const SftpPage: React.FC = () => {
    const { token, user } = useAuth();
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
        } catch (err) { console.error(err); }
    };

    const loadSavedConnections = async () => {
        try {
            const connections = await Ssh.FindAllConnectionByUser(token!, user!.id);
            setSavedConnections(connections);
        } catch (err) { console.error(err); }
    };

    const loadRemoteFiles = async (sessionId: string, path: string) => {
        try {
            const list = await Sftp.ListFiles(sessionId, path);
            setRemoteFiles(list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const loadLocalFiles = async (path: string) => {
        try {
            const list = await Local.ListLocalFiles(path);
            setLocalFiles(list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)));
        } catch (err: any) { console.error(err); }
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
                config.Key = Array.from(sshDto.key).map(char => char.charCodeAt(0));
            } else if (sshDto.password) {
                config.Password = sshDto.password;
            } else {
                const password = prompt(`Digite a senha para ${sshDto.systemUser}@${sshDto.host}:`);
                if (!password) { setConnecting(false); return; }
                config.Password = password;
            }
            config.Timeout = 10000000000;
            const newSessionId = await Sftp.ConnectSFTP(config);
            setSessionId(newSessionId);
            sessionIdRef.current = newSessionId;
            setActiveConnectionId(sshDto.id);
            setRemotePath('/');
            await loadRemoteFiles(newSessionId, '/');
            iziToast.success({ title: 'Sucesso', message: 'Conectado ao servidor SFTP', position: 'bottomRight' });
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar');
            iziToast.error({ title: 'Erro', message: err.message || 'Falha na conexão', position: 'bottomRight' });
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
            iziToast.success({ title: 'Sucesso', message: 'Download concluído', position: 'bottomRight' });
            loadLocalFiles(localPath);
        } catch (err: any) {
            iziToast.error({ title: 'Erro', message: String(err), position: 'bottomRight' });
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
                    // @ts-ignore
                    await Sftp.UploadFile(sessionId, remote, item.path);
                }
            }
            iziToast.success({ title: 'Sucesso', message: 'Upload concluído', position: 'bottomRight' });
            loadRemoteFiles(sessionId, remotePath);
        } catch (err: any) {
            iziToast.error({ title: 'Erro', message: String(err), position: 'bottomRight' });
        }
    };

    const handleLocalDelete = async () => {
        if (selectedLocalIndices.length === 0) return;
        const pathsToDelete = selectedLocalIndices.map(i => localFiles[i].path);
        const itemName = selectedLocalIndices.length === 1 ? `"${localFiles[selectedLocalIndices[0]].name}"` : `${pathsToDelete.length} itens`;

        iziToast.question({
            timeout: 20000, close: false, overlay: true, displayMode: 'once', id: 'question', zIndex: 9999,
            title: 'Confirmar Exclusão', message: `Tem certeza que deseja excluir ${itemName}?`, position: 'center',
            buttons: [
                ['<button><b>SIM</b></button>', async (instance: any, toast: any) => {
                    instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                    try {
                        await Local.DeleteLocalFiles(pathsToDelete);
                        iziToast.success({ title: 'Sucesso', message: 'Itens excluídos', position: 'bottomRight' });
                        setSelectedLocalIndices([]);
                        loadLocalFiles(localPath);
                    } catch (err: any) { iziToast.error({ title: 'Erro', message: String(err), position: 'bottomRight' }); }
                }, true],
                ['<button>NÃO</button>', (instance: any, toast: any) => { instance.hide({ transitionOut: 'fadeOut' }, toast, 'button'); }, false],
            ],
        } as any);
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
            iziToast.success({ title: 'Sucesso', message: 'Arquivo renomeado', position: 'bottomRight' });
            loadLocalFiles(localPath);
        } catch (err: any) {
            iziToast.error({ title: 'Erro', message: String(err), position: 'bottomRight' });
        } finally {
            setIsRenameModalOpen(false);
            setItemToRename(null);
        }
    };

    const handleFileClick = (index: number, event: React.MouseEvent) => {
        if (event.shiftKey && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            const newSelection = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            setSelectedIndices(prev => Array.from(new Set([...prev, ...newSelection])));
        } else if (event.ctrlKey || event.metaKey) {
            setSelectedIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
        } else { setSelectedIndices([index]); }
        setLastSelectedIndex(index);
    };

    const handleLocalFileClick = (index: number, event: React.MouseEvent) => {
        if (event.shiftKey && lastSelectedLocalIndex !== null) {
            const start = Math.min(lastSelectedLocalIndex, index);
            const end = Math.max(lastSelectedLocalIndex, index);
            const newSelection = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            setSelectedLocalIndices(prev => Array.from(new Set([...prev, ...newSelection])));
        } else if (event.ctrlKey || event.metaKey) {
            setSelectedLocalIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
        } else { setSelectedLocalIndices([index]); }
        setLastSelectedLocalIndex(index);
    };

    const onDragStart = (event: React.DragEvent, index: number) => {
        const file = remoteFiles[index];
        if (!file) return;
        let items = [{ name: file.name, isDir: file.isDir }];
        if (selectedIndices.includes(index)) {
            items = selectedIndices.map(i => ({ name: remoteFiles[i].name, isDir: remoteFiles[i].isDir }));
        }
        event.dataTransfer.setData('application/json', JSON.stringify({ type: 'download', items }));
        event.dataTransfer.effectAllowed = 'copy';
    };

    const onLocalDragStart = (event: React.DragEvent, index: number) => {
        const file = localFiles[index];
        if (!file) return;
        let items = [{ path: file.path, name: file.name, isDir: file.isDir }];
        if (selectedLocalIndices.includes(index)) {
            items = selectedLocalIndices.map(i => ({ path: localFiles[i].path, name: localFiles[i].name, isDir: localFiles[i].isDir }));
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
        } catch (err) { console.error('Erro ao processar drop no local:', err); }
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
                iziToast.info({ title: 'Upload', message: 'Para arquivos externos, arraste primeiro para o painel Local.', position: 'bottomRight' });
            }
        } catch (err) { console.error('Erro ao processar drop no remoto:', err); }
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
