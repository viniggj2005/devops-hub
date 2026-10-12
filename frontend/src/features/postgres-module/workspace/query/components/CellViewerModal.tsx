import React, { useMemo } from 'react';
import { Copy, TextSearch } from 'lucide-react';
import { Modal } from '../../../../shared/components/modals/Modal';
import { copyToClipboard } from '../../../../shared/functions/clipboard';
import { ModalButton } from '../../../../shared/components/modals/ModalButton';
import type { QueryCell, QueryColumn } from '../../../../../interfaces/PostgresInterfaces';

interface CellViewerModalProps {
  cell: { value: QueryCell; column: QueryColumn } | null;
  onClose: () => void;
}

const CellViewerModal: React.FC<CellViewerModalProps> = ({ cell, onClose }) => {
  const formatted = useMemo(() => {
    if (!cell || cell.value === null) return null;
    if (cell.column.dataType === 'json' || cell.column.dataType === 'jsonb') {
      try {
        return JSON.stringify(JSON.parse(cell.value), null, 2);
      } catch {
        return cell.value;
      }
    }
    return cell.value;
  }, [cell]);

  if (!cell) return null;

  return (
    <Modal
      isOpen
      size="lg"
      onClose={onClose}
      title={cell.column.name}
      description={cell.column.dataType}
      icon={<TextSearch className="w-5 h-5 text-cyan-500" />}
      footer={
        <>
          <ModalButton
            variant="secondary"
            disabled={cell.value === null}
            onClick={() => copyToClipboard(formatted ?? '', 'Valor copiado')}
          >
            <Copy className="w-4 h-4" />
            Copiar
          </ModalButton>
          <ModalButton variant="primary" onClick={onClose}>
            Fechar
          </ModalButton>
        </>
      }
    >
      {formatted === null ? (
        <p className="italic text-gray-400">NULL</p>
      ) : (
        <>
          <pre className="max-h-[55vh] overflow-auto rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 p-4 text-xs font-mono whitespace-pre-wrap break-all text-gray-800 dark:text-zinc-200">
            {formatted}
          </pre>
          <p className="mt-2 text-[11px] text-gray-400">
            {formatted.length.toLocaleString('pt-BR')} caracteres
          </p>
        </>
      )}
    </Modal>
  );
};

export default CellViewerModal;
