import React from 'react';
import toast from 'react-hot-toast';
import FormDataTable from './FormDataTable';
import CodeEditor from '../editors/CodeEditor';
import { FileUp, Sparkles, X } from 'lucide-react';
import KeyValueTable from '../editors/KeyValueTable';
import { prettyJson } from '../../functions/Formatters';
import { requireToken } from '../../actions/ActionHelpers';
import { VulpesServices } from '../../services/VulpesServices';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { fieldLabelClass, secondaryButtonClass } from '../editors/FormStyles';
import type { BodyMode, HttpBody, RawLanguage } from '../../../../interfaces/VulpesInterfaces';

interface HttpBodyEditorProps {
  body: HttpBody;
  onSend: () => void;
  onSave: () => void;
  onChange: (body: HttpBody) => void;
}

const bodyModes: { mode: BodyMode; label: string }[] = [
  { mode: 'none', label: 'Nenhum' },
  { mode: 'formdata', label: 'form-data' },
  { mode: 'urlencoded', label: 'x-www-form-urlencoded' },
  { mode: 'raw', label: 'raw' },
  { mode: 'binary', label: 'binário' },
  { mode: 'graphql', label: 'GraphQL' },
];

const rawLanguages: { language: RawLanguage; label: string }[] = [
  { language: 'json', label: 'JSON' },
  { language: 'text', label: 'Texto' },
  { language: 'xml', label: 'XML' },
  { language: 'html', label: 'HTML' },
  { language: 'javascript', label: 'JavaScript' },
];

const HttpBodyEditor: React.FC<HttpBodyEditorProps> = ({ body, onChange, onSend, onSave }) => {
  const update = (patch: Partial<HttpBody>) => onChange({ ...body, ...patch });

  const formatRaw = () => {
    const formatted = prettyJson(body.raw);
    if (formatted === null) {
      toast.error('O corpo não é um JSON válido');
      return;
    }
    update({ raw: formatted });
  };

  const chooseBinary = async () => {
    try {
      const path = await VulpesServices.chooseRequestFile(requireToken());
      if (path) update({ binaryPath: path });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {bodyModes.map(({ mode, label }) => (
          <label key={mode} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="radio"
              checked={body.mode === mode}
              onChange={() => update({ mode })}
              className="accent-amber-500"
            />
            {label}
          </label>
        ))}
        {body.mode === 'raw' && (
          <div className="ml-auto flex items-center gap-2">
            <select
              value={body.language}
              onChange={(event) => update({ language: event.target.value as RawLanguage })}
              className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-2 py-1 text-xs text-amber-600 dark:text-amber-400 font-semibold focus:outline-none"
            >
              {rawLanguages.map(({ language, label }) => (
                <option key={language} value={language}>
                  {label}
                </option>
              ))}
            </select>
            {body.language === 'json' && (
              <button type="button" onClick={formatRaw} className={secondaryButtonClass} title="Formatar JSON">
                <Sparkles className="w-3.5 h-3.5" />
                Formatar
              </button>
            )}
          </div>
        )}
      </div>

      {body.mode === 'none' && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 py-6 text-center">Esta requisição não envia corpo.</p>
      )}

      {body.mode === 'raw' && (
        <div className="flex-1 min-h-[160px] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
          <CodeEditor
            value={body.raw}
            onRun={onSend}
            onSave={onSave}
            language={body.language}
            placeholder="Corpo da requisição"
            onChange={(raw) => update({ raw })}
          />
        </div>
      )}

      {body.mode === 'urlencoded' && (
        <KeyValueTable rows={body.urlEncoded} onChange={(urlEncoded) => update({ urlEncoded })} />
      )}

      {body.mode === 'formdata' && <FormDataTable fields={body.formData} onChange={(formData) => update({ formData })} />}

      {body.mode === 'binary' && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-white/10 p-4">
          <button type="button" onClick={chooseBinary} className={secondaryButtonClass}>
            <FileUp className="w-4 h-4 text-amber-500" />
            Selecionar arquivo
          </button>
          <span className="flex-1 min-w-0 truncate text-xs font-mono text-gray-600 dark:text-zinc-300">
            {body.binaryPath || 'Nenhum arquivo selecionado'}
          </span>
          {body.binaryPath && (
            <button
              type="button"
              title="Remover arquivo"
              onClick={() => update({ binaryPath: '' })}
              className="p-1 rounded text-gray-400 hover:text-rose-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {body.mode === 'graphql' && (
        <div className="flex-1 min-h-[180px] grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
          <div className="flex flex-col min-h-0">
            <span className={fieldLabelClass}>Query</span>
            <div className="flex-1 min-h-[140px] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
              <CodeEditor
                value={body.graphqlQuery}
                onRun={onSend}
                onSave={onSave}
                language="graphql"
                placeholder="query { ... }"
                onChange={(graphqlQuery) => update({ graphqlQuery })}
              />
            </div>
          </div>
          <div className="flex flex-col min-h-0">
            <span className={fieldLabelClass}>Variáveis (JSON)</span>
            <div className="flex-1 min-h-[140px] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
              <CodeEditor
                value={body.graphqlVariables}
                onRun={onSend}
                onSave={onSave}
                language="json"
                placeholder="{ }"
                onChange={(graphqlVariables) => update({ graphqlVariables })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HttpBodyEditor;
