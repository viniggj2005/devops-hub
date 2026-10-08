import iziToast from 'izitoast';
import React, { useState } from 'react';
import { VsCodeIcon } from '../../shared/Icons';
import { useOctohubRepository } from '../contexts/OctohubRepositoryContext';
import { OpenRepositoryInEditor } from '../../../../wailsjs/go/octohubHandler/GitBranchHandler';

const OpenInEditorButton: React.FC = () => {
    const { repository } = useOctohubRepository();
    const [opening, setOpening] = useState(false);
    const hasRepository = Boolean(repository?.exists);

    const handleOpen = async () => {
        setOpening(true);
        try {
            await OpenRepositoryInEditor();
        } catch (error) {
            iziToast.error({ title: 'Erro', message: String(error), position: 'bottomRight' });
        } finally {
            setOpening(false);
        }
    };

    return (
        <button
            onClick={handleOpen}
            disabled={!hasRepository || opening}
            title="Abrir o repositório no VS Code"
            className="p-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <VsCodeIcon className="w-4 h-4 text-[#007acc]" />
            <span className="text-xs font-bold hidden md:inline text-zinc-700 dark:text-zinc-300">VS Code</span>
        </button>
    );
};

export default OpenInEditorButton;
