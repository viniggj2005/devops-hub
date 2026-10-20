import iziToast from 'izitoast';
import { useExplorerStore } from './ExplorerStore';
import React, { useEffect, useState } from 'react';
import { useTalpadbStore } from '../../TalpadbStore';
import { useAuth } from '../../../../contexts/AuthContext';
import { fieldClass } from '../table/constants/TableStyles';
import { Loader2, Trash2, TriangleAlert } from 'lucide-react';
import { Modal } from '../../../shared/components/modals/Modal';
import { engineOf } from '../../functions/DatabaseEngines';
import { errorMessage } from '../../functions/TreatmentFunctions';
import { TalpadbServices } from '../../services/TalpadbServices';
import type { DropObjectKind, WorkspaceTab } from '../../../../interfaces/TalpadbInterfaces';

export type DropObjectType = 'database' | 'schema' | 'table' | 'view' | 'matview';

export interface DropTarget {
  name: string;
  schema: string;
  database: string;
  connectionId: number;
  type: DropObjectType;
  parentNodeId: string | null;
}

const typeLabels: Record<DropObjectType, string> = {
  view: 'view',
  table: 'tabela',
  schema: 'schema',
  database: 'banco de dados',
  matview: 'view materializada',
};

const dropKinds: Record<DropObjectType, DropObjectKind> = {
  schema: 'schema',
  view: 'relation',
  table: 'relation',
  matview: 'relation',
  database: 'database',
};

const affectedTab = (target: DropTarget) => (tab: WorkspaceTab) => {
  if (tab.connectionId !== target.connectionId) return false;
  if (target.type === 'database') return tab.type !== 'dashboard' && tab.database === target.name;
  if (tab.database !== target.database) return false;
  if (target.type === 'schema') return (tab.type === 'table' || tab.type === 'diagram') && tab.schema === target.name;
  return tab.type === 'table' && tab.schema === target.schema && tab.objectName === target.name;
};

interface DropObjectModalProps {
  target: DropTarget | null;
  onClose: () => void;
}

const DropObjectModal: React.FC<DropObjectModalProps> = ({ target, onClose }) => {
  const { token } = useAuth();
  const [force, setForce] = useState(false);
  const [preview, setPreview] = useState('');
  const [cascade, setCascade] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const tabs = useTalpadbStore((state) => state.tabs);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const closeMatchingTabs = useTalpadbStore((state) => state.closeMatchingTabs);
  const engine = useTalpadbStore((state) => engineOf(state.connections.find((connection) => connection.id === target?.connectionId)));

  useEffect(() => {
    setForce(false);
    setPreview('');
    setCascade(false);
    setConfirmation('');
    setPreviewError(null);
  }, [target]);

  useEffect(() => {
    if (!target || !token) return;
    let cancelled = false;
    TalpadbServices.previewDropObject(token, target.connectionId, target.database, {
      force,
      cascade,
      name: target.name,
      schema: target.schema,
      kind: dropKinds[target.type],
    })
      .then((sql) => {
        if (cancelled) return;
        setPreview(sql);
        setPreviewError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setPreview('');
        setPreviewError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [target, token, force, cascade]);

  if (!target) return null;

  const typeLabel = typeLabels[target.type];
  const showCascade = engine === 'postgres' || (engine === 'oracle' && target.type !== 'matview');
  const displayName = target.type === 'database' || target.type === 'schema' ? target.name : `${target.schema}.${target.name}`;
  const affectedTabs = tabs.filter(affectedTab(target)).length;
  const confirmed = confirmation === target.name;
  const canDrop = confirmed && Boolean(preview) && !previewError && !dropping;

  const close = () => !dropping && onClose();

  const drop = async () => {
    if (!token || !canDrop) return;
    setDropping(true);
    try {
      await TalpadbServices.dropObject(token, target.connectionId, target.database, {
        force,
        cascade,
        name: target.name,
        schema: target.schema,
        kind: dropKinds[target.type],
      });
      closeMatchingTabs(affectedTab(target));
      if (target.parentNodeId) useExplorerStore.getState().refresh(token, target.parentNodeId);
      iziToast.success({ title: `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} excluído`, message: displayName, position: 'bottomRight' });
      onClose();
    } catch (error) {
      iziToast.error({ title: 'Nada foi excluído', message: errorMessage(error), position: 'bottomRight', timeout: 12000 });
    } finally {
      setDropping(false);
    }
  };

  return (
    <Modal
      size="md"
      isOpen
      onClose={close}
      title={`Excluir ${typeLabel}`}
      description={displayName}
      icon={<Trash2 className="w-5 h-5 text-rose-500" />}
      footer={
        <>
          <button
            onClick={close}
            disabled={dropping}
            className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={drop}
            disabled={!canDrop}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {dropping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {dropping ? 'Excluindo...' : 'Excluir'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <TriangleAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Esta ação <strong>não pode ser desfeita</strong>. {target.type === 'database' ? 'O banco e todos os dados dele' : target.type === 'schema' ? 'O schema' : `A ${typeLabel}`}{' '}
              <span className="font-mono font-semibold">{displayName}</span> {target.type === 'database' ? 'serão apagados' : 'será apagado'}.
            </p>
            {affectedTabs > 0 && (
              <p className="text-xs">
                {affectedTabs} {affectedTabs === 1 ? 'aba aberta será fechada' : 'abas abertas serão fechadas'}.
              </p>
            )}
          </div>
        </div>

        {target.type === 'database' ? (
          <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={force}
              className="accent-rose-600 mt-1"
              onChange={(event) => setForce(event.target.checked)}
            />
            <span>
              <span className="font-mono font-semibold">FORCE</span> — desconecta as outras sessões abertas neste banco
              <span className="block text-xs text-gray-400">PostgreSQL 13 ou superior. Sem isso, a exclusão falha se alguém estiver conectado.</span>
            </span>
          </label>
        ) : !showCascade ? null : (
          <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={cascade}
              className="accent-rose-600 mt-1"
              onChange={(event) => setCascade(event.target.checked)}
            />
            <span>
              <span className="font-mono font-semibold">{engine === 'oracle' ? 'CASCADE CONSTRAINTS' : 'CASCADE'}</span> — {engine === 'oracle' ? 'remove as chaves estrangeiras que apontam para ela' : `exclui também o que depende ${target.type === 'schema' ? 'dele' : 'dela'}`}
              <span className="block text-xs text-gray-400">
                {target.type === 'schema'
                  ? 'Necessário se o schema tiver tabelas, views, funções etc.'
                  : 'Views que a usam e chaves estrangeiras que apontam para ela.'}
              </span>
            </span>
          </label>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-300 mb-1.5">
            Digite <span className="font-mono text-rose-600 dark:text-rose-400">{target.name}</span> para confirmar
          </label>
          <input
            autoFocus
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && drop()}
            className={`${fieldClass} h-9 text-sm font-mono`}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-300 mb-1.5">SQL</label>
          {previewError ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{previewError}</p>
          ) : (
            <pre className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 px-3 py-2 text-xs font-mono text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">
              {preview || '…'}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DropObjectModal;
