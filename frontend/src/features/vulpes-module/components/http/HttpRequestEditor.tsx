import { Send, X } from 'lucide-react';
import React, { useState } from 'react';
import MethodSelect from './MethodSelect';
import SplitPane from '../editors/SplitPane';
import HttpBodyEditor from './HttpBodyEditor';
import AuthEditor from '../editors/AuthEditor';
import SectionTabs from '../editors/SectionTabs';
import { useVulpesStore } from '../../VulpesStore';
import ScriptsPanel from '../request/ScriptsPanel';
import KeyValueTable from '../editors/KeyValueTable';
import VariableInput from '../editors/VariableInput';
import HttpResponseViewer from './HttpResponseViewer';
import { requestActions } from '../../actions/RequestActions';
import ToggleSwitch from '../../../shared/components/forms/ToggleSwitch';
import type { ProtocolEditorProps } from '../request/ProtocolEditorProps';
import type { HttpRequest, KeyValue } from '../../../../interfaces/VulpesInterfaces';
import { paramsFromUrl, pathVariablesFromUrl, urlFromParams } from '../../functions/UrlParams';
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';
import { SettingRow, SettingsSection, TimeoutSetting, TlsSetting } from '../editors/ConnectionSettings';

type HttpSection = 'params' | 'auth' | 'headers' | 'body' | 'settings' | 'scripts';

const countEnabled = (rows: KeyValue[]) => rows.filter((row) => row.enabled && row.key).length;

const HttpRequestEditor: React.FC<ProtocolEditorProps> = ({ tab, runtime, variables, inheritedHint, scripts, onSave }) => {
  const http = tab.request.http as HttpRequest;
  const updateRequest = useVulpesStore((state) => state.updateRequest);
  const [section, setSection] = useState<HttpSection>(() => (http.body.mode === 'none' ? 'params' : 'body'));

  const updateHttp = (update: (current: HttpRequest) => HttpRequest) =>
    updateRequest(tab.id, (request) => ({ ...request, http: update(request.http as HttpRequest) }));

  const send = () => requestActions.sendHttp(tab.id);

  const changeUrl = (url: string) =>
    updateHttp((current) => ({
      ...current,
      url,
      params: paramsFromUrl(url, current.params),
      pathVariables: pathVariablesFromUrl(url, current.pathVariables),
    }));

  const changeParams = (params: KeyValue[]) => updateHttp((current) => ({ ...current, params, url: urlFromParams(current.url, params) }));

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-stretch gap-2 px-4 py-3 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-stretch rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20">
          <MethodSelect method={http.method} onChange={(method) => updateHttp((current) => ({ ...current, method }))} />
          <div className="w-px my-2 bg-gray-200 dark:bg-white/10" />
          <VariableInput
            value={http.url}
            onEnter={send}
            className="flex-1"
            variables={variables}
            onChange={changeUrl}
            placeholder="https://api.exemplo.com/recurso ou {{baseUrl}}/recurso"
          />
        </div>
        {runtime.running ? (
          <button type="button" onClick={() => requestActions.cancel(tab.id)} className={secondaryButtonClass}>
            <X className="w-3.5 h-3.5" />
            Cancelar
          </button>
        ) : (
          <button type="button" onClick={send} className={`${primaryButtonClass} px-5`}>
            <Send className="w-3.5 h-3.5" />
            Enviar
          </button>
        )}
      </div>

      <SplitPane
        defaultRatio={0.45}
        storageKey="vulpes-http-split"
        top={
          <>
            <SectionTabs
              active={section}
              onChange={setSection}
              tabs={[
                { key: 'params', label: 'Params', count: countEnabled(http.params) },
                { key: 'auth', label: 'Autorização' },
                { key: 'headers', label: 'Headers', count: countEnabled(http.headers) },
                { key: 'body', label: 'Corpo' },
                { key: 'settings', label: 'Configurações' },
                { key: 'scripts', label: 'Scripts', hidden: scripts.length === 0 },
              ]}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {section === 'params' && (
                <div className="space-y-5">
                  <div>
                    <h4 className={fieldLabelClass}>Query params</h4>
                    <KeyValueTable rows={http.params} onChange={changeParams} />
                  </div>
                  {http.pathVariables.length > 0 && (
                    <div>
                      <h4 className={fieldLabelClass}>Variáveis de caminho</h4>
                      <KeyValueTable
                        fixedKeys
                        rows={http.pathVariables}
                        onChange={(pathVariables) => updateHttp((current) => ({ ...current, pathVariables }))}
                      />
                    </div>
                  )}
                </div>
              )}
              {section === 'auth' && (
                <AuthEditor
                  auth={tab.request.auth}
                  inheritedHint={inheritedHint}
                  onChange={(auth) => updateRequest(tab.id, (request) => ({ ...request, auth }))}
                />
              )}
              {section === 'headers' && (
                <div className="space-y-2">
                  <KeyValueTable rows={http.headers} onChange={(headers) => updateHttp((current) => ({ ...current, headers }))} />
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                    Content-Type, Accept, User-Agent e Authorization são adicionados automaticamente quando não informados aqui.
                  </p>
                </div>
              )}
              {section === 'body' && (
                <HttpBodyEditor
                  onSend={send}
                  onSave={onSave}
                  body={http.body}
                  onChange={(body) => updateHttp((current) => ({ ...current, body }))}
                />
              )}
              {section === 'settings' && (
                <SettingsSection>
                  <SettingRow title="Seguir redirecionamentos" description="Acompanha respostas 3xx automaticamente (até 10).">
                    <ToggleSwitch
                      label="Seguir redirecionamentos"
                      checked={!http.settings.disableRedirects}
                      onChange={(checked) => updateHttp((current) => ({ ...current, settings: { ...current.settings, disableRedirects: !checked } }))}
                    />
                  </SettingRow>
                  <TlsSetting
                    skipTlsVerify={http.settings.skipTlsVerify}
                    onChange={(skipTlsVerify) => updateHttp((current) => ({ ...current, settings: { ...current.settings, skipTlsVerify } }))}
                  />
                  <TimeoutSetting
                    timeoutMs={http.settings.timeoutMs}
                    onChange={(timeoutMs) => updateHttp((current) => ({ ...current, settings: { ...current.settings, timeoutMs } }))}
                  />
                </SettingsSection>
              )}
              {section === 'scripts' && <ScriptsPanel scripts={scripts} />}
            </div>
          </>
        }
        bottom={<HttpResponseViewer runtime={runtime} onCancel={() => requestActions.cancel(tab.id)} />}
      />
    </div>
  );
};

export default HttpRequestEditor;
