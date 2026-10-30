import React, { useState } from 'react';
import VariableInput from './VariableInput';
import { Eye, EyeOff, Info } from 'lucide-react';
import Select from '../../../shared/components/forms/Select';
import { authLabels } from '../../functions/RequestDefaults';
import { fieldInputClass, fieldLabelClass } from './FormStyles';
import type { Auth, AuthType } from '../../../../interfaces/VulpesInterfaces';

interface AuthEditorProps {
  auth: Auth;
  allowInherit?: boolean;
  inheritedHint?: string;
  onChange: (auth: Auth) => void;
}

const authTypes: AuthType[] = ['inherit', 'none', 'bearer', 'basic', 'apikey'];

const locationOptions = [
  { value: 'header', label: 'Header' },
  { value: 'query', label: 'Query params' },
];

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-zinc-400">
    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
    <span>{children}</span>
  </p>
);

const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onChange, allowInherit = true, inheritedHint }) => {
  const [showSecret, setShowSecret] = useState(false);
  const update = (patch: Partial<Auth>) => onChange({ ...auth, ...patch });
  const options = authTypes
    .filter((type) => allowInherit || type !== 'inherit')
    .map((type) => ({ value: type, label: authLabels[type] }));

  const secretInput = (value: string, placeholder: string, onValueChange: (value: string) => void) => (
    <div className="relative rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus-within:border-amber-500 transition-colors">
      <VariableInput
        value={value}
        masked={!showSecret}
        placeholder={placeholder}
        onChange={onValueChange}
        inputClassName="pr-9"
      />
      <button
        type="button"
        onClick={() => setShowSecret((current) => !current)}
        title={showSecret ? 'Ocultar' : 'Mostrar'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
      >
        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );

  const textInput = (value: string, placeholder: string, onValueChange: (value: string) => void) => (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus-within:border-amber-500 transition-colors">
      <VariableInput value={value} placeholder={placeholder} onChange={onValueChange} />
    </div>
  );

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <label className={fieldLabelClass}>Tipo</label>
        <Select value={auth.type} options={options} onChange={(type) => update({ type: type as AuthType })} />
      </div>

      {auth.type === 'inherit' && <Hint>{inheritedHint ?? 'Usa a autenticação definida na pasta ou na coleção.'}</Hint>}
      {auth.type === 'none' && <Hint>Nenhuma autenticação será enviada.</Hint>}

      {auth.type === 'bearer' && (
        <div>
          <label className={fieldLabelClass}>Token</label>
          {secretInput(auth.token, '{{token}}', (token) => update({ token }))}
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={fieldLabelClass}>Usuário</label>
            {textInput(auth.username, '{{username}}', (username) => update({ username }))}
          </div>
          <div>
            <label className={fieldLabelClass}>Senha</label>
            {secretInput(auth.password, '{{password}}', (password) => update({ password }))}
          </div>
        </div>
      )}

      {auth.type === 'apikey' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={fieldLabelClass}>Chave</label>
            <input
              value={auth.key}
              spellCheck={false}
              placeholder="X-API-Key"
              onChange={(event) => update({ key: event.target.value })}
              className={`${fieldInputClass} font-mono`}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Valor</label>
            {secretInput(auth.value, '{{apiKey}}', (value) => update({ value }))}
          </div>
          <div>
            <label className={fieldLabelClass}>Enviar em</label>
            <Select
              value={auth.location === 'query' ? 'query' : 'header'}
              options={locationOptions}
              onChange={(location) => update({ location })}
            />
          </div>
        </div>
      )}

      {auth.type !== 'inherit' && auth.type !== 'none' && (
        <p className="text-[11px] text-gray-400 dark:text-zinc-500">
          Digite <code className="font-mono">{'{{'}</code> ou pressione <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-mono text-[10px]">Ctrl+Espaço</kbd> / <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-mono text-[10px]">Ctrl+/</kbd> para usar variáveis ou respostas de outras requisições.
        </p>
      )}
    </div>
  );
};

export default AuthEditor;
