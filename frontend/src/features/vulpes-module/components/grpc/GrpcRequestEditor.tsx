import toast from 'react-hot-toast';
import SplitPane from '../editors/SplitPane';
import CodeEditor from '../editors/CodeEditor';
import AuthEditor from '../editors/AuthEditor';
import React, { useMemo, useState } from 'react';
import SectionTabs from '../editors/SectionTabs';
import { useVulpesStore } from '../../VulpesStore';
import KeyValueTable from '../editors/KeyValueTable';
import VariableInput from '../editors/VariableInput';
import GrpcResponseViewer from './GrpcResponseViewer';
import { prettyJson } from '../../functions/Formatters';
import { requireToken } from '../../actions/ActionHelpers';
import { requestActions } from '../../actions/RequestActions';
import { VulpesServices } from '../../services/VulpesServices';
import RealtimeMessageLog from '../realtime/RealtimeMessageLog';
import GrpcMethodPicker, { streamingLabel } from './GrpcMethodPicker';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import type { ProtocolEditorProps } from '../request/ProtocolEditorProps';
import { isConnectionActive, ConnectionBadge } from '../realtime/ConnectionControls';
import { SettingsSection, TimeoutSetting, TlsSetting } from '../editors/ConnectionSettings';
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';
import { FilePlus2, FolderPlus, Lock, LockOpen, Play, Send, Sparkles, Square, X } from 'lucide-react';
import type { DescriptorSource, GrpcMethod, GrpcRequest } from '../../../../interfaces/VulpesInterfaces';

type GrpcSection = 'message' | 'metadata' | 'auth' | 'definition' | 'settings';

const isBlankMessage = (message: string) => !message.trim() || message.trim() === '{}';

const uniquePaths = (paths: string[]) => Array.from(new Set(paths));

interface PathListProps {
  title: string;
  paths: string[];
  addLabel: string;
  emptyLabel: string;
  onAdd: () => void;
  icon: React.ReactNode;
  onRemove: (path: string) => void;
}

