import React, { useState } from 'react';
import { useVulpesStore } from '../../VulpesStore';
import { runWithToast } from '../../actions/ActionHelpers';
import { Modal } from '../../../shared/components/modals/Modal';
import { collectionActions } from '../../actions/CollectionActions';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import type { ImportResult } from '../../../../interfaces/VulpesInterfaces';
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileJson, Loader2, Upload } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const close = () => {
    setText('');
    setError(null);
    setResult(null);
    onClose();
  };

  const applyResult = (imported: ImportResult) => {
    const store = useVulpesStore.getState();
    imported.collections.forEach((collection) => store.upsertCollection(collection));
    imported.environments.forEach((environment) => store.upsertEnvironment(environment));
    if (imported.collections.length || imported.environments.length) setResult(imported);
  };

  const runImport = async (operation: () => Promise<ImportResult>) => {
    setBusy(true);
    setError(null);
    try {
      applyResult(await operation());
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="lg"
      isOpen={isOpen}
      onClose={close}
      title="Importar do Postman"
      description="Coleções v2.0/v2.1, ambientes e globals"
      icon={<Upload className="w-4 h-4 text-amber-500" />}
      footer={
        result ? (
          <button type="button" onClick={close} className={primaryButtonClass}>
            Concluir
          </button>
        ) : (
          <>
            <button type="button" onClick={close} className={secondaryButtonClass}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => runImport(() => collectionActions.importFromText(text))}
              className={primaryButtonClass}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
              Importar JSON colado
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
              <p className="font-bold">Importação concluída</p>
              {result.collections.map((collection) => (
                <p key={`collection-${collection.id}`} className="text-xs">
                  Coleção <strong>{collection.name}</strong>
                </p>
              ))}
              {result.environments.map((environment) => (
                <p key={`environment-${environment.id}`} className="text-xs">
                  Ambiente <strong>{environment.name}</strong> ({environment.variables.length} variáveis)
                </p>
              ))}
            </div>
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1.5">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4" />
                Avisos
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900 dark:text-amber-100">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => runImport(collectionActions.importFromFiles)}
            className="w-full flex items-center gap-4 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 px-5 py-5 text-left transition-colors disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              {busy ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : <FileJson className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Selecionar arquivos</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Escolha um ou mais arquivos <span className="font-mono">.postman_collection.json</span> e{' '}
                <span className="font-mono">.postman_environment.json</span> exportados pelo Postman.
              </p>
            </div>
          </button>

          <div>
            <label className={fieldLabelClass}>Ou cole o JSON exportado</label>
            <textarea
              value={text}
              spellCheck={false}
              onChange={(event) => setText(event.target.value)}
              placeholder={'{\n  "info": { "name": "Minha API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },\n  "item": []\n}'}
              className="w-full h-48 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-950 p-3 text-xs font-mono text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 whitespace-pre-line">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {error}
            </p>
          )}
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            Scripts de pré-requisição e testes são preservados, mas não executados. Exemplos de resposta salvos não são importados.
          </p>
        </div>
      )}
    </Modal>
  );
};

export const quickImportFiles = () =>
  runWithToast(async () => {
    const result = await collectionActions.importFromFiles();
    const store = useVulpesStore.getState();
    result.collections.forEach((collection) => store.upsertCollection(collection));
    result.environments.forEach((environment) => store.upsertEnvironment(environment));
    return result;
  });

export default ImportModal;
