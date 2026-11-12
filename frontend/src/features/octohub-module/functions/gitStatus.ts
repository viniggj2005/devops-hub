import { findErrorPayload } from '../../i18n/TranslateError';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import * as octohubStructs from '../../../../bindings/docker-manager-go/src/octohub/structs/models';

export const getConflictingFiles = (files: octohubStructs.FilesStatus[] | null) =>
    (files || []).filter((file) => file.Kind === 'conflicted').map((file) => file.FileName);

export const isConflictError = (error: unknown) => {
    const message = errorMessage(error).toLowerCase();
    return message.includes('conflict') || message.includes('needs merge');
};

export const fileKindStyles: Record<string, { label: string; className: string }> = {
    added: { label: 'A', className: 'text-git-added bg-git-added/10 border-git-added/20' },
    deleted: { label: 'D', className: 'text-git-deleted bg-git-deleted/10 border-git-deleted/20' },
    renamed: { label: 'R', className: 'text-git-renamed bg-git-renamed/10 border-git-renamed/20' },
    modified: { label: 'M', className: 'text-git-modified bg-git-modified/10 border-git-modified/20' },
    conflicted: { label: '!', className: 'text-git-conflicted bg-git-conflicted/10 border-git-conflicted/20' },
    untracked: { label: 'U', className: 'text-git-untracked bg-git-untracked/10 border-git-untracked/20' },
};

export const authHostFromError = (error: unknown) => findErrorPayload(error, 'octohub.authRejected')?.params?.host ?? null;

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
