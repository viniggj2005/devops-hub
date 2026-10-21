import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { BookSearch, Copy, Tag, Trash2 } from 'lucide-react';
import { errorMessage } from '../../../../shared/functions/ErrorMessage';
import { DockerImageIcon } from '../../../../../features/shared/Icons';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { copyToClipboard } from '../../../../../features/shared/functions/clipboard';
import { ImageProps } from '../../../../../interfaces/ContainerImagesInterfaces';
import InspectModal from '../../../../../features/shared/components/modals/InspectModal';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';
import { InspectImage, RemoveImage } from '../../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';
import { EpochToDateStr, FmtAgo, FormatBytes, ParseNameAndTag } from '../../../../../features/shared/functions/TreatmentFunction';

const ImageCard: React.FC<ImageProps> = ({ image, onDeleted }) => {
  const id = image?.Id ?? '';
  const confirmToast = useConfirmToast();
  const { selectedCredentialId } = useDockerClient();
  const { name, tag } = ParseNameAndTag(image?.RepoTags);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [inspectContent, setInspectContent] = useState<string | null>(null);

  const ensureClient = () => {
    if (selectedCredentialId == null) {
      toast.error('Escolha uma credencial Docker para executar esta ação.');
      return null;
    }
    return selectedCredentialId;
  };

  const handleDelete = () => {
    const clientId = ensureClient();
    if (clientId == null) return;
    confirmToast({
      id,
      title: 'Excluir imagem?',
      message: `Deseja remover ${name}:${tag}? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        const latestClientId = ensureClient();
        if (latestClientId == null) return;
        await RemoveImage(latestClientId, id);
        onDeleted?.();
      },
    });
  };

  const handleInspect = async () => {
    try {
      const clientId = ensureClient();
      if (clientId == null) return;
      const result = await InspectImage(clientId, id);
      const payload = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      setInspectContent(payload);
      setIsInspectOpen(true);
    } catch (error: any) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="group relative flex flex-col gap-4 rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/60 p-5 shadow-sm transition-all hover:border-blue-500/30 dark:hover:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <DockerImageIcon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white" title={name}>
              {name}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-mono font-medium text-blue-600 dark:text-blue-400">
                <Tag className="h-3 w-3" />
                {tag}
              </span>
              <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">
                {id.replace('sha256:', '').slice(0, 12)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleInspect}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
            title="Inspecionar imagem"
          >
            <BookSearch className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer"
            title="Excluir imagem"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-y border-gray-100 py-3 dark:border-white/[0.05]">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            Tamanho
          </p>
          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
            {FormatBytes(image?.Size || 0)}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            Criado
          </p>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              {FmtAgo(image?.Created)}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-zinc-500">
              {EpochToDateStr(image?.Created)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => copyToClipboard(id.replace('sha256:', ''), 'ID da imagem copiado')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:bg-white/5 cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Copiar ID</span>
        </button>
        <button
          type="button"
          onClick={() => copyToClipboard(`${name}:${tag}`, 'Tag copiada')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 dark:border-white/[0.06] dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:bg-white/5 cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Copiar Tag</span>
        </button>
      </div>

      {isInspectOpen && (
        <InspectModal
          title="Inspect da imagem"
          name={`${name}:${tag}`}
          data={inspectContent}
          onClose={() => setIsInspectOpen(false)}
        />
      )}
    </div>
  );
};

export default ImageCard;
