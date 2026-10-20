import React, { useEffect, useState } from 'react';
import * as octohubDtos from '../../../../bindings/docker-manager-go/src/octohub/dtos/models';
import { Modal } from '../../shared/components/modals/Modal';
import { Check, Copy, ExternalLink, RotateCw } from 'lucide-react';
import { Browser, Clipboard } from '@wailsio/runtime';

export interface DeviceLoginState {
    open: boolean;
    loading: boolean;
    error: string | null;
    deviceCode: octohubDtos.DeviceCodeDto | null;
}

interface DeviceLoginModalProps {
    state: DeviceLoginState;
    onRetry: () => void;
    onClose: () => void;
}

const DeviceLoginModal: React.FC<DeviceLoginModalProps> = ({ state, onRetry, onClose }) => {
    const [copied, setCopied] = useState(false);
    const { open, loading, error, deviceCode } = state;

    useEffect(() => setCopied(false), [deviceCode]);

    const copyAndOpen = async () => {
        if (!deviceCode) return;
        await Clipboard.SetText(deviceCode.userCode);
        setCopied(true);
        Browser.OpenURL(deviceCode.verificationUri);
    };

    return (
        <Modal
            size="sm"
            isOpen={open}
            onClose={onClose}
            title="Conectar conta do GitHub"
            icon={<img src="/gitoctocat.svg" alt="" className="w-5 h-5 brightness-0 dark:invert" />}
        >
            {loading && (
                <div className="flex flex-col items-center gap-4 py-6">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Solicitando código ao GitHub...</p>
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <p className="text-sm text-rose-500">{error}</p>
                    <button
                        onClick={onRetry}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center gap-2 transition-colors"
                    >
                        <RotateCw className="w-4 h-4" />
                        Tentar novamente
                    </button>
                </div>
            )}

            {!loading && !error && deviceCode && (
                <div className="flex flex-col items-center gap-5 text-center">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                        Digite este código no GitHub para autorizar o OctoHub:
                    </p>
                    <div className="px-6 py-3 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-mono text-3xl font-bold tracking-[0.3em] select-all">
                        {deviceCode.userCode}
                    </div>
                    <button
                        onClick={copyAndOpen}
                        className="w-full px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        Copiar código e abrir GitHub
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        Aguardando autorização...
                    </div>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                        A conta conectada será a que estiver logada no navegador. Para adicionar outra conta,
                        troque de conta no GitHub antes de colar o código.
                    </p>
                </div>
            )}
        </Modal>
    );
};

export default DeviceLoginModal;
