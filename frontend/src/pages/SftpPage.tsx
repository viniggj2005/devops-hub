import { useAuth } from '../contexts/AuthContext';
import React, { useState, useEffect, useRef } from 'react';
import * as Ssh from '../../wailsjs/go/ferretShellHandlers/SshHandlerStruct';
import * as Sftp from '../../wailsjs/go/ferretShellHandlers/SftpHandlerStruct';
import * as Local from '../../wailsjs/go/ferretShellHandlers/LocalFileHandler';
import { ferretShellHandlers, ferretShellDtos } from '../../wailsjs/go/models';
import { Folder, File as FileIcon, ArrowUp, Download, Link2, Monitor } from 'lucide-react';

const SftpPage: React.FC = () => {
    const { token, user } = useAuth();
    const sessionIdRef = useRef<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [localPath, setLocalPath] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [remotePath, setRemotePath] = useState<string>('/');
    const [loadingRemote, setLoadingRemote] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [localFiles, setLocalFiles] = useState<ferretShellHandlers.LocalFileInfo[]>([]);
    const [savedConnections, setSavedConnections] = useState<ferretShellDtos.SshDto[]>([]);
    const [remoteFiles, setRemoteFiles] = useState<ferretShellHandlers.SftpFileInfo[]>([]);

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
        } catch (err) {
            console.error(err);
        }
    };

    const loadSavedConnections = async () => {
        try {
            const connections = await Ssh.FindAllConnectionByUser(token!, user!.id);
            setSavedConnections(connections);
        } catch (err) {
            console.error(err);
        }
    };

    const handleConnect = async (sshDto: ferretShellDtos.SshDto) => {
        setConnecting(true);
        setError(null);
        try {
            if (sessionId) await Sftp.DisconnectSFTP(sessionId);
            const config = new ferretShellDtos.SSHConnectionDto();
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
                if (!password) {
                    setConnecting(false);
                    return;
                }
                config.Password = password;
            }
            config.Timeout = 10000000000;
            const newSessionId = await Sftp.ConnectSFTP(config);
            setSessionId(newSessionId);
            sessionIdRef.current = newSessionId;
            setRemotePath('/');
            await loadRemoteFiles(newSessionId, '/');
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar');
        } finally {
            setConnecting(false);
        }
    };

    const loadRemoteFiles = async (sessionId: string, path: string) => {
        setLoadingRemote(true);
        try {
            const list = await Sftp.ListFiles(sessionId, path);
            setRemoteFiles(list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingRemote(false);
        }
    };

    const loadLocalFiles = async (path: string) => {
        try {
            const list = await Local.ListLocalFiles(path);
            setLocalFiles(list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)));
        } catch (err: any) {
            console.error(err);
        }
    };

    const handleRemoteDirClick = (name: string) => {
        const path = remotePath.endsWith('/') ? remotePath + name : remotePath + '/' + name;
        setRemotePath(path);
        loadRemoteFiles(sessionId!, path);
    };

    const handleLocalDirClick = (path: string) => {
        setLocalPath(path);
        loadLocalFiles(path);
    };

    const handleRemoteUp = () => {
        if (remotePath === '/') return;
        const parts = remotePath.split('/').filter(Boolean);
        parts.pop();
        const path = '/' + parts.join('/');
        setRemotePath(path);
        loadRemoteFiles(sessionId!, path);
    };

    const handleLocalUp = () => {
        const path = localPath.substring(0, localPath.lastIndexOf('\\')) || localPath.substring(0, localPath.lastIndexOf('/')) || '/';
        setLocalPath(path);
        loadLocalFiles(path);
    };

    const handleDownload = async (fileName: string) => {
        if (!sessionId) return;
        try {
            const remote = remotePath.endsWith('/') ? remotePath + fileName : remotePath + '/' + fileName;
            const local = localPath.endsWith('/') || localPath.endsWith('\\') ? localPath + fileName : localPath + '/' + fileName;
            await Sftp.DownloadFile(sessionId, remote, local);
            loadLocalFiles(localPath);
        } catch (err: any) {
            alert(err);
        }
    };

    const onDragStart = (event: React.DragEvent, fileName: string) => {
        event.dataTransfer.setData('fileName', fileName);
    };

    const onDrop = (event: React.DragEvent) => {
        const fileName = event.dataTransfer.getData('fileName');
        if (fileName) handleDownload(fileName);
    };

    return (
        <div className="flex h-[calc(100vh-180px)] gap-4">
            <div className="w-64 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-lg">
                <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-800/30">
                    <h3 className="text-xs font-bold uppercase text-gray-400">Conexões</h3>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1">
                    {savedConnections.map(connection => (
                        <button
                            key={connection.id}
                            onClick={() => handleConnect(connection)}
                            disabled={connecting}
                            className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${sessionId && savedConnections.find(conn => conn.host === connection.host) && sessionIdRef.current ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' : 'border-transparent hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-zinc-400'}`}
                        >
                            <div className="font-bold truncate">{connection.alias || connection.host}</div>
                            <div className="opacity-60 truncate">{connection.systemUser}@{connection.host}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-lg">
                <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50/30 dark:bg-zinc-800/20">
                    <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-bold">Remoto</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRemoteUp} disabled={!sessionId || remotePath === '/'} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                        <input type="text" readOnly value={remotePath} className="bg-transparent border-none text-xs font-mono w-40 outline-none" />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {!sessionId ? (
                        <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">{error || 'Selecione um servidor'}</div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <tbody>
                                {remoteFiles.map((remoteFile, index) => (
                                    <tr
                                        key={index}
                                        draggable={!remoteFile.isDir}
                                        onDragStart={(event) => onDragStart(event, remoteFile.name)}
                                        onDoubleClick={() => remoteFile.isDir && handleRemoteDirClick(remoteFile.name)}
                                        className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer group"
                                    >
                                        <td className="p-2 flex items-center gap-2">
                                            {remoteFile.isDir ? <Folder className="w-4 h-4 text-amber-500" /> : <FileIcon className="w-4 h-4 text-blue-500" />}
                                            <span className="truncate">{remoteFile.name}</span>
                                        </td>
                                        <td className="p-2 text-right"><button onClick={() => !remoteFile.isDir && handleDownload(remoteFile.name)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-3 h-3" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-lg" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
                <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50/30 dark:bg-zinc-800/20">
                    <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-bold">Local</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleLocalUp} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><ArrowUp className="w-4 h-4" /></button>
                        <input type="text" readOnly value={localPath} className="bg-transparent border-none text-xs font-mono w-40 outline-none text-right" title={localPath} />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-xs">
                        <tbody>
                            {localFiles.map((localFile, index) => (
                                <tr key={index} onDoubleClick={() => localFile.isDir && handleLocalDirClick(localFile.path)} className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                                    <td className="p-2 flex items-center gap-2">
                                        {localFile.isDir ? <Folder className="w-4 h-4 text-amber-500" /> : <FileIcon className="w-4 h-4 text-blue-500" />}
                                        <span className="truncate">{localFile.name}</span>
                                    </td>
                                    <td className="p-2 text-right text-gray-500 font-mono">{(localFile.size / 1024).toFixed(0)}K</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SftpPage;