const PathList: React.FC<PathListProps> = ({ title, paths, emptyLabel, addLabel, icon, onAdd, onRemove }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <h4 className={fieldLabelClass}>{title}</h4>
      <button type="button" onClick={onAdd} className={secondaryButtonClass}>
        {icon}
        {addLabel}
      </button>
    </div>
    <div className="rounded-lg border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
      {paths.length === 0 && <p className="px-3 py-2 text-xs text-gray-500 dark:text-zinc-400">{emptyLabel}</p>}
      {paths.map((path) => (
        <div key={path} className="flex items-center gap-2 px-3 py-1.5 group">
          <span className="flex-1 min-w-0 truncate text-xs font-mono text-gray-700 dark:text-zinc-300" title={path}>
            {path}
          </span>
          <button
            type="button"
            title="Remover"
            onClick={() => onRemove(path)}
            className="p-1 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:text-rose-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  </div>
);

const GrpcRequestEditor: React.FC<ProtocolEditorProps> = ({ tab, runtime, variables, inheritedHint, onSave }) => {
  const grpc = tab.request.grpc as GrpcRequest;
  const [section, setSection] = useState<GrpcSection>('message');
  const patchRuntime = useVulpesStore((state) => state.patchRuntime);
  const updateRequest = useVulpesStore((state) => state.updateRequest);
  const clearRealtimeEvents = useVulpesStore((state) => state.clearRealtimeEvents);

  const selectedMethod = useMemo(
    () => runtime.grpcServices?.flatMap((service) => service.methods).find((method) => method.fullName === grpc.method) ?? null,
    [runtime.grpcServices, grpc.method]
  );
  const streamActive = isConnectionActive(runtime.connection);
  const isStreaming = Boolean(selectedMethod && (selectedMethod.clientStreaming || selectedMethod.serverStreaming));
  const canSendStreamMessage = streamActive && Boolean(selectedMethod?.clientStreaming);

  const updateGrpc = (update: (current: GrpcRequest) => GrpcRequest) =>
    updateRequest(tab.id, (request) => ({ ...request, grpc: update(request.grpc as GrpcRequest) }));

  const updateDefinition = (update: (current: GrpcRequest) => GrpcRequest) => {
    updateGrpc(update);
    patchRuntime(tab.id, { grpcServices: null });
  };

  const run = () => requestActions.runGrpc(tab.id);

  const selectMethod = (method: GrpcMethod) =>
    updateGrpc((current) => ({
      ...current,
      method: method.fullName,
      message: isBlankMessage(current.message) ? method.exampleMessage : current.message,
    }));

  const formatMessage = () => {
    const formatted = prettyJson(grpc.message);
    if (formatted === null) toast.error('A mensagem não é um JSON válido');
    else updateGrpc((current) => ({ ...current, message: formatted }));
  };

  const choosePaths = async (choose: () => Promise<string[]>, apply: (paths: string[]) => void) => {
    try {
      const paths = await choose();
      if (paths.length) apply(paths);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const runLabel = selectedMethod?.clientStreaming || selectedMethod?.serverStreaming ? 'Iniciar stream' : 'Invocar';

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-stretch gap-2 px-4 py-3 flex-shrink-0">
        <button
          type="button"
          onClick={() => updateGrpc((current) => ({ ...current, useTls: !current.useTls }))}
          title={grpc.useTls ? 'TLS ativado (grpcs)' : 'Sem TLS (texto puro)'}
          className={`px-3 rounded-xl border transition-colors ${
            grpc.useTls
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200'
          }`}
        >
          {grpc.useTls ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0 flex items-stretch rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20">
          <VariableInput
            value={grpc.url}
            onEnter={run}
            className="flex-1"
            variables={variables}
            placeholder="localhost:50051 ou grpcs://api.exemplo.com"
            onChange={(url) => updateDefinition((current) => ({ ...current, url }))}
          />
        </div>
        <GrpcMethodPicker
          selected={grpc.method}
          onSelect={selectMethod}
          loading={runtime.running}
          services={runtime.grpcServices}
          onReload={() => requestActions.loadGrpcServices(tab.id)}
        />
        {streamActive ? (
          <button type="button" onClick={() => requestActions.disconnect(tab.id)} className={secondaryButtonClass}>
            <Square className="w-3.5 h-3.5" />
            Encerrar stream
          </button>
        ) : runtime.running ? (
          <button type="button" onClick={() => requestActions.cancel(tab.id)} className={secondaryButtonClass}>
            <X className="w-3.5 h-3.5" />
            Cancelar
          </button>
        ) : (
          <button type="button" onClick={run} className={`${primaryButtonClass} px-5`}>
            <Play className="w-3.5 h-3.5" />
            {runLabel}
          </button>
        )}
      </div>

      <SplitPane
        defaultRatio={0.5}
        storageKey="vulpes-grpc-split"
        top={
          <>
            <SectionTabs
              active={section}
              onChange={setSection}
              tabs={[
                { key: 'message', label: 'Mensagem' },
                { key: 'metadata', label: 'Metadata', count: grpc.metadata.filter((entry) => entry.enabled && entry.key).length },
                { key: 'auth', label: 'Autorização' },
                { key: 'definition', label: grpc.descriptorSource === 'proto' ? 'Definição (.proto)' : 'Definição (reflection)' },
                { key: 'settings', label: 'Configurações' },
              ]}
              trailing={selectedMethod && (
                <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-mono truncate max-w-xs" title={`${selectedMethod.inputType} → ${selectedMethod.outputType}`}>
                  {selectedMethod.inputType.split('.').pop()} → {selectedMethod.outputType.split('.').pop()} · {streamingLabel(selectedMethod)}
                </span>
              )}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {section === 'message' && (
                <div className="h-full flex flex-col gap-2 min-h-0">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={formatMessage} className={secondaryButtonClass}>
                      <Sparkles className="w-3.5 h-3.5" />
                      Formatar
                    </button>
                    <button
                      type="button"
                      disabled={!selectedMethod}
                      title={selectedMethod ? 'Preencher com todos os campos do tipo de entrada' : 'Carregue os métodos para gerar um exemplo'}
                      onClick={() => selectedMethod && updateGrpc((current) => ({ ...current, message: selectedMethod.exampleMessage }))}
                      className={secondaryButtonClass}
                    >
                      Gerar exemplo
                    </button>
                    {canSendStreamMessage && (
                      <div className="ml-auto flex items-center gap-2">
                        <button type="button" onClick={() => requestActions.endGrpcStream(tab.id)} className={secondaryButtonClass}>
                          Finalizar envio
                        </button>
                        <button type="button" onClick={() => requestActions.sendGrpcMessage(tab.id, grpc.message)} className={primaryButtonClass}>
                          <Send className="w-3.5 h-3.5" />
                          Enviar mensagem
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-h-[140px] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CodeEditor
                      language="json"
                      onSave={onSave}
                      value={grpc.message}
                      placeholder="{ }"
                      onRun={canSendStreamMessage ? () => requestActions.sendGrpcMessage(tab.id, grpc.message) : run}
                      onChange={(message) => updateGrpc((current) => ({ ...current, message }))}
                    />
                  </div>
                </div>
              )}
              {section === 'metadata' && (
                <KeyValueTable
                  rows={grpc.metadata}
                  keyPlaceholder="Chave"
                  onChange={(metadata) => updateGrpc((current) => ({ ...current, metadata }))}
                />
              )}
              {section === 'auth' && (
                <AuthEditor
                  auth={tab.request.auth}
                  inheritedHint={inheritedHint}
                  onChange={(auth) => updateRequest(tab.id, (request) => ({ ...request, auth }))}
                />
              )}
              {section === 'definition' && (
                <div className="max-w-3xl space-y-5">
                  <div className="flex flex-wrap gap-3">
                    {(
                      [
                        ['reflection', 'Reflection do servidor', 'Descobre serviços e mensagens automaticamente.'],
                        ['proto', 'Arquivos .proto', 'Usa os contratos locais quando o reflection está desativado.'],
                      ] as [DescriptorSource, string, string][]
                    ).map(([source, title, description]) => (
                      <label
                        key={source}
                        className={`flex-1 min-w-[220px] flex items-start gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${
                          grpc.descriptorSource === source ? 'border-amber-500 bg-amber-500/5' : 'border-gray-200 dark:border-white/10'
                        }`}
                      >
                        <input
                          type="radio"
                          className="mt-0.5 accent-amber-500"
                          checked={grpc.descriptorSource === source}
                          onChange={() => updateDefinition((current) => ({ ...current, descriptorSource: source }))}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-800 dark:text-zinc-100">{title}</span>
                          <span className="block text-xs text-gray-500 dark:text-zinc-400">{description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {grpc.descriptorSource === 'proto' && (
                    <>
                      <PathList
                        title="Arquivos .proto"
                        paths={grpc.protoFiles}
                        addLabel="Adicionar arquivos"
                        emptyLabel="Nenhum arquivo selecionado."
                        icon={<FilePlus2 className="w-3.5 h-3.5" />}
                        onRemove={(path) => updateDefinition((current) => ({ ...current, protoFiles: current.protoFiles.filter((file) => file !== path) }))}
                        onAdd={() =>
                          choosePaths(
                            () => VulpesServices.chooseProtoFiles(requireToken()),
                            (paths) => updateDefinition((current) => ({ ...current, protoFiles: uniquePaths([...current.protoFiles, ...paths]) }))
                          )
                        }
                      />
                      <PathList
                        title="Diretórios de import"
                        paths={grpc.importPaths}
                        addLabel="Adicionar diretório"
                        emptyLabel="A pasta de cada arquivo já é usada como raiz de import."
                        icon={<FolderPlus className="w-3.5 h-3.5" />}
                        onRemove={(path) => updateDefinition((current) => ({ ...current, importPaths: current.importPaths.filter((entry) => entry !== path) }))}
                        onAdd={() =>
                          choosePaths(
                            async () => {
                              const path = await VulpesServices.chooseImportPath(requireToken());
                              return path ? [path] : [];
                            },
                            (paths) => updateDefinition((current) => ({ ...current, importPaths: uniquePaths([...current.importPaths, ...paths]) }))
                          )
                        }
                      />
                    </>
                  )}
                </div>
              )}
              {section === 'settings' && (
                <SettingsSection>
                  <TlsSetting
                    skipTlsVerify={grpc.skipTlsVerify}
                    onChange={(skipTlsVerify) => updateGrpc((current) => ({ ...current, skipTlsVerify }))}
                  />
                  <TimeoutSetting timeoutMs={grpc.timeoutMs} onChange={(timeoutMs) => updateGrpc((current) => ({ ...current, timeoutMs }))} />
                </SettingsSection>
              )}
            </div>
          </>
        }
        bottom={
          isStreaming || streamActive ? (
            <>
              <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
                <ConnectionBadge status={runtime.connection} />
                {runtime.error && <span className="text-[11px] text-rose-600 dark:text-rose-400 truncate">{runtime.error}</span>}
              </div>
              <RealtimeMessageLog
                events={runtime.events}
                onClear={() => clearRealtimeEvents(tab.id)}
                emptyHint="Inicie o stream para acompanhar as mensagens enviadas e recebidas."
              />
            </>
          ) : (
            <GrpcResponseViewer runtime={runtime} onCancel={() => requestActions.cancel(tab.id)} />
          )
        }
      />
    </div>
  );
};

export default GrpcRequestEditor;
