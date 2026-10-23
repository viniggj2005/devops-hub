import { Send } from 'lucide-react';
import React, { useState } from 'react';
import SplitPane from '../editors/SplitPane';
import CodeEditor from '../editors/CodeEditor';
import AuthEditor from '../editors/AuthEditor';
import SectionTabs from '../editors/SectionTabs';
import { useVulpesStore } from '../../VulpesStore';
import KeyValueTable from '../editors/KeyValueTable';
import VariableInput from '../editors/VariableInput';
import RealtimeMessageLog from './RealtimeMessageLog';
import { requestActions } from '../../actions/RequestActions';
import { ConnectButton, ConnectionBadge } from './ConnectionControls';
import { paramsFromUrl, urlFromParams } from '../../functions/UrlParams';
import type { ProtocolEditorProps } from '../request/ProtocolEditorProps';
import { fieldInputClass, primaryButtonClass } from '../editors/FormStyles';
import { SettingRow, SettingsSection, TlsSetting } from '../editors/ConnectionSettings';
import type { KeyValue, WebSocketMessageKind, WebSocketRequest } from '../../../../interfaces/VulpesInterfaces';

type WebSocketSection = 'message' | 'params' | 'headers' | 'auth' | 'settings';

const messageKinds: { kind: WebSocketMessageKind; label: string }[] = [
  { kind: 'text', label: 'Texto' },
  { kind: 'json', label: 'JSON' },
  { kind: 'binary', label: 'Binário (base64)' },
];

const WebSocketRequestEditor: React.FC<ProtocolEditorProps> = ({ tab, runtime, variables, inheritedHint, onSave }) => {
  const webSocket = tab.request.webSocket as WebSocketRequest;
  const [section, setSection] = useState<WebSocketSection>('message');
  const updateRequest = useVulpesStore((state) => state.updateRequest);
  const clearRealtimeEvents = useVulpesStore((state) => state.clearRealtimeEvents);
  const connected = runtime.connection === 'connected';

  const updateWebSocket = (update: (current: WebSocketRequest) => WebSocketRequest) =>
    updateRequest(tab.id, (request) => ({ ...request, webSocket: update(request.webSocket as WebSocketRequest) }));

  const connect = () => requestActions.connect(tab.id);
  const sendMessage = () => connected && requestActions.sendWebSocketMessage(tab.id);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-stretch gap-2 px-4 py-3 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-stretch rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20">
          <ConnectionBadge status={runtime.connection} />
          <div className="w-px my-2 bg-gray-200 dark:bg-white/10" />
          <VariableInput
            className="flex-1"
            value={webSocket.url}
            variables={variables}
            onEnter={connected ? undefined : connect}
            placeholder="wss://echo.exemplo.com/socket"
            onChange={(url) => updateWebSocket((current) => ({ ...current, url, params: paramsFromUrl(url, current.params) }))}
          />
        </div>
        <ConnectButton status={runtime.connection} onConnect={connect} onDisconnect={() => requestActions.disconnect(tab.id)} />
      </div>

      <SplitPane
        defaultRatio={0.42}
        storageKey="vulpes-realtime-split"
        top={
          <>
            <SectionTabs
              active={section}
              onChange={setSection}
              tabs={[
                { key: 'message', label: 'Mensagem' },
                { key: 'params', label: 'Params', count: webSocket.params.filter((param) => param.enabled && param.key).length },
                { key: 'headers', label: 'Headers', count: webSocket.headers.filter((header) => header.enabled && header.key).length },
                { key: 'auth', label: 'Autorização' },
                { key: 'settings', label: 'Configurações' },
              ]}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {section === 'message' && (
                <div className="h-full flex flex-col gap-2 min-h-0">
                  <div className="flex items-center gap-2">
                    <select
                      value={webSocket.messageKind}
                      onChange={(event) => updateWebSocket((current) => ({ ...current, messageKind: event.target.value as WebSocketMessageKind }))}
                      className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-2 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 focus:outline-none"
                    >
                      {messageKinds.map(({ kind, label }) => (
                        <option key={kind} value={kind}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {runtime.error && <span className="text-[11px] text-rose-600 dark:text-rose-400 truncate">{runtime.error}</span>}
                    <button
                      type="button"
                      disabled={!connected}
                      onClick={sendMessage}
                      title={connected ? 'Enviar (Ctrl+Enter)' : 'Conecte-se para enviar mensagens'}
                      className={`ml-auto ${primaryButtonClass}`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar
                    </button>
                  </div>
                  <div className="flex-1 min-h-[120px] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CodeEditor
                      onSave={onSave}
                      onRun={sendMessage}
                      value={webSocket.message}
                      placeholder="Mensagem a enviar"
                      language={webSocket.messageKind === 'json' ? 'json' : 'text'}
                      onChange={(message) => updateWebSocket((current) => ({ ...current, message }))}
                    />
                  </div>
                </div>
              )}
              {section === 'params' && (
                <KeyValueTable
                  rows={webSocket.params}
                  onChange={(params: KeyValue[]) => updateWebSocket((current) => ({ ...current, params, url: urlFromParams(current.url, params) }))}
                />
              )}
              {section === 'headers' && (
                <KeyValueTable rows={webSocket.headers} onChange={(headers) => updateWebSocket((current) => ({ ...current, headers }))} />
              )}
              {section === 'auth' && (
                <AuthEditor
                  auth={tab.request.auth}
                  inheritedHint={inheritedHint}
                  onChange={(auth) => updateRequest(tab.id, (request) => ({ ...request, auth }))}
                />
              )}
              {section === 'settings' && (
                <SettingsSection>
                  <SettingRow title="Subprotocolos" description="Separados por vírgula, enviados em Sec-WebSocket-Protocol.">
                    <input
                      spellCheck={false}
                      placeholder="chat, json"
                      value={webSocket.subprotocols.join(', ')}
                      onChange={(event) =>
                        updateWebSocket((current) => ({ ...current, subprotocols: event.target.value.split(',').map((value) => value.trimStart()) }))
                      }
                      className={`${fieldInputClass} w-56 font-mono`}
                    />
                  </SettingRow>
                  <TlsSetting
                    skipTlsVerify={webSocket.skipTlsVerify}
                    onChange={(skipTlsVerify) => updateWebSocket((current) => ({ ...current, skipTlsVerify }))}
                  />
                </SettingsSection>
              )}
            </div>
          </>
        }
        bottom={
          <RealtimeMessageLog
            events={runtime.events}
            onClear={() => clearRealtimeEvents(tab.id)}
            emptyHint="Conecte-se para acompanhar as mensagens enviadas e recebidas."
          />
        }
      />
    </div>
  );
};

export default WebSocketRequestEditor;
