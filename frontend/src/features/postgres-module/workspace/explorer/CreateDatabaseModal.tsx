import iziToast from 'izitoast';
import React, { useEffect, useState } from 'react';
import { Database, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { fieldClass } from '../table/constants/TableStyles';
import { Modal } from '../../../shared/components/modals/Modal';
import { errorMessage } from '../../functions/TreatmentFunctions';
import { PostgresServices } from '../../services/PostgresServices';
import type { CreateDatabaseInput, DatabaseOptions } from '../../../../interfaces/PostgresInterfaces';

const encodings = ['UTF8', 'LATIN1', 'WIN1252', 'SQL_ASCII'];

const emptyInput: CreateDatabaseInput = {
  name: '',
  owner: '',
  ctype: '',
  comment: '',
  collate: '',
  template: '',
  encoding: '',
  connectionLimit: -1,
};

interface CreateDatabaseModalProps {
  connectionId: number | null;
  connectionName: string;
  onClose: () => void;
  onCreated: (connectionId: number, name: string) => void;
}

const labelClass = 'block text-xs font-semibold text-gray-600 dark:text-zinc-300 mb-1.5';
const inputClass = `${fieldClass} h-9 text-sm`;

const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({ connectionId, connectionName, onClose, onCreated }) => {
  const { token } = useAuth();
  const [preview, setPreview] = useState('');
  const [creating, setCreating] = useState(false);
  const [input, setInput] = useState<CreateDatabaseInput>(emptyInput);
  const [options, setOptions] = useState<DatabaseOptions | null>(null);
  const isOpen = connectionId !== null;

  useEffect(() => {
    if (!isOpen || !token) return;
    setInput(emptyInput);
    setOptions(null);
    PostgresServices.getDatabaseOptions(token, connectionId)
      .then(setOptions)
      .catch((error) => iziToast.error({ title: 'Erro', message: errorMessage(error), position: 'bottomRight' }));
  }, [isOpen, token, connectionId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      PostgresServices.previewCreateDatabase(input)
        .then(setPreview)
        .catch(() => setPreview('-- Informe o nome do banco'));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isOpen, input]);

  const change = (changes: Partial<CreateDatabaseInput>) => setInput((current) => ({ ...current, ...changes }));

  const close = () => !creating && onClose();

  const create = async () => {
    if (!token || connectionId === null || !input.name.trim() || creating) return;
    setCreating(true);
    try {
      await PostgresServices.createDatabase(token, connectionId, input);
      iziToast.success({ title: 'Banco criado', message: input.name.trim(), position: 'bottomRight' });
      onCreated(connectionId, input.name.trim());
      onClose();
    } catch (error) {
      iziToast.error({ title: 'Erro ao criar banco', message: errorMessage(error), position: 'bottomRight', timeout: 10000 });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      size="lg"
      isOpen={isOpen}
      onClose={close}
      title="Criar banco de dados"
      description={connectionName}
      icon={<Database className="w-5 h-5 text-cyan-500" />}
      footer={
        <>
          <button
            onClick={close}
            disabled={creating}
            className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={!input.name.trim() || creating}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Criando...' : 'Criar banco'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Nome</label>
          <input
            autoFocus
            value={input.name}
            placeholder="meu_banco"
            onChange={(event) => change({ name: event.target.value })}
            onKeyDown={(event) => event.key === 'Enter' && create()}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Dono</label>
            <select value={input.owner} onChange={(event) => change({ owner: event.target.value })} className={inputClass}>
              <option value="">{options ? `${options.currentUser} (você)` : 'Usuário atual'}</option>
              {options?.roles
                .filter((role) => role !== options.currentUser)
                .map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Template</label>
            <select value={input.template} onChange={(event) => change({ template: event.target.value })} className={inputClass}>
              <option value="">template1 (padrão)</option>
              {options?.templates
                .filter((template) => template !== 'template1')
                .map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Encoding</label>
            <input
              list="postgres-encodings"
              value={input.encoding}
              placeholder={options?.defaultEncoding || 'UTF8'}
              onChange={(event) => change({ encoding: event.target.value })}
              className={`${inputClass} font-mono`}
            />
            <datalist id="postgres-encodings">
              {encodings.map((encoding) => (
                <option key={encoding} value={encoding} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Collation (LC_COLLATE)</label>
            <input
              value={input.collate}
              placeholder={options?.defaultCollate || 'herda do template'}
              onChange={(event) => change({ collate: event.target.value })}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass}>Ctype (LC_CTYPE)</label>
            <input
              value={input.ctype}
              placeholder={options?.defaultCtype || 'herda do template'}
              onChange={(event) => change({ ctype: event.target.value })}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-zinc-400 -mt-1">
          Deixe em branco para herdar do template. Encoding ou collation diferentes do template1 exigem o template0.
        </p>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-3">
          <div>
            <label className={labelClass}>Limite de conexões</label>
            <input
              type="number"
              min={-1}
              value={input.connectionLimit}
              onChange={(event) => change({ connectionLimit: Number(event.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Comentário</label>
            <input
              value={input.comment}
              placeholder="Opcional"
              onChange={(event) => change({ comment: event.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>SQL</label>
          <pre className="max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 px-3 py-2 text-xs font-mono text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">
            {preview}
          </pre>
        </div>
      </div>
    </Modal>
  );
};

export default CreateDatabaseModal;
