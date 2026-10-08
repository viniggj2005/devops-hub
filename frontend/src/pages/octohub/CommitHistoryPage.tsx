import iziToast from 'izitoast';
import { VsCodeIcon } from '../../features/shared/Icons';
import { octohubStructs } from '../../../wailsjs/go/models';
import { ClipboardSetText } from '../../../wailsjs/runtime/runtime';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useConfirmToast } from '../../features/shared/components/toasts/ConfirmToast';
import { DiffHunk, parseDiff } from '../../features/octohub-module/functions/diffParser';
import CommitBox from '../../features/octohub-module/components/commit-history/CommitBox';
import StashChangesModal from '../../features/octohub-module/components/StashChangesModal';
import DiffViewer from '../../features/octohub-module/components/commit-history/DiffViewer';
import CommitSidebar from '../../features/octohub-module/components/commit-history/CommitSidebar';
import ChangesSidebar from '../../features/octohub-module/components/commit-history/ChangesSidebar';
import OperationBanner from '../../features/octohub-module/components/commit-history/OperationBanner';
import { useOctohubRepository } from '../../features/octohub-module/contexts/OctohubRepositoryContext';
import ModifiedFileList from '../../features/octohub-module/components/commit-history/ModifiedFileList';
import CommitDetailsHeader from '../../features/octohub-module/components/commit-history/CommitDetailsHeader';
import ContextMenu, { ContextMenuEntry } from '../../features/octohub-module/components/commit-history/ContextMenu';
import { escapeHtml, getConflictingFiles, isConflictError } from '../../features/octohub-module/functions/gitStatus';
import CommitActionModal, { CommitAction } from '../../features/octohub-module/components/commit-history/CommitActionModals';
import { ALL_SELECTED, FileSelection, NONE_SELECTED, selectedLineSet, setLines } from '../../features/octohub-module/functions/lineSelection';
import { ListCommits, GetCommitModifications, GetCommitedFileChanges, GetGitStatus, GetUncommitedFileChanges, Commit, DiscardChanges } from '../../../wailsjs/go/octohubHandler/GitCommitsHandler';
import { GitCommit, FileCode, Clock, FolderGit2, FolderPlus, GitCommitHorizontal, ArrowUpDown, Undo2, GitBranchPlus, Tag, Cherry, Copy, EyeOff, ClipboardCopy, FolderSearch, ExternalLink, SquareCheck, Square } from 'lucide-react';
import { GetStashedFileDiff, ListStashes, PopStash, DropStash, GetOperationState, ContinueOperation, AbortOperation, SkipRebaseCommit, CheckoutCommit, RevertCommit, HasUncommittedChanges, GetCurrentBranch, IgnoreFile, IgnoreExtension, RevealInExplorer, OpenWithDefaultProgram, OpenFileInEditor } from '../../../wailsjs/go/octohubHandler/GitBranchHandler';

type DiffSource = 'working' | 'stash' | 'commit';

const statusKey = (files: octohubStructs.FilesStatus[]) =>
    files.map(file => `${file.Status}\0${file.FileName}\0${file.OldFileName}`).join('\n');

const commitsKey = (commits: octohubStructs.Commit[]) =>
    commits.map(commit => `${commit.Hash}\0${(commit.Tags ?? []).join('\0')}`).join('\n');

