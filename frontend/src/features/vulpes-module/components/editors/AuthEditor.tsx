import React, { useState } from 'react';
import CodeEditor from './CodeEditor';
import VariableInput from './VariableInput';
import { Eye, EyeOff, Info } from 'lucide-react';
import VariableShortcutHint from './VariableShortcutHint';
import { useTranslation } from '../../../i18n/useTranslation';
import Select from '../../../shared/components/forms/Select';
import { fieldInputClass, fieldLabelClass } from './FormStyles';
import { emptyAuth } from '../../functions/RequestDefaults';
import type { Auth, AuthType, JwtAlgorithm, OAuth2ClientAuth, OAuth2GrantType } from '../../../../interfaces/VulpesInterfaces';

interface AuthEditorProps {
  auth: Auth;
  allowInherit?: boolean;
  inheritedHint?: string;
  onChange: (auth: Auth) => void;
}

type TextField = 'token' | 'value' | 'scope' | 'region' | 'secret' | 'payload' | 'service' | 'clientId' | 'username'
  | 'password' | 'tokenUrl' | 'accessKey' | 'secretKey' | 'clientSecret' | 'sessionToken';

const authTypes: AuthType[] = ['inherit', 'none', 'bearer', 'basic', 'apikey', 'digest', 'oauth2', 'jwt', 'awsv4'];

const jwtAlgorithms: JwtAlgorithm[] = ['HS256', 'HS384', 'HS512'];

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-zinc-400">
    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
    <span>{children}</span>
  </p>
);

const Field: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({ label, wide, children }) => (
  <div className={wide ? 'sm:col-span-2' : undefined}>
    <label className={fieldLabelClass}>{label}</label>
    {children}
  </div>
);

