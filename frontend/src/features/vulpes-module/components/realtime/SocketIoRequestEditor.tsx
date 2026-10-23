import React, { useState } from 'react';
import SplitPane from '../editors/SplitPane';
import CodeEditor from '../editors/CodeEditor';
import AuthEditor from '../editors/AuthEditor';
import SectionTabs from '../editors/SectionTabs';
import { Plus, Send, Trash2 } from 'lucide-react';
import { useVulpesStore } from '../../VulpesStore';
import KeyValueTable from '../editors/KeyValueTable';
import VariableInput from '../editors/VariableInput';
import RealtimeMessageLog from './RealtimeMessageLog';
import { requestActions } from '../../actions/RequestActions';
import { ConnectButton, ConnectionBadge } from './ConnectionControls';
import { paramsFromUrl, urlFromParams } from '../../functions/UrlParams';
import type { ProtocolEditorProps } from '../request/ProtocolEditorProps';
import { SettingRow, SettingsSection, TlsSetting } from '../editors/ConnectionSettings';
import type { SocketIoRequest, SocketIoVersion } from '../../../../interfaces/VulpesInterfaces';
import { fieldInputClass, fieldLabelClass, iconButtonClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';

type SocketIoSection = 'message' | 'params' | 'headers' | 'auth' | 'handshake' | 'settings';

const versions: { version: SocketIoVersion; label: string }[] = [
  { version: 'v4', label: 'v4 (Engine.IO 4)' },
  { version: 'v3', label: 'v3 (Engine.IO 4)' },
  { version: 'v2', label: 'v2 (Engine.IO 3)' },
];

const SocketIoRequestEditor: React.FC<ProtocolEditorProps> = ({ tab, runtime, variables, inheritedHint, onSave }) => {
  const socketIo = tab.request.socketIo as SocketIoRequest;
  const [section, setSection] = useState<SocketIoSection>('message');
  const updateRequest = useVulpesStore((state) => state.updateRequest);
  const clearRealtimeEvents = useVulpesStore((state) => state.clearRealtimeEvents);
  const connected = runtime.connection === 'connected';
  const eventArguments = socketIo.arguments.length ? socketIo.arguments : [''];

  const updateSocketIo = (update: (current: SocketIoRequest) => SocketIoRequest) =>
    updateRequest(tab.id, (request) => ({ ...request, socketIo: update(request.socketIo as SocketIoRequest) }));

  const updateArgument = (argumentIndex: number, value: string) =>
    updateSocketIo((current) => {
      const nextArguments = current.arguments.length ? [...current.arguments] : [''];
      nextArguments[argumentIndex] = value;
      return { ...current, arguments: nextArguments };
    });

  const connect = () => requestActions.connect(tab.id);
  const emit = () => connected && requestActions.emitSocketIo(tab.id);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-stretch gap-2 px-4 py-3 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-stretch rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20">
          <ConnectionBadge status={runtime.connection} />
          <div className="w-px my-2 bg-gray-200 dark:bg-white/10" />
          <VariableInput
            className="flex-1"
            value={socketIo.url}
            variables={variables}
            onEnter={connected ? undefined : connect}
            placeholder="http://localhost:3000 ou https://api.exemplo.com/namespace"
            onChange={(url) => updateSocketIo((current) => ({ ...current, url, params: paramsFromUrl(url, current.params) }))}
          />
        </div>
        <ConnectButton status={runtime.connection} onConnect={connect} onDisconnect={() => requestActions.disconnect(tab.id)} />
      </div>

      <SplitPane
        defaultRatio={0.45}
        storageKey="vulpes-realtime-split"
        top={
          <>
            <SectionTabs
              active={section}
              onChange={setSection}
              tabs={[
                { key: 'message', label: 'Evento' },
                { key: 'params', label: 'Params', count: socketIo.params.filter((param) => param.enabled && param.key).length },
                { key: 'headers', label: 'Headers', count: socketIo.headers.filter((header) => header.enabled && header.key).length },
                { key: 'auth', label: 'Autorização' },
                { key: 'handshake', label: 'Handshake' },
                { key: 'settings', label: 'Configurações' },
              ]}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {section === 'message' && (
                <div className="space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <label className={fieldLabelClass}>Evento</label>
                      <input
                        spellCheck={false}
                        value={socketIo.event}
                        placeholder="message"
                        onChange={(event) => updateSocketIo((current) => ({ ...current, event: event.target.value }))}
                        onKeyDown={(event) => event.key === 'Enter' && emit()}
                        className={`${fieldInputClass} font-mono`}
                      />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={socketIo.withAck}
                        className="accent-amber-500"
                        onChange={(event) => updateSocketIo((current) => ({ ...current, withAck: event.target.checked }))}
                      />
                      Aguardar ack
                    </label>
                    <button
                      type="button"
                      onClick={emit}
                      disabled={!connected}
                      title={connected ? 'Emitir (Ctrl+Enter)' : 'Conecte-se para emitir eventos'}
                      className={primaryButtonClass}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Emitir
                    </button>
                  </div>
                  {runtime.error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{runtime.error}</p>}
                  {eventArguments.map((argument, argumentIndex) => (
                    <div key={argumentIndex}>
                      <div className="flex items-center justify-between">
                        <span className={fieldLabelClass}>Argumento {argumentIndex + 1} · JSON ou texto</span>
                        {eventArguments.length > 1 && (
                          <button
                            type="button"
                            title="Remover argumento"
                            className={iconButtonClass}
                            onClick={() =>
                              updateSocketIo((current) => ({ ...current, arguments: current.arguments.filter((_, index) => index !== argumentIndex) }))
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="h-28 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                        <CodeEditor
                          onRun={emit}
                          onSave={onSave}
                          value={argument}
                          language="json"
                          placeholder='{"mensagem": "olá"}'
                          onChange={(value) => updateArgument(argumentIndex, value)}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => updateSocketIo((current) => ({ ...current, arguments: [...eventArguments, ''] }))}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar argumento
                  </button>
                </div>
              )}
              {section === 'params' && (
                <KeyValueTable
                  rows={socketIo.params}
                  onChange={(params) => updateSocketIo((current) => ({ ...current, params, url: urlFromParams(current.url, params) }))}
                />
              )}
              {section === 'headers' && (
                <KeyValueTable rows={socketIo.headers} onChange={(headers) => updateSocketIo((current) => ({ ...current, headers }))} />
              )}
              {section === 'auth' && (
                <AuthEditor
                  auth={tab.request.auth}
                  inheritedHint={inheritedHint}
                  onChange={(auth) => updateRequest(tab.id, (request) => ({ ...request, auth }))}
                />
              )}
              {section === 'handshake' && (
                <div className="max-w-2xl space-y-2">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Objeto JSON enviado no pacote CONNECT (<span className="font-mono">socket.handshake.auth</span>). Disponível nas versões v3 e v4; na v2 use
                    query params.
                  </p>
                  <div className="h-44 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CodeEditor
                      language="json"
                      onSave={onSave}
                      placeholder='{"token": "{{token}}"}'
                      value={socketIo.handshakeAuth}
                      onChange={(handshakeAuth) => updateSocketIo((current) => ({ ...current, handshakeAuth }))}
                    />
                  </div>
                </div>
              )}
              {section === 'settings' && (
                <SettingsSection>
                  <SettingRow title="Versão do cliente" description="Compatível com servidores Socket.IO 2, 3 e 4.">
                    <select
                      value={socketIo.version}
                      onChange={(event) => updateSocketIo((current) => ({ ...current, version: event.target.value as SocketIoVersion }))}
                      className={`${fieldInputClass} w-48`}
                    >
                      {versions.map(({ version, label }) => (
                        <option key={version} value={version}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </SettingRow>
                  <SettingRow title="Caminho" description="Rota do servidor Engine.IO (padrão /socket.io/).">
                    <input
                      spellCheck={false}
                      value={socketIo.path}
                      placeholder="/socket.io/"
                      onChange={(event) => updateSocketIo((current) => ({ ...current, path: event.target.value }))}
                      className={`${fieldInputClass} w-48 font-mono`}
                    />
                  </SettingRow>
                  <SettingRow title="Namespace" description="Vazio usa o caminho da URL ou o namespace raiz /.">
                    <input
                      spellCheck={false}
                      placeholder="/admin"
                      value={socketIo.namespace}
                      onChange={(event) => updateSocketIo((current) => ({ ...current, namespace: event.target.value }))}
                      className={`${fieldInputClass} w-48 font-mono`}
                    />
                  </SettingRow>
                  <TlsSetting
                    skipTlsVerify={socketIo.skipTlsVerify}
                    onChange={(skipTlsVerify) => updateSocketIo((current) => ({ ...current, skipTlsVerify }))}
                  />
                </SettingsSection>
              )}
            </div>
          </>
        }
        bottom={
          <RealtimeMessageLog
            showEventNames
            events={runtime.events}
            onClear={() => clearRealtimeEvents(tab.id)}
            emptyHint="Conecte-se para acompanhar os eventos emitidos e recebidos."
          />
        }
      />
    </div>
  );
};

export default SocketIoRequestEditor;