const CommitHistoryPage: React.FC = () => {

    const [_, setPage] = useState(0);
    const confirmToast = useConfirmToast();
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [description, setDescription] = useState('');
    const [committing, setCommitting] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadingDiff, setLoadingDiff] = useState(false);
    const [checkoutBusy, setCheckoutBusy] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [operationBusy, setOperationBusy] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);
    const [fileDiff, setFileDiff] = useState<string | null>(null);
    const [stashes, setStashes] = useState<octohubStructs.Stash[]>([]);
    const [diffSource, setDiffSource] = useState<DiffSource>('working');
    const [commits, setCommits] = useState<octohubStructs.Commit[]>([]);
    const [fileDiffHash, setFileDiffHash] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'changes' | 'history'>('changes');
    const [selections, setSelections] = useState<Record<string, FileSelection>>({});
    const [changedFiles, setChangedFiles] = useState<octohubStructs.FilesStatus[]>([]);
    const [operation, setOperation] = useState<octohubStructs.OperationState | null>(null);
    const [checkoutTarget, setCheckoutTarget] = useState<octohubStructs.Commit | null>(null);
    const [selectedCommit, setSelectedCommit] = useState<octohubStructs.Commit | null>(null);
    const [modifications, setModifications] = useState<octohubStructs.FileModification[]>([]);
    const [fileMenu, setFileMenu] = useState<{ x: number; y: number; file: octohubStructs.FilesStatus } | null>(null);
    const [commitMenu, setCommitMenu] = useState<{ x: number; y: number; commit: octohubStructs.Commit } | null>(null);
    const [commitAction, setCommitAction] = useState<{ action: CommitAction; commit: octohubStructs.Commit } | null>(null);
    const { loading: loadingRepository, repository, revision, currentBranch, notifyChange, addRepository, openConflicts } = useOctohubRepository();

    const diffRequest = useRef(0);
    const activeTabRef = useRef(activeTab);
    const selectionsRef = useRef(selections);
    const selectedFileRef = useRef(selectedFile);
    const hasRepository = Boolean(repository?.exists);
    activeTabRef.current = activeTab;
    selectionsRef.current = selections;
    selectedFileRef.current = selectedFile;

    const [filesWidth, setFilesWidth] = useState(350);
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [resizingFiles, setResizingFiles] = useState(false);
    const [resizingSidebar, setResizingSidebar] = useState(false);

    const startResizingSidebar = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setResizingSidebar(true);
    }, []);

    const startResizingFiles = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setResizingFiles(true);
    }, []);

    const stopResizing = useCallback(() => {
        setResizingSidebar(false);
        setResizingFiles(false);
    }, []);

    const resize = useCallback((event: MouseEvent) => {
        if (resizingSidebar) {
            const newWidth = event.clientX;
            if (newWidth > 200 && newWidth < 600) setSidebarWidth(newWidth);
        } else if (resizingFiles) {
            const newWidth = event.clientX - sidebarWidth;
            if (newWidth > 200 && newWidth < 800) setFilesWidth(newWidth);
        }
    }, [resizingSidebar, resizingFiles, sidebarWidth]);

    useEffect(() => {
        if (resizingSidebar || resizingFiles) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resizingSidebar, resizingFiles, resize, stopResizing]);

    const lastCommitElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(previousPage => {
                    const nextPage = previousPage + 1;
                    fetchCommits(nextPage, true);
                    return nextPage;
                });
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    const fetchCommits = async (pageNum = 0, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const data = await ListCommits(pageNum);
            if (data && data.length > 0) {
                if (append) {
                    setCommits(previousCommits => [...previousCommits, ...data]);
                } else {
                    setCommits(data);
                    setSelectedCommit(previous => previous && data.some(commit => commit.Hash === previous.Hash) ? previous : data[0]);
                }
                if (data.length < 15) setHasMore(false);
                else setHasMore(true);
            } else {
                if (!append) {
                    setCommits([]);
                    setSelectedCommit(null);
                }
                setHasMore(false);
            }
        } catch (err: any) {
            console.error("Erro ao buscar commits:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const fetchGitStatus = async () => {
        try {
            const files = (await GetGitStatus()) || [];
            const changed = statusKey(files) !== statusKey(changedFiles);
            setChangedFiles(previous => statusKey(previous) === statusKey(files) ? previous : files);
            setSelections(previous => Object.fromEntries(
                files.filter(file => previous[file.FileName]).map(file => [file.FileName, previous[file.FileName]])
            ));

            const stashesList = await ListStashes();
            setStashes(stashesList || []);
            setOperation(await GetOperationState().catch(() => null));
            return changed;
        } catch (err: any) {
            console.error("Erro ao buscar status do git:", err);
            return false;
        }
    };

    const refreshSelectedDiff = async () => {
        if (activeTab !== 'changes' || diffSource !== 'working') return;
        const file = changedFiles.find(item => item.FileName === selectedFile);
        if (!file) return;
        const result = await GetUncommitedFileChanges(file).catch(() => null);
        if (result && result.Hash !== fileDiffHash) fetchUncommitedDiff(file);
    };

    const refreshWorkingTree = async () => {
        const statusChanged = await fetchGitStatus();
        if (!statusChanged) await refreshSelectedDiff();
    };

    const syncWithDisk = async () => {
        if (!hasRepository || committing || operationBusy) return;
        const [branch, firstPage] = await Promise.all([
            GetCurrentBranch().catch(() => null),
            ListCommits(0).catch(() => null),
        ]);
        const latestCommits = firstPage ?? [];
        const historyChanged = commitsKey(latestCommits) !== commitsKey(commits.slice(0, latestCommits.length))
            || (latestCommits.length === 0 && commits.length > 0);
        if (branch !== currentBranch || historyChanged) {
            notifyChange();
            return;
        }
        await refreshWorkingTree();
    };

    const syncWithDiskRef = useRef(syncWithDisk);
    syncWithDiskRef.current = syncWithDisk;

    useEffect(() => {
        if (!hasRepository) return;
        let lastSync = 0;
        const onWindowFocus = () => {
            if (document.visibilityState === 'hidden' || Date.now() - lastSync < 1000) return;
            lastSync = Date.now();
            syncWithDiskRef.current();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            const reloadShortcut = event.key === 'F5' || ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'r');
            if (!reloadShortcut) return;
            event.preventDefault();
            notifyChange();
        };
        window.addEventListener('focus', onWindowFocus);
        window.addEventListener('keydown', onKeyDown);
        document.addEventListener('visibilitychange', onWindowFocus);
        return () => {
            window.removeEventListener('focus', onWindowFocus);
            window.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('visibilitychange', onWindowFocus);
        };
    }, [hasRepository, notifyChange]);

    const runOperation = async (action: () => Promise<octohubStructs.OperationState | void>, doneMessage: string) => {
        setOperationBusy(true);
        try {
            const next = await action();
            if (next && next.Kind) {
                if (next.ConflictingFiles.length > 0) openConflicts();
            } else {
                iziToast.success({ title: 'OctoHub', message: doneMessage, position: 'bottomRight' });
                setSummary('');
                setDescription('');
            }
            setSelections({});
            notifyChange();
        } catch (err: any) {
            iziToast.error({ title: 'Erro', message: escapeHtml(String(err)), position: 'bottomRight' });
        } finally {
            setOperationBusy(false);
        }
    };

    const continueOperation = () => {
        const message = [summary.trim(), description.trim()].filter(Boolean).join('\n\n');
        runOperation(() => ContinueOperation(message), 'Operação concluída.');
    };

    const skipRebaseCommit = () => runOperation(SkipRebaseCommit, 'Commit pulado.');

    const checkoutCommit = async (commit: octohubStructs.Commit) => {
        const short = commit.Hash.slice(0, 7);
        if (await HasUncommittedChanges().catch(() => false)) {
            setCheckoutTarget(commit);
            return;
        }
        confirmToast({
            id: 'octohub-checkout-commit',
            title: `Agora em ${short} (HEAD destacado).`,
            message: `Ir para o commit <b>${short}</b>? Você vai ficar em "HEAD destacado": para fazer commits a partir dele, crie uma branch.`,
            onConfirm: async () => {
                await CheckoutCommit(commit.Hash, false);
                notifyChange();
            },
        });
    };

    const confirmCheckout = async (action: 'bring' | 'leave') => {
        if (!checkoutTarget) return;
        setCheckoutBusy(true);
        try {
            await CheckoutCommit(checkoutTarget.Hash, action === 'leave');
            iziToast.success({ title: 'OctoHub', message: `Agora em ${checkoutTarget.Hash.slice(0, 7)} (HEAD destacado).`, position: 'bottomRight' });
        } catch (err) {
            if (isConflictError(err)) openConflicts();
            else iziToast.error({ title: 'Erro', message: escapeHtml(String(err)), position: 'bottomRight' });
        } finally {
            setCheckoutBusy(false);
            setCheckoutTarget(null);
            notifyChange();
        }
    };

    const revertCommit = (commit: octohubStructs.Commit) => {
        const short = commit.Hash.slice(0, 7);
        confirmToast({
            id: 'octohub-revert-commit',
            title: `Revert de ${short}.`,
            message: `Criar um commit novo que desfaz <b>${escapeHtml(commit.Title)}</b> (${short})?`,
            onConfirm: async () => {
                const state = await RevertCommit(commit.Hash);
                notifyChange();
                if (state.Kind) openConflicts();
            },
        });
    };

    const copySha = (commit: octohubStructs.Commit) => {
        ClipboardSetText(commit.Hash)
            .then(() => iziToast.success({ message: `SHA ${commit.Hash.slice(0, 7)} copiado.`, position: 'bottomRight' }))
            .catch(() => iziToast.error({ title: 'Erro', message: 'Não foi possível copiar o SHA.', position: 'bottomRight' }));
    };

    const runFileAction = (action: () => Promise<unknown>, success?: string, refresh = false) => {
        action()
            .then(() => {
                if (success) iziToast.success({ title: 'OctoHub', message: escapeHtml(success), position: 'bottomRight' });
                if (refresh) notifyChange();
            })
            .catch((err) => iziToast.error({ title: 'Erro', message: escapeHtml(String(err)), position: 'bottomRight' }));
    };

    const copyText = (text: string, success: string) => runFileAction(() => ClipboardSetText(text), success);

    const absolutePath = (file: string) => {
        const root = (repository?.path ?? '').replace(/[\\/]+$/, '');
        const separator = root.includes('\\') ? '\\' : '/';
        return `${root}${separator}${file.split('/').join(separator)}`;
    };

    const extensionOf = (file: string) => {
        const name = file.split('/').pop() ?? '';
        const dot = name.lastIndexOf('.');
        return dot > 0 ? name.slice(dot + 1) : '';
    };

    const fileMenuEntries = (file: octohubStructs.FilesStatus): ContextMenuEntry[] => {
        const isNew = file.Kind === 'untracked';
        const exists = file.Kind !== 'deleted';
        const extension = extensionOf(file.FileName);
        const included = selectionOf(file.FileName).kind !== 'none';
        const onlyNew = isNew ? undefined : 'Só para arquivos novos: um arquivo já versionado continua rastreado mesmo no .gitignore';
        const entries: ContextMenuEntry[] = [
            { label: 'Descartar alterações...', icon: Undo2, onClick: () => discardFile(file) },
            { label: included ? 'Tirar do commit' : 'Incluir no commit', icon: included ? Square : SquareCheck, onClick: () => setFileIncluded(file.FileName, !included) },
            'separator',
            {
                icon: EyeOff,
                hint: onlyNew,
                disabled: !isNew,
                label: 'Ignorar arquivo (adicionar ao .gitignore)',
                onClick: () => runFileAction(() => IgnoreFile(file.FileName), `${file.FileName} adicionado ao .gitignore.`, true),
            },
        ];
        if (extension) {
            entries.push({
                icon: EyeOff,
                hint: onlyNew,
                disabled: !isNew,
                label: `Ignorar todos os arquivos .${extension}`,
                onClick: () => runFileAction(() => IgnoreExtension(extension), `*.${extension} adicionado ao .gitignore.`, true),
            });
        }
        entries.push(
            'separator',
            { label: 'Copiar caminho do arquivo', icon: ClipboardCopy, onClick: () => copyText(absolutePath(file.FileName), 'Caminho copiado.') },
            { label: 'Copiar caminho relativo', icon: ClipboardCopy, onClick: () => copyText(file.FileName, 'Caminho relativo copiado.') },
            'separator',
            { label: 'Mostrar no Explorer', icon: FolderSearch, onClick: () => runFileAction(() => RevealInExplorer(file.FileName)) },
            { label: 'Abrir no VS Code', icon: VsCodeIcon, disabled: !exists, onClick: () => runFileAction(() => OpenFileInEditor(file.FileName)) },
            { label: 'Abrir com o programa padrão', icon: ExternalLink, disabled: !exists, onClick: () => runFileAction(() => OpenWithDefaultProgram(file.FileName)) },
        );
        return entries;
    };

    const commitMenuEntries = (commit: octohubStructs.Commit): ContextMenuEntry[] => {
        const blocked = Boolean(operation?.Kind);
        const hint = blocked ? 'Conclua ou aborte a operação em andamento antes' : undefined;
        return [
            { label: 'Fazer checkout do commit', icon: GitCommitHorizontal, disabled: blocked, hint, onClick: () => checkoutCommit(commit) },
            { label: 'Reordenar commits...', icon: ArrowUpDown, disabled: blocked, hint, onClick: () => setCommitAction({ action: 'reorder', commit }) },
            { label: 'Reverter alterações do commit', icon: Undo2, disabled: blocked, hint, onClick: () => revertCommit(commit) },
            'separator',
            { label: 'Criar branch a partir do commit...', icon: GitBranchPlus, onClick: () => setCommitAction({ action: 'branch', commit }) },
            { label: 'Criar tag...', icon: Tag, onClick: () => setCommitAction({ action: 'tag', commit }) },
            { label: 'Cherry-pick do commit...', icon: Cherry, disabled: blocked, hint, onClick: () => setCommitAction({ action: 'cherry-pick', commit }) },
            'separator',
            { label: 'Copiar SHA', icon: Copy, onClick: () => copySha(commit) },
        ];
    };

    const abortOperation = () => {
        if (!operation?.Kind) return;
        confirmToast({
            id: 'octohub-abort-operation',
            title: `${operation.Kind} abortado.`,
            message: `Abortar o ${operation.Kind}? A branch volta a ficar como estava antes de começar.`,
            onConfirm: async () => {
                await AbortOperation();
                setSummary('');
                setDescription('');
                setSelections({});
                notifyChange();
            },
        });
    };

    const showConflicts = async () => {
        const conflicts = getConflictingFiles(await GetGitStatus().catch(() => []));
        if (conflicts.length > 0) openConflicts();
        return conflicts;
    };

    const handlePopStash = async (stashID: string) => {
        try {
            await PopStash(stashID);
            notifyChange();
            iziToast.success({ title: 'Sucesso', message: 'Stash restaurado.', position: 'bottomRight' });
        } catch (err: any) {
            if (isConflictError(err) && (await showConflicts()).length > 0) {
                notifyChange();
                return;
            }
            iziToast.error({ title: 'Erro', message: "Erro ao restaurar stash: " + err, position: 'bottomRight' });
        }
    };

    const handleDropStash = async (stashID: string) => {
        if (!confirm("Tem certeza que deseja descartar este stash permanentemente?")) return;
        try {
            await DropStash(stashID);
            fetchGitStatus();
            iziToast.success({ title: 'Sucesso', message: 'Stash descartado.', position: 'bottomRight' });
        } catch (err: any) {
            iziToast.error({ title: 'Erro', message: "Erro ao descartar stash: " + err, position: 'bottomRight' });
        }
    };

    const loadDiff = async (source: DiffSource, filePath: string, request: () => Promise<{ diff: string; hash: string | null }>) => {
        const requestId = ++diffRequest.current;
        setLoadingDiff(true);
        setDiffSource(source);
        setSelectedFile(filePath);
        try {
            const { diff, hash } = await request();
            if (requestId !== diffRequest.current) return;
            setFileDiff(diff);
            setFileDiffHash(hash);
        } catch (err: any) {
            if (requestId !== diffRequest.current) return;
            setFileDiff(null);
            setFileDiffHash(null);
            iziToast.error({ title: 'Erro', message: `Erro ao carregar o diff de ${filePath}: ${err}`, position: 'bottomRight' });
        } finally {
            if (requestId === diffRequest.current) setLoadingDiff(false);
        }
    };

    const fetchUncommitedDiff = (file: octohubStructs.FilesStatus) =>
        loadDiff('working', file.FileName, async () => {
            const result = await GetUncommitedFileChanges(file);
            const selection = selectionsRef.current[file.FileName];
            if (selection?.kind === 'partial' && selection.diffHash !== result.Hash) {
                setSelections(previous => ({ ...previous, [file.FileName]: ALL_SELECTED }));
                iziToast.info({ title: 'Seleção reiniciada', message: `${file.FileName} mudou, então o arquivo voltou a entrar inteiro no commit.`, position: 'bottomRight' });
            }
            return { diff: result.Diff, hash: result.Hash };
        });

    const fetchStashedFileDiff = (stashID: string, filePath: string) =>
        loadDiff('stash', filePath, async () => ({ diff: await GetStashedFileDiff(stashID, filePath), hash: null }));

    const fetchFileDiff = (filePath: string, commitHash?: string) => {
        const hash = commitHash || selectedCommit?.Hash;
        if (!hash) return;
        loadDiff('commit', filePath, async () => ({ diff: await GetCommitedFileChanges(hash, filePath), hash: null }));
    };

    const fetchModifications = async (hash: string, showFirstDiff: boolean) => {
        setLoadingFiles(true);
        try {
            const modificationList = (await GetCommitModifications(hash)) || [];
            setModifications(modificationList);
            if (showFirstDiff) {
                if (modificationList.length > 0) fetchFileDiff(modificationList[0].File, hash);
                else {
                    setSelectedFile(null);
                    setFileDiff(null);
                }
            }
        } catch (err: any) {
            setModifications([]);
        } finally {
            setLoadingFiles(false);
        }
    };

    useEffect(() => {
        diffRequest.current++;
        setPage(0);
        setCommits([]);
        setStashes([]);
        setSummary('');
        setHasMore(true);
        setFileDiff(null);
        setSelections({});
        setDescription('');
        setChangedFiles([]);
        setModifications([]);
        setFileDiffHash(null);
        setSelectedFile(null);
        setSelectedCommit(null);
        setOperation(null);
    }, [repository?.id]);

    const operationKey = operation?.Kind ? `${operation.Kind}\n${operation.Message}` : '';
    useEffect(() => {
        if (!operation || (operation.Kind !== 'merge' && operation.Kind !== 'squash')) return;
        const lines = operation.Message.split('\n').filter(line => !line.startsWith('#'));
        setSummary(lines[0]?.trim() || (operation.Kind === 'squash' ? 'Squash' : 'Merge'));
        setDescription(lines.slice(1).join('\n').trim());
    }, [operationKey]);

    useEffect(() => {
        if (!hasRepository) return;
        refreshWorkingTree();
        setPage(0);
        fetchCommits(0);
    }, [repository?.id, hasRepository, revision]);

    useEffect(() => {
        if (activeTabRef.current !== 'changes') return;
        const target = changedFiles.find(file => file.FileName === selectedFileRef.current) ?? changedFiles[0];
        if (target) {
            fetchUncommitedDiff(target);
        } else {
            diffRequest.current++;
            setSelectedFile(null);
            setFileDiff(null);
            setFileDiffHash(null);
        }
    }, [changedFiles]);

    useEffect(() => {
        if (selectedCommit) {
            fetchModifications(selectedCommit.Hash, activeTabRef.current === 'history');
        }
    }, [selectedCommit]);

    const selectionOf = (fileName: string) => selections[fileName] ?? ALL_SELECTED;

    const toggleFileSelection = (fileName: string) => {
        setSelections(previous => ({
            ...previous,
            [fileName]: (previous[fileName] ?? ALL_SELECTED).kind === 'all' ? NONE_SELECTED : ALL_SELECTED,
        }));
    };

    const setFileIncluded = (fileName: string, included: boolean) => {
        setSelections(previous => ({ ...previous, [fileName]: included ? ALL_SELECTED : NONE_SELECTED }));
    };

    const toggleAllSelection = () => {
        const allSelected = changedFiles.every(file => selectionOf(file.FileName).kind === 'all');
        setSelections(Object.fromEntries(changedFiles.map(file => [file.FileName, allSelected ? NONE_SELECTED : ALL_SELECTED])));
    };

    const parsedDiff = useMemo(() => parseDiff(fileDiff ?? ''), [fileDiff]);
    const currentSelection = selectedFile ? selectionOf(selectedFile) : ALL_SELECTED;
    const selectedLines = useMemo(
        () => selectedLineSet(currentSelection, parsedDiff.changeIndexes),
        [currentSelection, parsedDiff]
    );
    const canSelectLines = activeTab === 'changes' && diffSource === 'working' && !loadingDiff
        && selectedFile !== null && fileDiffHash !== null && parsedDiff.changeIndexes.length > 0;

    const setDiffLines = (indexes: number[], selected: boolean) => {
        if (!selectedFile || !fileDiffHash) return;
        setSelections(previous => ({
            ...previous,
            [selectedFile]: setLines(fileDiffHash, indexes, selected, parsedDiff.changeIndexes, previous[selectedFile] ?? ALL_SELECTED),
        }));
    };

    const conflicts = getConflictingFiles(changedFiles);
    const selectedFilesCount = changedFiles.filter(file => selectionOf(file.FileName).kind !== 'none').length;

    const toRequest = (file: octohubStructs.FilesStatus, selection: FileSelection) => ({
        Kind: file.Kind,
        FileName: file.FileName,
        OldFileName: file.OldFileName,
        All: selection.kind === 'all',
        DiffHash: selection.kind === 'partial' ? selection.diffHash : '',
        Lines: selection.kind === 'partial' ? selection.lines : [],
    });

    const selectedRequests = () => changedFiles.flatMap(file => {
        const selection = selectionOf(file.FileName);
        return selection.kind === 'none' ? [] : [toRequest(file, selection)];
    });

    const describeFiles = (files: octohubStructs.CommitFileSelection[]) => {
        if (files.length === 1) {
            const name = `<b>${escapeHtml(files[0].FileName)}</b>`;
            return files[0].All ? `as alterações de ${name}` : `as linhas selecionadas de ${name}`;
        }
        const partial = files.filter(file => !file.All).length;
        return `as alterações de ${files.length} arquivos${partial > 0 ? ` (${partial} só nas linhas selecionadas)` : ''}`;
    };

    const discard = (files: octohubStructs.CommitFileSelection[], what: string) => {
        if (files.length === 0) return;
        const hasBackup = commits.length > 0;
        confirmToast({
            id: 'octohub-discard',
            title: hasBackup ? 'Alterações descartadas. Uma cópia ficou em Stashes pendentes.' : 'Alterações descartadas.',
            message: `Descartar ${what}? ${hasBackup
                ? 'Uma cópia fica guardada nos stashes desta branch, de onde dá para restaurar.'
                : 'Este repositório ainda não tem commits, então isso não pode ser desfeito.'}`,
            onConfirm: async () => {
                await DiscardChanges(files);
                setSelections(previous => {
                    const next = { ...previous };
                    files.forEach(file => delete next[file.FileName]);
                    return next;
                });
                notifyChange();
            },
        });
    };

    const discardFile = (file: octohubStructs.FilesStatus) => {
        const request = toRequest(file, ALL_SELECTED);
        discard([request], describeFiles([request]));
    };

    const discardSelected = () => {
        const files = selectedRequests();
        discard(files, describeFiles(files));
    };

    const discardAll = () => {
        discard(changedFiles.map(file => toRequest(file, ALL_SELECTED)), `<b>todas</b> as ${changedFiles.length} alterações`);
    };

    const discardHunk = (hunk: DiffHunk) => {
        const file = changedFiles.find(item => item.FileName === selectedFile);
        if (!file || !fileDiffHash) return;
        const selection: FileSelection = hunk.changeIndexes.length === parsedDiff.changeIndexes.length
            ? ALL_SELECTED
            : { kind: 'partial', diffHash: fileDiffHash, lines: hunk.changeIndexes };
        discard([toRequest(file, selection)], `este trecho de <b>${escapeHtml(file.FileName)}</b>`);
    };

    const handleCommit = async () => {
        const files = selectedRequests();

        setCommitting(true);
        try {
            const hash = await Commit(octohubStructs.CommitRequest.createFrom({ Summary: summary, Description: description, Files: files }));
            iziToast.success({ title: 'Commit criado', message: `${hash ? `${hash}: ` : ''}${escapeHtml(summary.trim())}`, position: 'bottomRight' });
            setSummary('');
            setDescription('');
            setSelections({});
            notifyChange();
        } catch (err: any) {
            iziToast.error({ title: 'Erro ao fazer commit', message: String(err), position: 'bottomRight' });
        } finally {
            setCommitting(false);
        }
    };

    const filteredCommits = commits.filter(commit =>
        commit.Title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        commit.Hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        commit.Author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (commit.Tags ?? []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loadingRepository) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500 font-medium">Carregando repositório...</p>
            </div>
        );
    }

    if (!repository || !repository.exists) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
                <div className="p-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                    <FolderGit2 className="w-12 h-12" />
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                        {repository ? 'Pasta do repositório não encontrada' : 'Nenhum repositório aberto'}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {repository
                            ? `${repository.path} não existe mais. Escolha outro repositório no seletor da barra superior ou adicione um novo.`
                            : 'Adicione a pasta de um repositório Git para ver as alterações, o histórico e fazer commits.'}
                    </p>
                </div>
                <button
                    onClick={addRepository}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 transition-colors"
                >
                    <FolderPlus className="w-5 h-5" />
                    Adicionar repositório local
                </button>
            </div>
        );
    }

    if (loading && commits.length === 0 && changedFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500 font-medium">Carregando histórico de commits...</p>
            </div>
        );
    }

    const operationKind = operation?.Kind ?? '';
    const commitMode = operationKind === 'merge' || operationKind === 'squash' ? operationKind : 'commit';
    const bannerOperation = operationKind
        ? operation
        : conflicts.length > 0
            ? octohubStructs.OperationState.createFrom({ Kind: '', Step: 0, Total: 0, Branch: '', Message: '', ConflictingFiles: conflicts })
            : null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-white/5 overflow-hidden">
            {bannerOperation && (
                <OperationBanner
                busy={operationBusy}
                onAbort={abortOperation}
                onSkip={skipRebaseCommit}
                operation={bannerOperation}
                    onContinue={continueOperation}
                    onShowConflicts={openConflicts}
                />
            )}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                <div style={{ width: sidebarWidth }} className="flex flex-col shrink-0 min-h-0 border-r border-zinc-200 dark:border-white/5">
                    <div className="flex border-b border-zinc-200 dark:border-white/5">
                        <button
                            onClick={() => {
                                setActiveTab('changes');
                                if (changedFiles.length > 0) fetchUncommitedDiff(changedFiles[0]);
                                else {
                                    setSelectedFile(null);
                                    setFileDiff(null);
                                }
                            }}
                            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'changes'
                                ? 'text-emerald-500 border-emerald-500 bg-emerald-500/5'
                                : 'text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                        >
                            <FileCode className="w-3.5 h-3.5" />
                            Changes <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-white/10 rounded-full text-[10px]">{changedFiles.length}</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('history');
                                setSelectedFile(null);
                                setFileDiff(null);
                                if (selectedCommit) fetchModifications(selectedCommit.Hash, true);
                            }}
                            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'history'
                                ? 'text-emerald-500 border-emerald-500 bg-emerald-500/5'
                                : 'text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            History
                        </button>
                    </div>

                    {activeTab === 'changes' ? (
                        <ChangesSidebar
                            stashes={stashes}
                            files={changedFiles}
                            searchTerm={searchTerm}
                            onDiscardAll={discardAll}
                            onPopStash={handlePopStash}
                            selectedFile={selectedFile}
                            onDiscardFile={discardFile}
                            onDropStash={handleDropStash}
                            onRefresh={refreshWorkingTree}
                            onFileClick={fetchUncommitedDiff}
                            onSearchTermChange={setSearchTerm}
                            selectedCount={selectedFilesCount}
                            onDiscardSelected={discardSelected}
                            onStashFileClick={fetchStashedFileDiff}
                            toggleAllSelection={toggleAllSelection}
                            toggleFileSelection={toggleFileSelection}
                            selectionOf={(fileName) => selectionOf(fileName).kind}
                            onFileContextMenu={(event, file) => setFileMenu({ x: event.clientX, y: event.clientY, file })}
                        >
                            {(commitMode !== 'commit' || !operationKind) && (
                                <CommitBox
                                    mode={commitMode}
                                    summary={summary}
                                    description={description}
                                    onSummaryChange={setSummary}
                                    selectedCount={selectedFilesCount}
                                    onDescriptionChange={setDescription}
                                    committing={committing || operationBusy}
                                    branch={currentBranch === 'HEAD' ? 'HEAD destacado' : currentBranch}
                                    onCommit={commitMode === 'commit' ? handleCommit : continueOperation}
                                    disabledReason={commitMode === 'commit' && conflicts.length > 0 ? 'Resolva os conflitos antes de fazer o commit' : undefined}
                                />
                            )}
                        </ChangesSidebar>
                    ) : (
                        <CommitSidebar
                            searchTerm={searchTerm}
                            commits={filteredCommits}
                            loadingMore={loadingMore}
                            selectedCommit={selectedCommit}
                            onSelectCommit={setSelectedCommit}
                            onSearchTermChange={setSearchTerm}
                            lastCommitElementRef={lastCommitElementRef}
                            onRefresh={() => { setPage(0); fetchCommits(0); }}
                            onCommitContextMenu={(event, commit) => setCommitMenu({ x: event.clientX, y: event.clientY, commit })}
                        />
                    )}
                </div>

                <div
                    onMouseDown={startResizingSidebar}
                    className={`w-px cursor-col-resize bg-zinc-200 dark:bg-white/5 hover:bg-emerald-500 transition-colors z-10 ${resizingSidebar ? 'bg-emerald-500' : ''}`}
                />
                <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0a0a0c] overflow-hidden">
                    {activeTab === 'changes' ? (
                        changedFiles.length > 0 || selectedFile ? (
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex items-center justify-between gap-4 shrink-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileCode className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <h2 className="text-xs font-mono font-bold text-zinc-900 dark:text-white truncate">
                                            {selectedFile || "Selecione um arquivo"}
                                        </h2>
                                        {diffSource === 'stash' && selectedFile && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-500 shrink-0">stash</span>
                                        )}
                                    </div>
                                    {canSelectLines && (
                                        <div className="flex items-center gap-3 shrink-0 text-[11px]">
                                            <span className="text-zinc-500" title="Clique nas caixas ao lado das linhas, arraste por várias ou use Shift+clique para um intervalo">
                                                {selectedLines.size} de {parsedDiff.changeIndexes.length} linhas selecionadas
                                            </span>
                                            <button onClick={() => setDiffLines(parsedDiff.changeIndexes, true)} className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                                                Selecionar tudo
                                            </button>
                                            <button onClick={() => setDiffLines(parsedDiff.changeIndexes, false)} className="font-bold text-zinc-500 hover:underline">
                                                Desmarcar tudo
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-transparent">
                                    {selectedFile ? (
                                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                            <DiffViewer
                                                diff={fileDiff}
                                                loading={loadingDiff}
                                                onSetLines={canSelectLines ? setDiffLines : undefined}
                                                onDiscardHunk={canSelectLines ? discardHunk : undefined}
                                                isLineSelected={canSelectLines ? (index) => selectedLines.has(index) : undefined}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center italic">
                                            Selecione um arquivo para ver as mudanças
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                                <div className="p-8 bg-zinc-100 dark:bg-white/5 rounded-full border border-zinc-200 dark:border-white/5">
                                    <FileCode className="w-16 h-16 opacity-10" />
                                </div>
                                <p className="text-sm font-medium italic">Nenhuma alteração pendente no momento</p>
                            </div>
                        )
                    ) : selectedCommit ? (
                        <>
                            <CommitDetailsHeader commit={commits.find(commit => commit.Hash === selectedCommit.Hash) ?? selectedCommit} />
                            <div className="flex-1 flex min-h-0 overflow-hidden">
                                <div style={{ width: filesWidth }} className="flex flex-col shrink-0 border-r border-zinc-200 dark:border-white/5 bg-zinc-50/30 dark:bg-black/10">
                                    <ModifiedFileList
                                        loadingFiles={loadingFiles}
                                        selectedFile={selectedFile}
                                        modifications={modifications}
                                        onFileClick={(file) => fetchFileDiff(file)}
                                    />
                                </div>
                                <div
                                    onMouseDown={startResizingFiles}
                                    className={`w-px cursor-col-resize bg-zinc-200 dark:bg-white/5 hover:bg-emerald-500 transition-colors z-10 ${resizingFiles ? 'bg-emerald-500' : ''}`}
                                />
                                <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-transparent">
                                    {selectedFile ? (
                                        <>
                                            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-black/20 border-b border-zinc-200 dark:border-white/5 shrink-0">
                                                <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate mr-4">{selectedFile}</span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                                <DiffViewer diff={fileDiff} loading={loadingDiff} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center italic">
                                            Selecione um arquivo para ver as mudanças
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                            <div className="p-8 bg-zinc-100 dark:bg-white/5 rounded-full border border-zinc-200 dark:border-white/5">
                                <GitCommit className="w-16 h-16 opacity-10" />
                            </div>
                            <p className="text-sm font-medium italic">
                                {commits.length === 0 ? 'Este repositório ainda não tem commits' : 'Selecione um commit para ver os detalhes'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {fileMenu && (
                <ContextMenu
                    x={fileMenu.x}
                    y={fileMenu.y}
                    title={fileMenu.file.FileName}
                    onClose={() => setFileMenu(null)}
                    entries={fileMenuEntries(fileMenu.file)}
                />
            )}
            {commitMenu && (
                <ContextMenu
                    x={commitMenu.x}
                    y={commitMenu.y}
                    onClose={() => setCommitMenu(null)}
                    entries={commitMenuEntries(commitMenu.commit)}
                    title={`${commitMenu.commit.Hash.slice(0, 7)} · ${commitMenu.commit.Title}`}
                />
            )}
            <CommitActionModal
                commit={commitAction?.commit ?? null}
                action={commitAction?.action ?? null}
                onClose={() => setCommitAction(null)}
            />
            <StashChangesModal
                loading={checkoutBusy}
                onConfirm={confirmCheckout}
                isOpen={checkoutTarget !== null}
                currentBranch={currentBranch || ''}
                onClose={() => setCheckoutTarget(null)}
                targetBranch={checkoutTarget ? `commit ${checkoutTarget.Hash.slice(0, 7)}` : null}
            />
        </div>
    );
};

export default CommitHistoryPage;
