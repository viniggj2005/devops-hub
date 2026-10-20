import iziToast from 'izitoast';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { Modal } from '../../../shared/components/modals/Modal';
import { TalpadbServices } from '../../services/TalpadbServices';
import { ModalButton } from '../../../shared/components/modals/ModalButton';
import { errorMessage, formatDuration } from '../../functions/TreatmentFunctions';
import { CheckCircle2, CircleAlert, DatabaseZap, FilePen, FolderOpen } from 'lucide-react';
import { ENGINE_OPTIONS, engineInfo, engineOf } from '../../functions/DatabaseEngines';
import type {
  DatabaseEngine,
  TalpadbConnection,
  TalpadbConnectionInput,
} from '../../../../interfaces/TalpadbInterfaces';

interface ConnectionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (connection: TalpadbConnection) => void;
  connection?: TalpadbConnection | null;
}

interface FormState {
  alias: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode: string;
  engine: DatabaseEngine;
  clearPassword: boolean;
}

const emptyForm = (engine: DatabaseEngine): FormState => {
  const info = engineInfo(engine);
  return {
    engine,
    alias: '',
    host: '',
    password: '',
    clearPassword: false,
    port: info.defaultPort,
    sslMode: info.defaultSslMode,
    database: info.defaultDatabase,
    username: info.defaultUsername,
  };
};

const engineDescriptions: Record<DatabaseEngine, string> = {
  postgres: 'Servidor PostgreSQL',
  oracle: 'Servidor Oracle (service name)',
  sqlite: 'Arquivo local .db / .sqlite',
};

const inputClass = `w-full px-4 py-3 rounded-xl border backdrop-blur-sm transition-all outline-none
    bg-white/80 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20
    dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 dark:focus:border-cyan-500/50 dark:focus:ring-cyan-500/20 dark:[color-scheme:dark]`;

const labelClass = 'block text-sm mb-2 text-gray-700 dark:text-gray-200';

