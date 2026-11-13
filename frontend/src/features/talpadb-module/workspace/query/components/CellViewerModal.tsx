import React, { useMemo } from 'react';
import { Copy, TextSearch } from 'lucide-react';
import { Modal } from '../../../../shared/components/modals/Modal';
import { useTranslation } from '../../../../i18n/useTranslation';
import { copyToClipboard } from '../../../../shared/functions/clipboard';
import { ModalButton } from '../../../../shared/components/modals/ModalButton';
import type { QueryCell, QueryColumn } from '../../../../../interfaces/TalpadbInterfaces';

interface CellViewerModalProps {
  cell: { value: QueryCell; column: QueryColumn } | null;
  onClose: () => void;
}

const CellViewerModal: React.FC<CellViewerModalProps> = ({ cell, onClose }) => {
  const { dictionary, formatMessage, language } = useTranslation();
  const commonTexts = dictionary.talpadb.common;
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
            onClick={() => copyToClipboard(formatted ?? '', commonTexts.valueCopied)}
          >
            <Copy className="w-4 h-4" />
            {commonTexts.copy}
          </ModalButton>
          <ModalButton variant="primary" onClick={onClose}>
            {dictionary.app.common.close}
          </ModalButton>
        </>
      }
    >
      {formatted === null ? (
        <p className="italic text-gray-400">NULL</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 dark:text-zinc-500">
              {formatMessage(dictionary.talpadb.cell.characters, { count: formatted.length.toLocaleString(language) })}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(formatted, commonTexts.valueCopied)}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-500" />
              {commonTexts.copy}
            </button>
          </div>
          <pre className="max-h-[55vh] overflow-auto rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 p-4 text-xs font-mono whitespace-pre-wrap break-all text-gray-800 dark:text-zinc-200">
            {formatted}
          </pre>
        </div>
      )}
    </Modal>
  );
};

export default CellViewerModal;
