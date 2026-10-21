import { useState } from 'react';
import toast from 'react-hot-toast';
import { VsCodeIcon } from '../../shared/Icons';
import { useNavigate } from 'react-router-dom';
import { copyToClipboard } from '../../shared/functions/clipboard';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import type { ContextMenuEntry } from '../../shared/components/menus/ContextMenu';
import * as octohubDtos from '../../../../bindings/docker-manager-go/src/octohub/dtos/models';
import {
    Copy,
    Check,
    Trash2,
    FolderSearch,
    ClipboardCopy,
    GitCommitHorizontal,
} from 'lucide-react';
import {
    RevealInExplorer,
    OpenRepositoryInEditor,
} from '../../../../bindings/docker-manager-go/src/octohub/handlers/gitbranchhandler';

export interface RepositoryMenuState {
    x: number;
    y: number;
    repository: octohubDtos.RepositoryDto;
}

export function useRepositoryContextMenu(onBeforeAction?: () => void) {
    const navigate = useNavigate();
    const { selectRepository, removeRepository } = useOctohubRepository();
    const [menu, setMenu] = useState<RepositoryMenuState | null>(null);

    const openMenu = (event: React.MouseEvent, repository: octohubDtos.RepositoryDto) => {
        event.preventDefault();
        event.stopPropagation();
        setMenu({ x: event.clientX, y: event.clientY, repository });
    };

    const closeMenu = () => setMenu(null);

    const withSelectedRepository = async (
        targetRepository: octohubDtos.RepositoryDto,
        action: () => Promise<unknown>
    ) => {
        onBeforeAction?.();
        try {
            if (!targetRepository.isCurrent) {
                const selected = await selectRepository(targetRepository.id);
                if (!selected) return;
            }
            await action();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const buildEntries = (targetRepository: octohubDtos.RepositoryDto): ContextMenuEntry[] => {
        const exists = targetRepository.exists;
        return [
            {
                disabled: !exists,
                icon: GitCommitHorizontal,
                label: 'Abrir alterações',
                onClick: () =>
                    withSelectedRepository(targetRepository, async () => {
                        navigate('/octohub/history');
                    }),
            },
            {
                icon: Check,
                label: 'Selecionar como atual',
                disabled: !exists || targetRepository.isCurrent,
                onClick: () => {
                    onBeforeAction?.();
                    selectRepository(targetRepository.id);
                },
            },
            'separator',
            {
                disabled: !exists,
                icon: VsCodeIcon,
                label: 'Abrir no VS Code',
                onClick: () =>
                    withSelectedRepository(targetRepository, () => OpenRepositoryInEditor()),
            },
            {
                disabled: !exists,
                icon: FolderSearch,
                label: 'Mostrar no Explorer',
                onClick: () =>
                    withSelectedRepository(targetRepository, () => RevealInExplorer('.')),
            },
            'separator',
            {
                icon: ClipboardCopy,
                label: 'Copiar caminho da pasta',
                onClick: () => {
                    onBeforeAction?.();
                    copyToClipboard(targetRepository.path, 'Caminho copiado.');
                },
            },
            {
                icon: Copy,
                label: 'Copiar nome do repositório',
                onClick: () => {
                    onBeforeAction?.();
                    copyToClipboard(targetRepository.name, 'Nome copiado.');
                },
            },
            'separator',
            {
                icon: Trash2,
                label: 'Remover da lista',
                onClick: () => {
                    onBeforeAction?.();
                    removeRepository(targetRepository);
                },
            },
        ];
    };

    return {
        menu,
        openMenu,
        closeMenu,
        entries: menu ? buildEntries(menu.repository) : [],
    };
}
