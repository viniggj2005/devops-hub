import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import React, { useEffect, useRef, useState } from 'react';
import { gitErrorMessage } from '../functions/gitStatus';
import { Modal } from '../../shared/components/modals/Modal';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { useConfirmToast } from '../../shared/components/toasts/ConfirmToast';
import * as octohubDtos from '../../../../bindings/docker-manager-go/src/octohub/dtos/models';
import { KeyRound, LockKeyhole, Pencil, Plus, Server, Trash2, Upload } from 'lucide-react';
import { ListGitCredentials, RemoveGitCredential, SaveGitCredential } from '../../../../bindings/docker-manager-go/src/octohub/handlers/repositoryhandler';

type CredentialTab = 'password' | 'ssh';

const emptyForm = { host: '', username: '', password: '', privateKey: '', passphrase: '' };

const inputClass = 'w-full px-3 py-2 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60';

const GitCredentialsModal: React.FC = () => {
    const { token } = useAuth();
    const confirmToast = useConfirmToast();
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const [tab, setTab] = useState<CredentialTab>('password');
    const [mode, setMode] = useState<'list' | 'form'>('list');
    const [editing, setEditing] = useState<octohubDtos.GitCredentialDto | null>(null);
    const [credentials, setCredentials] = useState<octohubDtos.GitCredentialDto[]>([]);
    const { credentialsTarget, closeCredentials, notifyCredentialsChange } = useOctohubRepository();

    const open = credentialsTarget !== null;

    const startForm = (existing: octohubDtos.GitCredentialDto | null, host: string) => {
        setEditing(existing);
        setForm({ ...emptyForm, host: existing?.host ?? host, username: existing?.username ?? '' });
        setTab(existing?.hasKey && !existing.hasPassword ? 'ssh' : 'password');
        setMode('form');
    };

    const load = async () => {
        if (!token) return [];
        const list = (await ListGitCredentials(token)) || [];
        setCredentials(list);
        return list;
    };

    useEffect(() => {
        if (!open) return;
        setMode('list');
        setEditing(null);
        setForm(emptyForm);
        load()
            .then((list) => {
                const host = credentialsTarget?.host;
                if (host) startForm(list.find((credential) => credential.host === host) ?? null, host);
            })
            .catch((error) => toast.error(errorMessage(error)));
    }, [open, credentialsTarget?.host]);

    const update = (field: keyof typeof emptyForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((previous) => ({ ...previous, [field]: event.target.value }));

    const loadKeyFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const privateKey = await file.text();
        setForm((previous) => ({ ...previous, privateKey }));
    };

    const save = async () => {
        if (!token) return;
        setSaving(true);
        try {
            const usesPassword = tab === 'password';
            const saved = await SaveGitCredential(token, {
                host: form.host,
                username: form.username,
                password: usesPassword ? form.password : '',
                privateKey: usesPassword ? '' : form.privateKey,
                passphrase: usesPassword ? '' : form.passphrase,
            });
            toast.success(`Login de ${saved?.host ?? form.host} salvo.`);
            notifyCredentialsChange();
            const retry = credentialsTarget?.retry;
            if (retry) {
                closeCredentials();
                retry();
                return;
            }
            await load();
            setMode('list');
        } catch (error) {
            toast.error(gitErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const remove = (credential: octohubDtos.GitCredentialDto) => {
        if (!token) return;
        confirmToast({
            id: `git-credential-${credential.id}`,
            title: `Remover login de ${credential.host}?`,
            message: `Remover o login de ${credential.host} do OctoHub?`,
            onConfirm: async () => {
                await RemoveGitCredential(token, credential.id);
                notifyCredentialsChange();
                await load();
            },
        });
    };

    const canSave = form.host.trim() !== '' && (tab === 'password'
        ? form.username.trim() !== '' && (form.password !== '' || Boolean(editing?.hasPassword))
        : form.privateKey.trim() !== '' || Boolean(editing?.hasKey));

    const tabClass = (value: CredentialTab) =>
        `flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${tab === value
            ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`;

    const buttonClass = 'px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10';

    return (
        <Modal
            size="md"
            isOpen={open}
            onClose={() => !saving && closeCredentials()}
            title="Credenciais Git"
            description={mode === 'form' ? form.host || 'novo servidor' : undefined}
            icon={<KeyRound className="w-5 h-5 text-emerald-500" />}
            footer={
                mode === 'form' ? (
                    <>
                        <button onClick={() => setMode('list')} disabled={saving} className={`mr-auto ${buttonClass}`}>
                            Ver todos os logins
                        </button>
                        <button onClick={closeCredentials} disabled={saving} className={buttonClass}>Cancelar</button>
                        <button
                            onClick={save}
                            disabled={!canSave || saving}
                            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-white/10 disabled:text-zinc-500 flex items-center gap-2"
                        >
                            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {credentialsTarget?.retry ? 'Salvar e tentar de novo' : 'Salvar'}
                        </button>
                    </>
                ) : (
                    <button onClick={closeCredentials} className={buttonClass}>Fechar</button>
                )
            }
        >
            {mode === 'list' ? (
                <div className="space-y-4">
                    <p className="text-xs text-zinc-500">
                        Logins para servidores Git que não são o GitHub, como gitlab.com, o GitLab da empresa ou o Bitbucket.
                        O GitHub usa a conta conectada no OctoHub.
                    </p>
                    {credentials.length === 0 ? (
                        <p className="py-4 text-center text-xs text-zinc-500 italic">Nenhum login salvo ainda.</p>
                    ) : (
                        <div className="space-y-2">
                            {credentials.map((credential) => (
                                <div key={credential.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                                    <Server className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold font-mono truncate">{credential.host}</div>
                                        <div className="text-[11px] text-zinc-500 truncate">
                                            {[credential.username, credential.hasPassword && 'senha/token', credential.hasKey && 'chave SSH'].filter(Boolean).join(' · ')}
                                        </div>
                                    </div>
                                    <button onClick={() => startForm(credential, credential.host)} title="Editar" className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/10">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => remove(credential)} title="Remover" className="p-2 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => startForm(null, '')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-dashed border-emerald-500/30"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar login
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Servidor</label>
                        <input
                            value={form.host}
                            disabled={Boolean(editing)}
                            onChange={update('host')}
                            placeholder="gitlab.com ou gitlab.suaempresa.com.br"
                            className={inputClass}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                        <button className={tabClass('password')} onClick={() => setTab('password')}>
                            <LockKeyhole className="w-3.5 h-3.5" />
                            Usuário e senha/token
                        </button>
                        <button className={tabClass('ssh')} onClick={() => setTab('ssh')}>
                            <KeyRound className="w-3.5 h-3.5" />
                            Chave SSH
                        </button>
                    </div>

                    {tab === 'password' ? (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Usuário</label>
                                <input value={form.username} onChange={update('username')} className={inputClass} autoFocus />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Senha ou token</label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={update('password')}
                                    placeholder={editing?.hasPassword ? 'Deixe em branco para manter a atual' : ''}
                                    className={inputClass}
                                />
                            </div>
                            <p className="text-[11px] text-zinc-500">
                                Vale para remotos HTTPS (https://...). No GitLab, use um Personal Access Token no lugar da senha
                                (Preferences → Access Tokens) com as permissões read_api (para listar os projetos na hora de clonar),
                                read_repository e write_repository.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Chave privada</label>
                                    <button
                                        onClick={() => fileInput.current?.click()}
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        Carregar arquivo
                                    </button>
                                    <input ref={fileInput} type="file" className="hidden" onChange={loadKeyFile} />
                                </div>
                                <textarea
                                    rows={6}
                                    value={form.privateKey}
                                    onChange={update('privateKey')}
                                    placeholder={editing?.hasKey ? 'Deixe em branco para manter a chave atual' : '-----BEGIN OPENSSH PRIVATE KEY-----'}
                                    className={`${inputClass} font-mono text-[10px] resize-none`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Senha da chave (se tiver)</label>
                                <input type="password" value={form.passphrase} onChange={update('passphrase')} className={inputClass} />
                            </div>
                            <p className="text-[11px] text-zinc-500">
                                Vale para remotos SSH (git@servidor:grupo/projeto.git). A chave pública correspondente precisa estar
                                cadastrada no servidor (no GitLab: Preferences → SSH Keys).
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default GitCredentialsModal;
