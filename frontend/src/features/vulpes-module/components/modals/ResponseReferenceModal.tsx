import toast from 'react-hot-toast';
import { useVulpesStore } from '../../VulpesStore';
import { findItem } from '../../functions/CollectionTree';
import { requireToken } from '../../actions/ActionHelpers';
import React, { useEffect, useMemo, useState } from 'react';
import { VulpesServices } from '../../services/VulpesServices';
import { Modal } from '../../../shared/components/modals/Modal';
import { collectionActions } from '../../actions/CollectionActions';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import type { SourceRequest } from '../../functions/VariableSuggestions';
import type { Collection, HttpResponse } from '../../../../interfaces/VulpesInterfaces';
import { fieldInputClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';
import { Play, Copy, Check, Link2, Search, Loader2, Sparkles, BookmarkPlus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseResponseTag, buildResponseTag, discoverJsonPaths, ResponseFieldKind, ResponseTriggerKind, responseFieldOptions, decodeResponseBodyText, extractResponsePreview, responseTriggerOptions } from '../../functions/ResponseVariables';

export interface ResponseBuilderOptions {
  defaultRequestId?: string;
  initialExpression?: string;
  onApply?: (expression: string) => void;
}

interface ResponseReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: SourceRequest[];
  currentItemId: string | null;
  collection: Collection | null;
  options: ResponseBuilderOptions | null;
  responsesByItemId: Record<string, HttpResponse>;
}

