import { octohubStructs } from '../../../../wailsjs/go/models';

export const getConflictingFiles = (files: octohubStructs.FilesStatus[] | null) =>
    (files || []).filter((file) => file.Kind === 'conflicted').map((file) => file.FileName);

export const isConflictError = (error: unknown) => {
    const message = String(error).toLowerCase();
    return message.includes('conflict') || message.includes('needs merge');
};

export const fileKindStyles: Record<string, { label: string; title: string; className: string }> = {
    deleted: { label: 'D', title: 'Removido', className: 'text-red-500 bg-red-500/10 border-red-500/20' },
    renamed: { label: 'R', title: 'Renomeado', className: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    modified: { label: 'M', title: 'Modificado', className: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    added: { label: 'A', title: 'Adicionado', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    conflicted: { label: '!', title: 'Em conflito', className: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
    untracked: { label: 'U', title: 'Novo (não rastreado)', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
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