const ConnectionFormModal: React.FC<ConnectionFormModalProps> = ({
  open,
  onClose,
  onSaved,
  connection,
}) => {
  const { token } = useAuth();
  const isEditing = Boolean(connection);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm('postgres'));
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const info = engineInfo(form.engine);
  const isSqlite = form.engine === 'sqlite';

  useEffect(() => {
    if (!open) return;
    setTestResult(null);
    setForm(
      connection
        ? {
            alias: connection.alias,
            host: connection.host,
            port: connection.port,
            database: connection.database,
            username: connection.username,
            password: '',
            sslMode: connection.sslMode,
            engine: engineOf(connection),
            clearPassword: false,
          }
        : emptyForm('postgres')
    );
  }, [open, connection]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;
    setTestResult(null);
    setForm((previous) => ({
      ...previous,
      [name]:
        type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : name === 'port'
            ? Number(value) || 0
            : value,
    }));
  };

  const selectEngine = (engine: DatabaseEngine) => {
    setTestResult(null);
    setForm((previous) => ({ ...emptyForm(engine), alias: previous.alias }));
  };

  const chooseFile = async () => {
    if (!token) return;
    try {
      const path = await TalpadbServices.chooseSqliteFile(token);
      if (path) setForm((previous) => ({ ...previous, host: path }));
    } catch (error) {
      iziToast.error({ title: 'Erro', message: errorMessage(error), position: 'bottomRight' });
    }
  };

  const toPayload = (): TalpadbConnectionInput => ({
    engine: form.engine,
    alias: form.alias.trim(),
    host: form.host.trim(),
    port: isSqlite ? undefined : form.port,
    database: form.database.trim(),
    username: form.username.trim(),
    password: form.password || undefined,
    sslMode: form.sslMode,
    clearPassword: form.clearPassword,
  });

  const handleTest = async () => {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await TalpadbServices.testConnection(token, connection?.id ?? 0, toPayload());
      setTestResult({
        success: true,
        message: `Conectado ao ${info.label} ${result.serverVersion} em ${formatDuration(result.latencyMs)}.`,
      });
    } catch (error) {
      setTestResult({ success: false, message: errorMessage(error) });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const saved = isEditing
        ? await TalpadbServices.updateConnection(token, connection!.id, toPayload())
        : await TalpadbServices.createConnection(token, toPayload());
      iziToast.success({
        title: isEditing ? 'Sucesso!' : 'Criado com sucesso',
        message: isEditing ? 'Conexão atualizada com sucesso.' : `A conexão ${info.label} foi criada.`,
        position: 'bottomRight',
        timeout: 3000,
      });
      onSaved(saved);
      onClose();
    } catch (error) {
      iziToast.error({
        title: 'Erro',
        message: `Erro ao salvar conexão: ${errorMessage(error)}`,
        position: 'bottomRight',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? `Editar conexão ${info.label}` : 'Nova conexão'}
      description={isEditing ? 'modifique os dados necessários' : 'escolha o banco e preencha os dados'}
      icon={
        isEditing ? (
          <FilePen className="w-5 h-5 text-blue-500" />
        ) : (
          <DatabaseZap className="w-5 h-5 text-cyan-500" />
        )
      }
      footer={
        <>
          <ModalButton
            variant="ghost"
            className="mr-auto"
            onClick={handleTest}
            disabled={testing || saving || !form.host.trim()}
            isLoading={testing}
          >
            Testar conexão
          </ModalButton>
          <ModalButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={handleSubmit}
            disabled={saving}
            isLoading={saving}
          >
            {isEditing ? 'Salvar alterações' : 'Criar Conexão'}
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditing && (
          <div className="grid grid-cols-3 gap-2">
            {ENGINE_OPTIONS.map((engine) => (
              <button
                key={engine}
                type="button"
                onClick={() => selectEngine(engine)}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  form.engine === engine
                    ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/20'
                    : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{engineInfo(engine).label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{engineDescriptions[engine]}</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-sm mb-4 text-gray-600 dark:text-gray-400">
          {isSqlite
            ? 'O caminho do arquivo é armazenado criptografado no banco local do Devops Hub.'
            : 'Senha e host são armazenados criptografados no banco local do Devops Hub.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>
              Alias <span className="opacity-60 text-xs">(opcional)</span>
            </label>
            <input
              className={inputClass}
              type="text"
              name="alias"
              value={form.alias}
              onChange={handleChange}
              placeholder="ex: Produção"
            />
          </div>

          {isSqlite ? (
            <div className="md:col-span-2">
              <label className={labelClass}>Arquivo do banco</label>
              <div className="flex gap-2">
                <input
                  className={`${inputClass} font-mono text-sm`}
                  type="text"
                  name="host"
                  value={form.host}
                  onChange={handleChange}
                  required
                  placeholder="ex: C:\dados\app.db"
                />
                <button
                  type="button"
                  onClick={chooseFile}
                  className="flex items-center gap-2 px-4 rounded-xl border border-gray-200 dark:border-white/20 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 whitespace-nowrap"
                >
                  <FolderOpen className="w-4 h-4" /> Procurar…
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Host</label>
                <input
                  className={inputClass}
                  type="text"
                  name="host"
                  value={form.host}
                  onChange={handleChange}
                  required
                  placeholder="ex: 192.168.0.10"
                />
              </div>

              <div>
                <label className={labelClass}>Porta</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={65535}
                  name="port"
                  value={form.port}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className={labelClass}>{form.engine === 'oracle' ? 'Service name' : 'Banco padrão'}</label>
                <input
                  className={inputClass}
                  type="text"
                  name="database"
                  value={form.database}
                  onChange={handleChange}
                  required={form.engine === 'oracle'}
                  placeholder={form.engine === 'oracle' ? 'ex: FREEPDB1, ORCL' : 'postgres'}
                />
              </div>

              <div>
                <label className={labelClass}>Usuário</label>
                <input
                  className={inputClass}
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  placeholder={form.engine === 'oracle' ? 'ex: system' : 'ex: postgres'}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Senha{' '}
                  {isEditing && connection?.hasPassword && (
                    <span className="opacity-60 text-xs">(em branco mantém a atual)</span>
                  )}
                </label>
                <input
                  className={inputClass}
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  disabled={form.clearPassword}
                  placeholder={isEditing && connection?.hasPassword ? '••••••••' : 'sua senha'}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className={labelClass}>SSL</label>
                <select
                  className={inputClass}
                  name="sslMode"
                  value={form.sslMode}
                  onChange={handleChange}
                >
                  {info.sslModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>

              {isEditing && connection?.hasPassword && (
                <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="clearPassword"
                    checked={form.clearPassword}
                    onChange={handleChange}
                    className="h-4 w-4 accent-cyan-600"
                  />
                  Remover a senha salva
                </label>
              )}
            </>
          )}
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              testResult.success
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <CircleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <span className="break-words">{testResult.message}</span>
          </div>
        )}

        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  );
};

export default ConnectionFormModal;
