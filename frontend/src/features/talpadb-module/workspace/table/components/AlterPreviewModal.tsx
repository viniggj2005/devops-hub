import React from 'react';
import SqlEditor from '../../query/components/SqlEditor';
import { FileCode2, Loader2, Play, ScrollText } from 'lucide-react';
import { Modal } from '../../../../shared/components/modals/Modal';

interface AlterPreviewModalProps {
  script: string;
  isOpen: boolean;
  applying: boolean;
  onClose: () => void;
  onApply: () => void;
  onOpenInEditor: () => void;
}

const AlterPreviewModal: React.FC<AlterPreviewModalProps> = ({ script, isOpen, applying, onClose, onApply, onOpenInEditor }) => (
  <Modal
    size="xl"
    isOpen={isOpen}
    onClose={() => !applying && onClose()}
    title="Revisar alterações"
    description="Os comandos rodam numa única transação: ou tudo é aplicado, ou nada muda."
    icon={<ScrollText className="w-5 h-5 text-cyan-500" />}
    footer={
      <>
        <button
          onClick={onOpenInEditor}
          disabled={applying}
          className="mr-auto flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
        >
          <FileCode2 className="w-4 h-4" />
          Abrir no editor
        </button>
        <button
          onClick={onClose}
          disabled={applying}
          className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          onClick={onApply}
          disabled={applying}
          className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 flex items-center gap-2"
        >
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {applying ? 'Aplicando...' : 'Aplicar'}
        </button>
      </>
    }
  >
    <div className="h-[45vh] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <SqlEditor key={script} initialValue={script} readOnly />
    </div>
  </Modal>
);

export default AlterPreviewModal;
