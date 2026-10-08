import { octohubStructs } from '../../../../wailsjs/go/models';

export const getConflictingFiles = (files: octohubStructs.FilesStatus[] | null) =>
    (files || []).filter((file) => file.Kind === 'conflicted').map((file) => file.FileName);

export const isConflictError = (error: unknown) => {
    const message = String(error).toLowerCase();
    return message.includes('conflict') || message.includes('needs merge');
};

export const fileKindStyles: Record<string, { label: string; title: string; className: string }> = {
    added: { label: 'A', title: 'Adicionado', className: 'text-git-added bg-git-added/10 border-git-added/20' },
    deleted: { label: 'D', title: 'Removido', className: 'text-git-deleted bg-git-deleted/10 border-git-deleted/20' },
    renamed: { label: 'R', title: 'Renomeado', className: 'text-git-renamed bg-git-renamed/10 border-git-renamed/20' },
    modified: { label: 'M', title: 'Modificado', className: 'text-git-modified bg-git-modified/10 border-git-modified/20' },
    conflicted: { label: '!', title: 'Em conflito', className: 'text-git-conflicted bg-git-conflicted/10 border-git-conflicted/20' },
    untracked: { label: 'U', title: 'Novo (não rastreado)', className: 'text-git-untracked bg-git-untracked/10 border-git-untracked/20' },
};

const authMarker = /\s*\[auth:([^\]]+)\]/;

export const authHostFromError = (error: unknown) => authMarker.exec(String(error))?.[1] ?? null;

export const gitErrorMessage = (error: unknown) => String(error).replace(authMarker, '');

export const remoteHost = (remoteUrl: string) => {
    const value = remoteUrl.trim();
    const scp = /^(?:[\w.-]+@)?([\w.-]{2,}):(?!\/\/)/.exec(value);
    if (scp && !value.includes('://')) return scp[1].toLowerCase();
    try {
        return new URL(value).host.toLowerCase();
    } catch {
        return '';
    }
};

export const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
