import iziToast from 'izitoast';
import React, { useState } from 'react';
import { DockerImageIcon } from '../../../../../features/shared/Icons';
import { BookSearch, Copy, Tag, Trash2 } from 'lucide-react';
import { copyToClipboard } from '../../../../../features/shared/functions/clipboard';
import InspectModal from '../../../../../features/shared/components/modals/InspectModal';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ImageProps } from '../../../../../interfaces/ContainerImagesInterfaces';
import { useConfirmToast } from '../../../../../features/shared/components/toasts/ConfirmToast';
import { RemoveImage, InspectImage } from '../../../../../../wailsjs/go/handlers/DockerSdkHandlerStruct';
import { FmtAgo, FormatBytes, EpochToDateStr, ParseNameAndTag } from '../../../../../features/shared/functions/TreatmentFunction';

const ImageCard: React.FC<ImageProps> = ({ image, onDeleted }) => {
  const id = image?.Id ?? '';
  const confirmToast = useConfirmToast();
  const { selectedCredentialId } = useDockerClient();
  const { name, tag } = ParseNameAndTag(image?.RepoTags);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [inspectContent, setInspectContent] = useState<string | null>(null);

  const ensureClient = () => {
    if (selectedCredentialId == null) {
      iziToast.error({
        title: 'Credencial não selecionada',
        message: 'Escolha uma credencial Docker para executar esta ação.',
        position: 'bottomRight',
      });
      return null;
    }
    return selectedCredentialId;
  };

  const handleDelete = () => {
    const clientId = ensureClient();
    if (clientId == null) return;
    confirmToast({
      id,
      title: `Excluir imagem?`,
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
      iziToast.success({
        title: 'Sucesso!',
        message: 'Dados inspecionados com sucesso!',
        position: 'bottomRight',
      });
      setIsInspectOpen(true);
    } catch (error: any) {
      iziToast.error({ title: 'Erro', message: String(error), position: 'bottomRight' });
    }
  };

  return (
    <div className="group relative flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <DockerImageIcon className="h-6 w-6" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white" title={name}>
              {name}
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={handleInspect}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
            title="Inspecionar"
          >
            <BookSearch className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-y border-gray-100 py-4 dark:border-white/5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Tamanho</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{FormatBytes(image?.Size || 0)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Criado</p>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{FmtAgo(image?.Created)}</span>
            <span className="text-[10px] text-gray-400">{EpochToDateStr(image?.Created)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => copyToClipboard(id.replace('sha256:', ''), 'ID copiador')}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar ID
        </button>
        <button
          onClick={() => copyToClipboard(`${name}:${tag}`, 'Nome:Tag copiado')}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar Tag
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
