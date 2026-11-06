import React, { useState } from 'react';
import SplitPane from '../editors/SplitPane';
import CodeEditor from '../editors/CodeEditor';
import AuthEditor from '../editors/AuthEditor';
import SectionTabs from '../editors/SectionTabs';
import { useVulpesStore } from '../../VulpesStore';
import VariableInput from '../editors/VariableInput';
import RealtimeMessageLog from './RealtimeMessageLog';
import { requestActions } from '../../actions/RequestActions';
import { Plus, Send, Radio, Trash2, BellOff } from 'lucide-react';
import { ConnectButton, ConnectionBadge } from './ConnectionControls';
import type { ProtocolEditorProps } from '../request/ProtocolEditorProps';
import { SettingRow, SettingsSection, TlsSetting } from '../editors/ConnectionSettings';
import type { MqttQos, MqttRequest, MqttSubscription, WebSocketMessageKind } from '../../../../interfaces/VulpesInterfaces';
import { fieldInputClass, fieldLabelClass, iconButtonClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';

type MqttSection = 'publish' | 'subscriptions' | 'auth' | 'will' | 'settings';

const qosOptions: { qos: MqttQos; label: string }[] = [
  { qos: 0, label: 'QoS 0 · No máximo uma vez' },
  { qos: 1, label: 'QoS 1 · Pelo menos uma vez' },
  { qos: 2, label: 'QoS 2 · Exatamente uma vez' },
];

const messageKinds: { kind: WebSocketMessageKind; label: string }[] = [
  { kind: 'json', label: 'JSON' },
  { kind: 'text', label: 'Texto' },
  { kind: 'binary', label: 'Binário (base64)' },
];

const MqttRequestEditor: React.FC<ProtocolEditorProps> = ({ tab, runtime, variables, inheritedHint, onSave }) => {
  const mqtt = tab.request.mqtt as MqttRequest;
  const [section, setSection] = useState<MqttSection>('publish');
  const updateRequest = useVulpesStore((state) => state.updateRequest);
  const clearRealtimeEvents = useVulpesStore((state) => state.clearRealtimeEvents);
  const connected = runtime.connection === 'connected';

  const updateMqtt = (update: (current: MqttRequest) => MqttRequest) =>
    updateRequest(tab.id, (request) => ({ ...request, mqtt: update(request.mqtt as MqttRequest) }));

  const updateSubscription = (subscriptionIndex: number, patch: Partial<MqttSubscription>) =>
    updateMqtt((current) => ({
      ...current,
      subscriptions: current.subscriptions.map((entry, index) => (index === subscriptionIndex ? { ...entry, ...patch } : entry)),
    }));

  const connect = () => requestActions.connect(tab.id);
  const publish = () => connected && requestActions.publishMqtt(tab.id);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-stretch gap-2 px-4 py-3 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-stretch rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20">
          <ConnectionBadge status={runtime.connection} />
          <div className="w-px my-2 bg-gray-200 dark:bg-white/10" />
          <VariableInput
            className="flex-1"
            value={mqtt.url}
            variables={variables}
            onEnter={connected ? undefined : connect}
            placeholder="mqtt://localhost:1883, mqtts://broker.exemplo.com:8883 ou wss://broker.exemplo.com:8084/mqtt"
            onChange={(url) => updateMqtt((current) => ({ ...current, url }))}
          />
        </div>
        <ConnectButton status={runtime.connection} onConnect={connect} onDisconnect={() => requestActions.disconnect(tab.id)} />
      </div>

      <SplitPane
        defaultRatio={0.46}
        storageKey="vulpes-realtime-split"
        top={
          <>
            <SectionTabs
              active={section}
              onChange={setSection}
              tabs={[
                { key: 'publish', label: 'Publicar' },
                {
                  key: 'subscriptions',
                  label: 'Tópicos',
                  count: mqtt.subscriptions.filter((subscription) => subscription.enabled && subscription.topic.trim()).length,
                },
                { key: 'auth', label: 'Autorização' },
                { key: 'will', label: 'Last Will' },
                { key: 'settings', label: 'Configurações' },
              ]}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {section === 'publish' && (
                <div className="h-full flex flex-col gap-3 min-h-0">
                  <div className="flex flex-wrap items-end gap-2.5">
                    <div className="flex-1 min-w-[200px]">
                      <label className={fieldLabelClass}>Tópico</label>
                      <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500">
                        <VariableInput
                          value={mqtt.topic}
                          variables={variables}
                          onEnter={publish}
                          placeholder="sensors/temperature"
                          onChange={(topic) => updateMqtt((current) => ({ ...current, topic }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabelClass}>QoS</label>
                      <select
                        value={mqtt.qos}
                        onChange={(event) => updateMqtt((current) => ({ ...current, qos: Number(event.target.value) as MqttQos }))}
                        className={fieldInputClass}
                      >
                        {qosOptions.map(({ qos, label }) => (
                          <option key={qos} value={qos}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={fieldLabelClass}>Formato</label>
                      <select
                        value={mqtt.messageKind}
                        onChange={(event) => updateMqtt((current) => ({ ...current, messageKind: event.target.value as WebSocketMessageKind }))}
                        className={fieldInputClass}
                      >
                        {messageKinds.map(({ kind, label }) => (
                          <option key={kind} value={kind}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={mqtt.retain}
                        className="accent-amber-500"
                        onChange={(event) => updateMqtt((current) => ({ ...current, retain: event.target.checked }))}
                      />
                      Retain
                    </label>
                    <button
                      type="button"
                      onClick={publish}
                      disabled={!connected}
                      title={connected ? 'Publicar (Ctrl+Enter)' : 'Conecte-se ao broker para publicar'}
                      className={primaryButtonClass}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Publicar
                    </button>
                  </div>
                  {runtime.error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{runtime.error}</p>}
                  <div className="flex-1 min-h-[120px] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CodeEditor
                      onRun={publish}
                      onSave={onSave}
                      value={mqtt.message}
                      placeholder='{"temperature": 23.5}'
                      language={mqtt.messageKind === 'json' ? 'json' : 'text'}
                      onChange={(message) => updateMqtt((current) => ({ ...current, message }))}
                    />
                  </div>
                </div>
              )}

              {section === 'subscriptions' && (
                <div className="space-y-3 max-w-3xl">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Tópicos marcados são assinados automaticamente ao conectar no broker. Suporta curingas MQTT (<span className="font-mono">+</span> e{' '}
                    <span className="font-mono">#</span>).
                  </p>
                  {runtime.error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{runtime.error}</p>}
                  <div className="space-y-2">
                    {mqtt.subscriptions.map((subscription, subscriptionIndex) => (
                      <div
                        key={subscriptionIndex}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-2.5 py-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={subscription.enabled}
                          className="accent-amber-500"
                          onChange={(event) => updateSubscription(subscriptionIndex, { enabled: event.target.checked })}
                        />
                        <VariableInput
                          className="flex-1"
                          variables={variables}
                          value={subscription.topic}
                          placeholder="sensors/+/telemetry ou #"
                          onChange={(topic) => updateSubscription(subscriptionIndex, { topic })}
                        />
                        <select
                          value={subscription.qos}
                          onChange={(event) => updateSubscription(subscriptionIndex, { qos: Number(event.target.value) as MqttQos })}
                          className="rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 px-2 py-1 text-xs text-gray-700 dark:text-zinc-200 focus:outline-none"
                        >
                          <option value={0}>QoS 0</option>
                          <option value={1}>QoS 1</option>
                          <option value={2}>QoS 2</option>
                        </select>
                        {connected && (
                          <>
                            <button
                              type="button"
                              title="Assinar este tópico agora"
                              disabled={!subscription.topic.trim()}
                              onClick={() => requestActions.subscribeMqtt(tab.id, { ...subscription, enabled: true })}
                              className={`${secondaryButtonClass} !px-2 !py-1`}
                            >
                              <Radio className="w-3.5 h-3.5 text-emerald-500" />
                              Assinar
                            </button>
                            <button
                              type="button"
                              title="Cancelar inscrição deste tópico no broker"
                              disabled={!subscription.topic.trim()}
                              onClick={() => requestActions.unsubscribeMqtt(tab.id, subscription.topic)}
                              className={iconButtonClass}
                            >
                              <BellOff className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          title="Remover tópico"
                          onClick={() =>
                            updateMqtt((current) => ({
                              ...current,
                              subscriptions: current.subscriptions.filter((_, index) => index !== subscriptionIndex),
                            }))
                          }
                          className={`${iconButtonClass} hover:text-rose-500`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() =>
                      updateMqtt((current) => ({
                        ...current,
                        subscriptions: [...current.subscriptions, { topic: '', qos: 0, enabled: true }],
                      }))
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar tópico
                  </button>
                </div>
              )}

              {section === 'auth' && (
                <div className="space-y-5 max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={fieldLabelClass}>Usuário do Broker (opcional)</label>
                      <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500">
                        <VariableInput
                          value={mqtt.username}
                          variables={variables}
                          placeholder="{{mqtt_user}}"
                          onChange={(username) => updateMqtt((current) => ({ ...current, username }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabelClass}>Senha do Broker (opcional)</label>
                      <input
                        type="password"
                        value={mqtt.password}
                        placeholder="{{mqtt_password}}"
                        onChange={(event) => updateMqtt((current) => ({ ...current, password: event.target.value }))}
                        className={`${fieldInputClass} w-full font-mono`}
                      />
                    </div>
                  </div>
                  <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                    <AuthEditor
                      auth={tab.request.auth}
                      inheritedHint={inheritedHint}
                      onChange={(auth) => updateRequest(tab.id, (request) => ({ ...request, auth }))}
                    />
                  </div>
                </div>
              )}

              {section === 'will' && (
                <div className="space-y-3 max-w-2xl">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Mensagem Last Will and Testament (LWT) publicada automaticamente pelo broker caso a conexão caia inesperadamente.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className={fieldLabelClass}>Will Topic</label>
                      <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500">
                        <VariableInput
                          variables={variables}
                          value={mqtt.willTopic}
                          placeholder="clients/vulpes/status"
                          onChange={(willTopic) => updateMqtt((current) => ({ ...current, willTopic }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabelClass}>Will QoS</label>
                      <select
                        value={mqtt.willQos}
                        onChange={(event) => updateMqtt((current) => ({ ...current, willQos: Number(event.target.value) as MqttQos }))}
                        className={fieldInputClass}
                      >
                        <option value={0}>QoS 0</option>
                        <option value={1}>QoS 1</option>
                        <option value={2}>QoS 2</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={mqtt.willRetain}
                        className="accent-amber-500"
                        onChange={(event) => updateMqtt((current) => ({ ...current, willRetain: event.target.checked }))}
                      />
                      Will Retain
                    </label>
                  </div>
                  <div className="h-32 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CodeEditor
                      language="json"
                      onSave={onSave}
                      value={mqtt.willMessage}
                      placeholder='{"status": "offline"}'
                      onChange={(willMessage) => updateMqtt((current) => ({ ...current, willMessage }))}
                    />
                  </div>
                </div>
              )}

              {section === 'settings' && (
                <SettingsSection>
                  <SettingRow title="Client ID" description="Identificador único no broker. Vazio gera um ID automático ao conectar.">
                    <input
                      spellCheck={false}
                      value={mqtt.clientId}
                      placeholder="vulpes-auto"
                      onChange={(event) => updateMqtt((current) => ({ ...current, clientId: event.target.value }))}
                      className={`${fieldInputClass} w-52 font-mono`}
                    />
                  </SettingRow>
                  <SettingRow title="Clean Session" description="Inicia uma sessão limpa sem estado anterior armazenado no broker.">
                    <input
                      type="checkbox"
                      checked={mqtt.cleanSession}
                      className="h-4 w-4 accent-amber-500"
                      onChange={(event) => updateMqtt((current) => ({ ...current, cleanSession: event.target.checked }))}
                    />
                  </SettingRow>
                  <SettingRow title="Keep Alive (segundos)" description="Intervalo de ping para manter a conexão ativa com o broker.">
                    <input
                      min={5}
                      max={3600}
                      type="number"
                      value={mqtt.keepAliveSec}
                      onChange={(event) => updateMqtt((current) => ({ ...current, keepAliveSec: Math.max(5, Number(event.target.value) || 60) }))}
                      className={`${fieldInputClass} w-28 font-mono`}
                    />
                  </SettingRow>
                  <TlsSetting
                    skipTlsVerify={mqtt.skipTlsVerify}
                    onChange={(skipTlsVerify) => updateMqtt((current) => ({ ...current, skipTlsVerify }))}
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
            emptyHint="Conecte-se ao broker MQTT para acompanhar as mensagens publicadas e recebidas nos tópicos."
          />
        }
      />
    </div>
  );
};

export default MqttRequestEditor;