const guessVariableName = (filter: string, field: ResponseFieldKind): string => {
  if (field === 'url') return 'responseUrl';
  if (field === 'raw') return 'responseBody';
  const cleaned = filter
    .replace(/^\$\.?/, '')
    .split(/[.[\]'"]+/)
    .filter(Boolean)
    .pop();
  if (!cleaned) return 'valorResposta';
  return cleaned.replace(/[^A-Za-z0-9_]/g, '');
};

const ResponseReferenceModal: React.FC<ResponseReferenceModalProps> = ({
  isOpen,
  onClose,
  options,
  requests,
  collection,
  currentItemId,
  responsesByItemId,
}) => {
  const activeEnvironmentId = useVulpesStore((state) => state.activeEnvironmentId);
  const setItemResponse = useVulpesStore((state) => state.setItemResponse);

  const [filter, setFilter] = useState('$.');
  const [searchQuery, setSearchQuery] = useState('');
  const [variableName, setVariableName] = useState('');
  const [maxAgeSeconds, setMaxAgeSeconds] = useState(60);
  const [sendingSource, setSendingSource] = useState(false);
  const [savingVariable, setSavingVariable] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [field, setField] = useState<ResponseFieldKind>('body');
  const [trigger, setTrigger] = useState<ResponseTriggerKind>('never');

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    const initial = options?.initialExpression?.trim() ?? '';
    if (initial) {
      const parsed = parseResponseTag(initial);
      const matched =
        requests.find((candidate) => candidate.id === parsed.requestReference) ??
        requests.find((candidate) => candidate.name === parsed.requestReference) ??
        requests[0];
      setField(parsed.field);
      setTrigger(parsed.trigger);
      setMaxAgeSeconds(parsed.maxAgeSeconds || 60);
      setSelectedRequestId(matched?.id ?? '');
      setFilter(parsed.filter || (parsed.field === 'body' ? '$.' : ''));
      setVariableName(guessVariableName(parsed.filter, parsed.field));
      return;
    }

    const preferred =
      (options?.defaultRequestId && requests.find((candidate) => candidate.id === options.defaultRequestId)) ||
      requests.find((candidate) => candidate.id !== currentItemId && Boolean(responsesByItemId[candidate.id])) ||
      requests.find((candidate) => candidate.id !== currentItemId) ||
      requests[0];

    const initialRequestId = preferred?.id ?? '';
    const initialResponse = initialRequestId ? responsesByItemId[initialRequestId] : undefined;
    const discovered = initialResponse ? discoverJsonPaths(decodeResponseBodyText(initialResponse), 10) : [];
    const initialFilter = discovered[0]?.path ?? '$.';

    setField('body');
    setTrigger('never');
    setMaxAgeSeconds(60);
    setFilter(initialFilter);
    setSelectedRequestId(initialRequestId);
    setVariableName(guessVariableName(initialFilter, 'body'));
  }, [isOpen, options]);

  const selectedRequest = useMemo(
    () => requests.find((candidate) => candidate.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const sourceResponse = selectedRequest ? responsesByItemId[selectedRequest.id] : undefined;

  const discoveredPaths = useMemo(
    () => (sourceResponse ? discoverJsonPaths(decodeResponseBodyText(sourceResponse), 100) : []),
    [sourceResponse]
  );

  const filteredPaths = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return discoveredPaths;
    return discoveredPaths.filter(
      (item) => item.path.toLowerCase().includes(needle) || item.preview.toLowerCase().includes(needle)
    );
  }, [discoveredPaths, searchQuery]);

  const filteredHeaders = useMemo(() => {
    const headers = sourceResponse?.headers ?? [];
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return headers;
    return headers.filter(
      (header) => header.key.toLowerCase().includes(needle) || header.value.toLowerCase().includes(needle)
    );
  }, [sourceResponse, searchQuery]);

  const expression = useMemo(() => {
    if (!selectedRequest) return '';
    return buildResponseTag({
      field,
      filter,
      trigger,
      maxAgeSeconds,
      requestReference: selectedRequest.reference,
    });
  }, [selectedRequest, field, filter, trigger, maxAgeSeconds]);

  const livePreview = useMemo(() => {
    if (!selectedRequest || !expression) return null;
    const parsed = parseResponseTag(expression);
    if (!parsed.valid) return { ok: false, value: parsed.error ?? 'Configuração incompleta' };
    if (!sourceResponse) return null;
    return extractResponsePreview(sourceResponse, parsed);
  }, [selectedRequest, expression, sourceResponse]);

  const executeSourceRequest = async () => {
    if (!collection || !selectedRequest || sendingSource) return;
    const item = findItem(collection.items, selectedRequest.id);
    if (!item?.request) return;
    setSendingSource(true);
    try {
      const response = await VulpesServices.sendHttpRequest(requireToken(), {
        request: item.request,
        scope: {
          itemId: item.id,
          collectionId: collection.id,
          environmentId: activeEnvironmentId ?? 0,
        },
      });
      setItemResponse(collection.id, item.id, response);
      const paths = discoverJsonPaths(decodeResponseBodyText(response), 20);
      if (field === 'body' && (!filter || filter === '$.') && paths.length > 0) {
        setFilter(paths[0].path);
        setVariableName(guessVariableName(paths[0].path, 'body'));
      }
      toast.success(`Resposta de "${selectedRequest.name}" carregada (${response.status})`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSendingSource(false);
    }
  };

  const applyExpression = () => {
    if (!expression) return;
    if (options?.onApply) {
      options.onApply(expression);
      onClose();
      return;
    }
    copyToClipboard(expression, 'Variável {{$response}} copiada');
    onClose();
  };

  const saveAsCollectionVariable = async () => {
    const cleanName = variableName.trim();
    if (!collection || !cleanName || !expression || savingVariable) return;
    setSavingVariable(true);
    try {
      const existingIndex = collection.variables.findIndex((variable) => variable.key === cleanName);
      const nextVariables =
        existingIndex >= 0
          ? collection.variables.map((variable, index) =>
              index === existingIndex ? { ...variable, value: expression, enabled: true } : variable
            )
          : [...collection.variables, { key: cleanName, value: expression, secret: false, enabled: true }];

      await collectionActions.updateCollection(collection, {
        auth: collection.auth,
        variables: nextVariables,
        description: collection.description,
      });
      if (options?.onApply) {
        options.onApply(`{{${cleanName}}}`);
        toast.success(`Variável {{${cleanName}}} salva na coleção e inserida`);
      } else {
        await copyToClipboard(`{{${cleanName}}}`, `Variável {{${cleanName}}} salva na coleção e copiada`);
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingVariable(false);
    }
  };

  return (
    <Modal
      size="lg"
      isOpen={isOpen}
      onClose={onClose}
      icon={<Link2 className="w-4 h-4 text-violet-500" />}
      title="Usar resposta de uma requisição em outra"
      description={
        collection
          ? `Coleção "${collection.name}" · encadeia valores extraídos automaticamente`
          : 'Salve a requisição em uma coleção para encadear respostas'
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancelar
          </button>
          {expression && (
            <button
              type="button"
              onClick={() => copyToClipboard(expression, 'Expressão {{$response}} copiada')}
              className={secondaryButtonClass}
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar {'{{$response}}'}
            </button>
          )}
          <button
            type="button"
            onClick={applyExpression}
            disabled={!expression || Boolean(livePreview && !livePreview.ok && sourceResponse)}
            className={primaryButtonClass}
          >
            <Check className="w-3.5 h-3.5" />
            {options?.onApply ? 'Inserir na requisição' : 'Copiar e fechar'}
          </button>
        </>
      }
    >
      {!collection || requests.length === 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Nenhuma requisição HTTP disponível nesta coleção
          </p>
          <p>
            Para usar a resposta de uma requisição em outra, salve suas requisições HTTP dentro de uma coleção (ex: uma requisição{' '}
            <strong>Login</strong> e outra que consome o token).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className={fieldLabelClass}>1. Requisição de origem</label>
              <select
                value={selectedRequestId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedRequestId(nextId);
                  const nextResponse = responsesByItemId[nextId];
                  const nextPaths = nextResponse ? discoverJsonPaths(decodeResponseBodyText(nextResponse), 5) : [];
                  if (field === 'body' && nextPaths.length > 0) {
                    setFilter(nextPaths[0].path);
                    setVariableName(guessVariableName(nextPaths[0].path, 'body'));
                  }
                }}
                className={fieldInputClass}
              >
                {requests.map((request) => {
                  const hasResp = Boolean(responsesByItemId[request.id]);
                  const isSelf = request.id === currentItemId;
                  return (
                    <option key={request.id} value={request.id}>
                      {request.name}
                      {isSelf ? ' (aba atual)' : ''}
                      {hasResp ? ' · ✓ resposta carregada' : ' · sem resposta recente'}
                    </option>
                  );
                })}
              </select>
            </div>
            <button
              type="button"
              disabled={!selectedRequest || sendingSource}
              onClick={executeSourceRequest}
              title="Envia a requisição selecionada agora para listar os campos da resposta"
              className={`${secondaryButtonClass} h-[34px]`}
            >
              {sendingSource ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : <Play className="w-3.5 h-3.5 text-amber-500" />}
              {sourceResponse ? 'Atualizar resposta' : 'Executar para ler campos'}
            </button>
          </div>

          <div>
            <label className={fieldLabelClass}>2. O que extrair da resposta</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {responseFieldOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    setField(option.value);
                    if (option.value === 'body' && !filter.startsWith('$')) {
                      const defaultPath = discoveredPaths[0]?.path ?? '$.';
                      setFilter(defaultPath);
                      setVariableName(guessVariableName(defaultPath, 'body'));
                    } else if (option.value === 'header') {
                      const defaultHeader = sourceResponse?.headers[0]?.key ?? 'Authorization';
                      setFilter(defaultHeader);
                      setVariableName(guessVariableName(defaultHeader, 'header'));
                    } else {
                      setVariableName(guessVariableName(filter, option.value));
                    }
                  }}
                  className={`rounded-xl border px-3 py-2 text-left transition-all ${
                    field === option.value
                      ? 'border-violet-500 bg-violet-500/10 text-violet-800 dark:text-violet-200 ring-1 ring-violet-500/30'
                      : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="block text-xs font-bold">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(field === 'body' || field === 'header') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className={`${fieldLabelClass} mb-0`}>
                  {field === 'body' ? '3. Campo JSONPath (clique abaixo ou digite)' : '3. Nome do Header (clique abaixo ou digite)'}
                </label>
                {sourceResponse && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {field === 'body' ? `${discoveredPaths.length} campos detectados` : `${sourceResponse.headers.length} headers detectados`}
                  </span>
                )}
              </div>
              <input
                value={filter}
                spellCheck={false}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setVariableName(guessVariableName(event.target.value, field));
                }}
                placeholder={field === 'body' ? 'Ex: $.data.token ou $.access_token' : 'Ex: Authorization ou X-Session'}
                className={`${fieldInputClass} font-mono`}
              />

              {sourceResponse && ((field === 'body' && discoveredPaths.length > 0) || (field === 'header' && sourceResponse.headers.length > 0)) ? (
                <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden bg-gray-50/50 dark:bg-zinc-950/60">
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-white/10">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={field === 'body' ? 'Filtrar campos da resposta (ex: token, id)...' : 'Filtrar headers...'}
                      className="w-full bg-transparent text-xs text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-auto divide-y divide-gray-100 dark:divide-white/5">
                    {field === 'body' &&
                      filteredPaths.map((item) => {
                        const selected = filter === item.path;
                        return (
                          <button
                            type="button"
                            key={item.path}
                            onClick={() => {
                              setFilter(item.path);
                              setVariableName(guessVariableName(item.path, 'body'));
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left text-xs font-mono transition-colors ${
                              selected
                                ? 'bg-violet-500/15 text-violet-800 dark:text-violet-200 font-bold'
                                : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-300'
                            }`}
                          >
                            <span className="truncate">{item.path}</span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate max-w-[55%]">{item.preview}</span>
                          </button>
                        );
                      })}
                    {field === 'header' &&
                      filteredHeaders.map((header, index) => {
                        const selected = filter.toLowerCase() === header.key.toLowerCase();
                        return (
                          <button
                            type="button"
                            key={`${header.key}-${index}`}
                            onClick={() => {
                              setFilter(header.key);
                              setVariableName(guessVariableName(header.key, 'header'));
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left text-xs font-mono transition-colors ${
                              selected
                                ? 'bg-violet-500/15 text-violet-800 dark:text-violet-200 font-bold'
                                : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-300'
                            }`}
                          >
                            <span className="truncate">{header.key}</span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate max-w-[55%]">{header.value}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : (
                !sourceResponse && (
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    Clique em <strong>Executar para ler campos</strong> acima para escolher o campo direto da resposta real de "{selectedRequest?.name}".
                  </p>
                )
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div>
              <label className={fieldLabelClass}>4. Quando reenviar "{selectedRequest?.name}"</label>
              <select
                value={trigger}
                onChange={(event) => setTrigger(event.target.value as ResponseTriggerKind)}
                className={fieldInputClass}
              >
                {responseTriggerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabelClass}>Validade (seg)</label>
              <input
                min={0}
                type="number"
                value={maxAgeSeconds}
                disabled={trigger !== 'when-expired'}
                onChange={(event) => setMaxAgeSeconds(Math.max(0, Number(event.target.value) || 0))}
                className={`${fieldInputClass} font-mono disabled:opacity-50`}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-950 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                Variável gerada
              </span>
              {livePreview && (
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    livePreview.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {livePreview.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {livePreview.ok ? 'Extração validada' : livePreview.value}
                </span>
              )}
            </div>
            <code className="block text-xs font-mono text-violet-700 dark:text-violet-300 break-all bg-violet-500/10 rounded-lg px-2.5 py-1.5">
              {expression}
            </code>
            {livePreview?.ok && (
              <div className="text-xs flex items-baseline gap-2 pt-1">
                <span className="text-gray-500 dark:text-zinc-400 flex-shrink-0">Valor atual extraído:</span>
                <code className="font-mono text-emerald-700 dark:text-emerald-300 break-all line-clamp-2">
                  {livePreview.value || '(vazio)'}
                </code>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                Opcional: Salvar como variável curta na coleção (para usar como {'{{nome}}'})
              </label>
              <input
                value={variableName}
                spellCheck={false}
                placeholder="Ex: token, userId..."
                onChange={(event) => setVariableName(event.target.value)}
                className={`${fieldInputClass} font-mono bg-white dark:bg-zinc-900`}
              />
            </div>
            <button
              type="button"
              onClick={saveAsCollectionVariable}
              disabled={!variableName.trim() || !expression || savingVariable}
              className={`${secondaryButtonClass} h-[34px] border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10`}
            >
              {savingVariable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
              Salvar {'{{'}
              {variableName.trim() || 'variavel'}
              {'}}'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ResponseReferenceModal;

