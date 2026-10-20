import iziToast from 'izitoast';
import { createPortal } from 'react-dom';
import { VsCodeIcon } from '../../shared/Icons';
import { escapeHtml } from '../functions/gitStatus';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import * as octohubStructs from '../../../../bindings/docker-manager-go/src/octohub/structs/models';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { X, GitMerge, TriangleAlert, CircleCheck, LoaderCircle, Play } from 'lucide-react';
import { CheckConflicts, ContinueOperation, OpenFileInEditor, ResolveConflict } from '../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';

const POLL_INTERVAL = 1500;

const operationLabels: Record<string, string> = {
    merge: 'merge',
    squash: 'squash',
    rebase: 'rebase',
    revert: 'revert',
    'cherry-pick': 'cherry-pick',
};

const ConflictResolutionModal: React.FC = () => {
    const resolvedCount = useRef(0);
    const order = useRef<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [continuing, setContinuing] = useState(false);
    const [busyFile, setBusyFile] = useState<string | null>(null);
    const known = useRef(new Map<string, octohubStructs.ConflictFile>());
    const [files, setFiles] = useState<octohubStructs.ConflictFile[]>([]);
    const [operation, setOperation] = useState<octohubStructs.OperationState | null>(null);
    const { conflictsOpen, closeConflicts, currentBranch, notifyChange } = useOctohubRepository();

    const check = useCallback(async () => {
        try {
            const report = await CheckConflicts(order.current);
            report.Files.forEach((file) => {
                if (!order.current.includes(file.File)) order.current.push(file.File);
                const before = known.current.get(file.File);
                known.current.set(file.File, file.Resolved && !file.Kind && before ? { ...before, Resolved: true, Markers: 0 } : file);
            });
            const next = order.current.map((name) => known.current.get(name)!).filter(Boolean);
            const resolved = next.filter((file) => file.Resolved).length;
            if (resolved !== resolvedCount.current) {
                resolvedCount.current = resolved;
                notifyChange();
            }
            setFiles(next);
            setOperation(report.Operation);
            setLoaded(true);
        } catch {
            // A verificação roda sozinha de tempos em tempos; uma falha passageira (ex.: index.lock) é ignorada.
        }
    }, [notifyChange]);

    const reset = () => {
        order.current = [];
        known.current = new Map();
        resolvedCount.current = 0;
        setFiles([]);
        setLoaded(false);
    };

    useEffect(() => {
        if (!conflictsOpen) return;
        reset();
        check();
        const timer = setInterval(check, POLL_INTERVAL);
        window.addEventListener('focus', check);
        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', check);
        };
    }, [conflictsOpen, check]);

    if (!conflictsOpen) return null;

    const kind = operation?.Kind ?? '';
    const pending = files.filter((file) => !file.Resolved);
    const allResolved = loaded && pending.length === 0;
    const concludesWithCommit = kind === 'merge' || kind === 'squash';
    const oursLabel = kind === 'rebase' ? 'da base' : `de ${currentBranch || 'HEAD'}`;
    const theirsLabels: Record<string, string> = {
        '': 'do stash',
        merge: `de ${operation?.Branch || 'outra branch'}`,
        squash: 'da branch mesclada',
        rebase: `de ${operation?.Branch || 'sua branch'}`,
        revert: 'da reversão',
        'cherry-pick': 'do commit escolhido',
    };
    const theirsLabel = theirsLabels[kind] ?? 'da outra versão';

    const resolve = async (file: string, resolution: string) => {
        setBusyFile(file);
        try {
            await ResolveConflict(file, resolution);
            await check();
        } catch (err) {
            iziToast.error({ title: 'Erro', message: escapeHtml(errorMessage(err)), position: 'bottomRight' });
        } finally {
            setBusyFile(null);
        }
    };

    const openFile = (file: string) => {
        OpenFileInEditor(file).catch((err) => {
            iziToast.error({ title: 'Erro', message: escapeHtml(`Erro ao abrir no editor: ${errorMessage(err)}`), position: 'bottomRight' });
        });
    };

    const handleContinue = async () => {
        setContinuing(true);
        try {
            const next = await ContinueOperation('');
            notifyChange();
            if (next.Kind && next.ConflictingFiles.length > 0) {
                reset();
                await check();
                iziToast.warning({ title: 'Conflitos', message: 'O próximo commit também teve conflito.', position: 'bottomRight' });
            } else {
                iziToast.success({ title: 'OctoHub', message: `${operationLabels[kind] ?? 'Operação'} concluído.`, position: 'bottomRight' });
                closeConflicts();
            }
        } catch (err) {
            iziToast.error({ title: 'Erro', message: escapeHtml(errorMessage(err)), position: 'bottomRight' });
        } finally {
            setContinuing(false);
        }
    };

    const actionButton = 'shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50';
    const neutralButton = `${actionButton} bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-800 dark:text-zinc-200`;

    const renderStatus = (file: octohubStructs.ConflictFile) => {
        if (file.Resolved) return <span className="text-emerald-600 dark:text-emerald-400">Resolvido</span>;
        if (file.Kind === 'deleted-by-us') return `Removido ${oursLabel} e alterado ${theirsLabel}`;
        if (file.Kind === 'deleted-by-them') return `Alterado ${oursLabel} e removido ${theirsLabel}`;
        if (file.Binary) return 'Arquivo binário: escolha uma das versões';
        if (file.Markers > 0) return `${file.Markers} trecho${file.Markers === 1 ? '' : 's'} em conflito`;
        if (file.SameAsOurs) return `Sem marcadores e igual à versão ${oursLabel}. Confirme se é isso mesmo.`;
        return 'Precisa de revisão';
    };

    const renderActions = (file: octohubStructs.ConflictFile) => {
        const busy = busyFile === file.File || continuing;
        if (file.Resolved) return <CircleCheck className="w-5 h-5 text-emerald-500 shrink-0" />;
        if (file.Kind === 'deleted-by-us' || file.Kind === 'deleted-by-them') {
            return (
                <>
                    <button disabled={busy} onClick={() => resolve(file.File, 'keep')} className={neutralButton}>Manter arquivo</button>
                    <button disabled={busy} onClick={() => resolve(file.File, 'delete')} className={`${actionButton} bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20`}>Remover</button>
                </>
            );
        }
        return (
            <>
                {!file.Binary && (
                    <button
                        disabled={busy}
                        onClick={() => openFile(file.File)}
                        title="Abrir este arquivo no VS Code para resolver os conflitos"
                        className={`${actionButton} group/vscode pl-2.5 text-white bg-gradient-to-b from-[#1f9cf0] to-[#0065a9] hover:from-[#33a8f5] hover:to-[#0073bd] shadow-md shadow-[#007acc]/30 ring-1 ring-inset ring-white/15 active:scale-95`}
                    >
                        <VsCodeIcon className="w-4 h-4 drop-shadow-sm transition-transform group-hover/vscode:scale-110" />
                        VS Code
                    </button>
                )}
                {file.SameAsOurs || (!file.Binary && file.Markers === 0) ? (
                    <button disabled={busy} onClick={() => resolve(file.File, 'keep')} className={`${actionButton} bg-emerald-500 hover:bg-emerald-600 text-white`}>
                        Está resolvido
                    </button>
                ) : (
                    <>
                        <button disabled={busy} onClick={() => resolve(file.File, 'ours')} className={neutralButton} title={`Usar o arquivo inteiro na versão ${oursLabel}`}>
                            Usar {oursLabel}
                        </button>
                        <button disabled={busy} onClick={() => resolve(file.File, 'theirs')} className={neutralButton} title={`Usar o arquivo inteiro na versão ${theirsLabel}`}>
                            Usar {theirsLabel}
                        </button>
                    </>
                )}
            </>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                    onClick={() => !continuing && closeConflicts()}
                />

                <div className="relative w-full max-w-2xl transform overflow-hidden rounded-[2.5rem] bg-white dark:bg-zinc-900 text-left align-middle shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-zinc-200 dark:border-white/10 transition-all animate-in zoom-in-95 fade-in duration-300 flex flex-col max-h-[85vh]">
                    <button
                        onClick={closeConflicts}
                        disabled={continuing}
                        className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-all z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="pt-10 pb-6 text-center shrink-0 px-12">
                        <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-all duration-500 ${allResolved ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            {allResolved ? <CircleCheck className="w-10 h-10 text-emerald-500" /> : <GitMerge className="w-10 h-10 text-red-500" />}
                        </div>
                        <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-2">
                            {allResolved ? 'Conflitos resolvidos' : 'Conflitos Detectados'}
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                            {allResolved
                                ? kind
                                    ? concludesWithCommit
                                        ? `Tudo certo. Conclua o ${kind} agora ou feche para revisar a mensagem do commit.`
                                        : `Tudo certo. Continue o ${operationLabels[kind] ?? kind} para seguir.`
                                    : 'Tudo certo. O stash continua em Stashes pendentes; descarte-o quando não precisar mais.'
                                : 'Resolva no editor tirando os marcadores <<<<<<< e >>>>>>>, ou escolha uma versão inteira. O OctoHub percebe sozinho quando cada arquivo fica resolvido.'}
                        </p>
                    </div>

                    <div className="px-8 flex-1 overflow-y-auto custom-scrollbar">
                        {!loaded ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                                <LoaderCircle className="w-4 h-4 animate-spin" />
                                Verificando arquivos...
                            </div>
                        ) : files.length === 0 ? (
                            <p className="py-8 text-center text-sm text-zinc-500">Nenhum arquivo em conflito.</p>
                        ) : (
                            <div className="space-y-3 pb-2">
                                {files.map((file) => (
                                    <div
                                        key={file.File}
                                        className={`flex items-center justify-between gap-3 p-4 border rounded-2xl transition-colors ${file.Resolved
                                            ? 'bg-emerald-500/5 border-emerald-500/20'
                                            : 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {file.Resolved
                                                ? <CircleCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                                : <TriangleAlert className="w-4 h-4 text-red-500 shrink-0" />}
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate" title={file.File}>{file.File}</div>
                                                <div className="text-[11px] text-zinc-500">{renderStatus(file)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {busyFile === file.File ? <LoaderCircle className="w-4 h-4 animate-spin text-zinc-400" /> : renderActions(file)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 px-8 py-5 flex items-center gap-3 border-t border-zinc-100 dark:border-white/5">
                        <div className="flex-1 min-w-0">
                            {loaded && files.length > 0 && (
                                <>
                                    <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                                        {files.length - pending.length} de {files.length} resolvidos
                                    </div>
                                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${((files.length - pending.length) / files.length) * 100}%` }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={closeConflicts}
                            disabled={continuing}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
                        >
                            {allResolved && concludesWithCommit ? 'Revisar mensagem' : 'Fechar'}
                        </button>
                        {allResolved && kind && (
                            <button
                                onClick={handleContinue}
                                disabled={continuing}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                            >
                                {continuing ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                {concludesWithCommit ? `Concluir ${kind}` : `Continuar ${operationLabels[kind] ?? kind}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConflictResolutionModal;