const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onChange, allowInherit = true, inheritedHint }) => {
  const { dictionary } = useTranslation();
  const [showSecret, setShowSecret] = useState(false);
  const authTexts = dictionary.vulpes.auth;
  const commonTexts = dictionary.vulpes.common;
  const editorTexts = dictionary.vulpes.editors;
  const current: Auth = { ...emptyAuth(auth.type), ...auth };
  const grantType = current.grantType || 'client_credentials';

  const update = (patch: Partial<Auth>) => onChange({ ...current, ...patch });
  const textOf = (field: TextField) => current[field] ?? '';

  const typeOptions = authTypes
    .filter((type) => allowInherit || type !== 'inherit')
    .map((type) => ({ value: type, label: authTexts.types[type] }));
  const locationOptions = [
    { value: 'header', label: 'Header' },
    { value: 'query', label: authTexts.queryParams },
  ];
  const grantOptions = [
    { value: 'client_credentials', label: authTexts.grantTypes.client_credentials },
    { value: 'password', label: authTexts.grantTypes.password },
  ];
  const clientAuthOptions = [
    { value: 'header', label: authTexts.clientAuthOptions.header },
    { value: 'body', label: authTexts.clientAuthOptions.body },
  ];
  const algorithmOptions = jwtAlgorithms.map((algorithm) => ({ value: algorithm, label: algorithm }));

  const secretInput = (field: TextField, placeholder: string) => (
    <div className="relative rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus-within:border-amber-500 transition-colors">
      <VariableInput
        value={textOf(field)}
        masked={!showSecret}
        placeholder={placeholder}
        inputClassName="pr-9"
        onChange={(value) => update({ [field]: value })}
      />
      <button
        type="button"
        onClick={() => setShowSecret((visible) => !visible)}
        title={showSecret ? editorTexts.hideValue : editorTexts.showValue}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
      >
        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );

  const textInput = (field: TextField, placeholder: string) => (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus-within:border-amber-500 transition-colors">
      <VariableInput value={textOf(field)} placeholder={placeholder} onChange={(value) => update({ [field]: value })} />
    </div>
  );

  return (
    <div className="max-w-xl space-y-4">
      <Field label={commonTexts.type}>
        <Select value={current.type} options={typeOptions} onChange={(type) => update({ type: type as AuthType })} />
      </Field>

      {current.type === 'inherit' && <Hint>{inheritedHint ?? authTexts.inheritHint}</Hint>}
      {current.type === 'none' && <Hint>{authTexts.noneHint}</Hint>}

      {current.type === 'bearer' && (
        <Field label={authTexts.token}>{secretInput('token', '{{token}}')}</Field>
      )}

      {(current.type === 'basic' || current.type === 'digest') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={authTexts.user}>{textInput('username', '{{username}}')}</Field>
          <Field label={authTexts.password}>{secretInput('password', '{{password}}')}</Field>
        </div>
      )}
      {current.type === 'digest' && <Hint>{authTexts.digestHint}</Hint>}

      {current.type === 'apikey' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={commonTexts.key}>
            <input
              value={current.key}
              spellCheck={false}
              placeholder="X-API-Key"
              onChange={(event) => update({ key: event.target.value })}
              className={`${fieldInputClass} font-mono`}
            />
          </Field>
          <Field label={commonTexts.value}>{secretInput('value', '{{apiKey}}')}</Field>
          <Field label={authTexts.sendIn}>
            <Select
              value={current.location === 'query' ? 'query' : 'header'}
              options={locationOptions}
              onChange={(location) => update({ location })}
            />
          </Field>
        </div>
      )}

      {current.type === 'oauth2' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={authTexts.grantType}>
              <Select value={grantType} options={grantOptions} onChange={(value) => update({ grantType: value as OAuth2GrantType })} />
            </Field>
            <Field label={authTexts.clientAuth}>
              <Select
                value={current.clientAuth || 'header'}
                options={clientAuthOptions}
                onChange={(value) => update({ clientAuth: value as OAuth2ClientAuth })}
              />
            </Field>
            <Field label={authTexts.tokenUrl} wide>{textInput('tokenUrl', 'https://auth.example.com/oauth/token')}</Field>
            <Field label={authTexts.clientId}>{textInput('clientId', '{{clientId}}')}</Field>
            <Field label={authTexts.clientSecret}>{secretInput('clientSecret', '{{clientSecret}}')}</Field>
            {grantType === 'password' && (
              <>
                <Field label={authTexts.user}>{textInput('username', '{{username}}')}</Field>
                <Field label={authTexts.password}>{secretInput('password', '{{password}}')}</Field>
              </>
            )}
            <Field label={authTexts.scope} wide>{textInput('scope', 'read write')}</Field>
          </div>
          <Hint>{authTexts.oauth2Hint}</Hint>
        </>
      )}

      {current.type === 'jwt' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={authTexts.algorithm}>
              <Select value={current.algorithm || 'HS256'} options={algorithmOptions} onChange={(value) => update({ algorithm: value as JwtAlgorithm })} />
            </Field>
            <Field label={authTexts.secret}>{secretInput('secret', '{{jwtSecret}}')}</Field>
          </div>
          <Field label={authTexts.payload}>
            <div className="h-40 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
              <CodeEditor
                language="json"
                value={textOf('payload')}
                placeholder={'{\n  "sub": "123"\n}'}
                onChange={(payload) => update({ payload })}
              />
            </div>
          </Field>
          <Hint>{authTexts.jwtHint}</Hint>
        </>
      )}

      {current.type === 'awsv4' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={authTexts.accessKey}>{textInput('accessKey', '{{awsAccessKey}}')}</Field>
            <Field label={authTexts.secretKey}>{secretInput('secretKey', '{{awsSecretKey}}')}</Field>
            <Field label={authTexts.region}>{textInput('region', 'us-east-1')}</Field>
            <Field label={authTexts.service}>{textInput('service', 's3')}</Field>
            <Field label={authTexts.sessionToken} wide>{secretInput('sessionToken', authTexts.optional)}</Field>
          </div>
          <Hint>{authTexts.awsHint}</Hint>
        </>
      )}

      {current.type !== 'inherit' && current.type !== 'none' && (
        <p className="text-[11px] text-gray-400 dark:text-zinc-500">
          <VariableShortcutHint template={commonTexts.variableHint} />
        </p>
      )}
    </div>
  );
};

export default AuthEditor;
