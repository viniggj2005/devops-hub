import { isDynamicVariable, type VariableMap } from './Variables';
import { formatMessage } from '../../i18n/Languages';
import { currentDictionary } from '../../i18n/TranslateError';
import type { CollectionItem, HttpResponse } from '../../../interfaces/VulpesInterfaces';
import { parseResponseTag, buildResponseTag, discoverJsonPaths, decodeResponseBodyText, extractResponsePreview } from './ResponseVariables';

export type SuggestionKind = 'collection' | 'environment' | 'dynamic' | 'response';

export type VariableStatus = 'defined' | 'dynamic' | 'response' | 'missing';

export interface VariableQuery {
  to: number;
  from: number;
  query: string;
}

export interface SourceRequest {
  id: string;
  name: string;
  reference: string;
}

export interface VariableSuggestion {
  name: string;
  label: string;
  detail: string;
  cursorBack: number;
  kind: SuggestionKind;
}

export interface VariableDescription {
  name: string;
  value: string;
  source: SuggestionKind | '';
  preview?: string;
  requestId?: string;
  status: VariableStatus;
}

export interface SuggestionInsertion {
  to: number;
  from: number;
  insert: string;
  cursor: number;
}

const maxSuggestions = 60;
const hiddenValue = '••••••';
const maxPathsPerRequest = 18;
const maxHeadersPerRequest = 6;
const responseVariable = '$response';

const dynamicVariableDescriptions = (): Record<string, string> => currentDictionary().vulpes.dynamicVariables;

export const suggestionKindLabel = (kind: SuggestionKind | '') => (kind ? currentDictionary().vulpes.variables.kinds[kind] : '');

export const variableStatusLabel = (description: VariableDescription) => {
  const variableTexts = currentDictionary().vulpes.variables;
  if (description.status === 'defined') return formatMessage(variableTexts.defined, { source: suggestionKindLabel(description.source) });
  if (description.status === 'response') return variableTexts.linkedResponse;
  if (description.status === 'dynamic') return variableTexts.dynamic;
  return variableTexts.unknown;
};

export const isResponseVariable = (name: string) => name === responseVariable || /^\$response\s/.test(name);

const collectRequests = (items: CollectionItem[], collected: CollectionItem[] = []) => {
  items.forEach((item) => {
    if (item.kind === 'request' && item.request?.protocol === 'http') collected.push(item);
    collectRequests(item.children, collected);
  });
  return collected;
};

export const sourceRequestsOf = (items: CollectionItem[] | undefined): SourceRequest[] => {
  const requests = collectRequests(items ?? []);
  const nameCounts = new Map<string, number>();
  requests.forEach((request) => nameCounts.set(request.name, (nameCounts.get(request.name) ?? 0) + 1));
  return requests.map((request) => {
    const usableName = nameCounts.get(request.name) === 1 && !/['"\\{}]/.test(request.name);
    return { id: request.id, name: request.name, reference: usableName ? request.name : request.id };
  });
};

export const findVariableQuery = (text: string, cursor: number, explicit: boolean): VariableQuery | null => {
  const before = text.slice(0, cursor);
  const open = before.lastIndexOf('{{');
  const typed = open >= 0 ? before.slice(open + 2) : null;
  if (typed !== null && !/[{}"\r\n]/.test(typed)) {
    const after = text.slice(cursor);
    const close = after.indexOf('}}');
    const closesHere = close >= 0 && !/[{}"\r\n]/.test(after.slice(0, close));
    if (closesHere) {
      return { from: open, to: cursor + close + 2, query: typed.trim() };
    }
    const singleClose = after.indexOf('}');
    const hasSingleClose = singleClose >= 0 && !/[{}"\r\n]/.test(after.slice(0, singleClose));
    return {
      from: open,
      to: hasSingleClose ? cursor + singleClose + 1 : cursor,
      query: typed.trim(),
    };
  }
  if (!explicit) return null;

  const partialMatch = before.match(/(\{?[$A-Za-z0-9_.-]*)$/);
  if (partialMatch && partialMatch[1].length > 0) {
    const token = partialMatch[1];
    const hasLeadingBrace = token.startsWith('{');
    const word = hasLeadingBrace ? token.slice(1) : token;
    const after = text.slice(cursor);
    const consumeTrailingBrace = hasLeadingBrace && after.startsWith('}') ? 1 : 0;
    return {
      from: cursor - token.length,
      to: cursor + consumeTrailingBrace,
      query: word,
    };
  }

  return { from: cursor, to: cursor, query: '' };
};

export const buildSuggestions = (
  variables: VariableMap,
  requests: SourceRequest[],
  responsesByItemId: Record<string, HttpResponse> = {}
): VariableSuggestion[] => {
  const variableTexts = currentDictionary().vulpes.variables;
  const defined: VariableSuggestion[] = [...variables.entries()].map(([name, variable]) => ({
    name,
    label: name,
    cursorBack: 0,
    kind: variable.source,
    detail: variable.secret ? hiddenValue : variable.value || variableTexts.empty,
  }));

  const responses: VariableSuggestion[] = [];
  requests.forEach((request) => {
    const response = responsesByItemId[request.id];
    if (response) {
      const discoveredPaths = discoverJsonPaths(decodeResponseBodyText(response), maxPathsPerRequest);
      discoveredPaths.forEach((pathItem) => {
        responses.push({
          cursorBack: 0,
          kind: 'response',
          label: `${request.name} → ${pathItem.path}`,
          detail: formatMessage(variableTexts.currentValue, { value: pathItem.preview }),
          name: buildResponseTag({ field: 'body', requestReference: request.reference, filter: pathItem.path, trigger: 'never' }, false),
        });
      });
      response.headers.slice(0, maxHeadersPerRequest).forEach((header) => {
        responses.push({
          cursorBack: 0,
          kind: 'response',
          label: formatMessage(variableTexts.headerLabel, { request: request.name, key: header.key }),
          detail: formatMessage(variableTexts.header, { value: header.value }),
          name: buildResponseTag({ field: 'header', requestReference: request.reference, filter: header.key, trigger: 'never' }, false),
        });
      });
    }
    responses.push({
      cursorBack: 1,
      kind: 'response',
      label: `${responseVariable} → ${request.name} (JSONPath)`,
      name: `${responseVariable} 'body', '${request.reference}', '$.'`,
      detail: response
        ? formatMessage(variableTexts.extractAnother, { name: request.name })
        : formatMessage(variableTexts.bodyValue, { name: request.name }),
    });
  });

  const dynamic: VariableSuggestion[] = Object.entries(dynamicVariableDescriptions()).map(([name, description]) => ({
    name,
    label: name,
    cursorBack: 0,
    kind: 'dynamic',
    detail: description,
  }));

  return [...defined, ...responses, ...dynamic];
};

export const filterSuggestions = (suggestions: VariableSuggestion[], query: string) => {
  const needle = query.toLowerCase();
  if (!needle) return suggestions.slice(0, maxSuggestions);
  const rank = (suggestion: VariableSuggestion) => {
    const label = suggestion.label.toLowerCase();
    const name = suggestion.name.toLowerCase();
    const detail = suggestion.detail.toLowerCase();
    if (name.startsWith(needle) || label.startsWith(needle)) return 0;
    if (name.includes(needle) || label.includes(needle)) return 1;
    if (detail.includes(needle)) return 2;
    return 3;
  };
  return suggestions
    .map((suggestion) => ({ suggestion, score: rank(suggestion) }))
    .filter((ranked) => ranked.score < 3)
    .sort((left, right) => left.score - right.score)
    .slice(0, maxSuggestions)
    .map((ranked) => ranked.suggestion);
};

export const suggestionInsertion = (query: VariableQuery, suggestion: VariableSuggestion): SuggestionInsertion => {
  const insert = `{{${suggestion.name}}}`;
  const cursor = suggestion.cursorBack > 0 ? query.from + 2 + suggestion.name.length - suggestion.cursorBack : query.from + insert.length;
  return { from: query.from, to: query.to, insert, cursor };
};

const describeResponse = (
  name: string,
  requests: SourceRequest[],
  responsesByItemId: Record<string, HttpResponse>
): VariableDescription => {
  const variableTexts = currentDictionary().vulpes.variables;
  const parsed = parseResponseTag(name);
  if (!parsed.valid) {
    return {
      name,
      status: 'missing',
      source: 'response',
      value: parsed.error ?? variableTexts.invalidReference,
    };
  }

  const request =
    requests.find((candidate) => candidate.id === parsed.requestReference) ??
    requests.find((candidate) => candidate.name === parsed.requestReference);

  if (!request) {
    return {
      name,
      status: 'missing',
      source: 'response',
      value: parsed.requestReference
        ? formatMessage(variableTexts.requestNotFound, { name: parsed.requestReference })
        : currentDictionary().vulpes.responseErrors.requestRequired,
    };
  }

  if (parsed.field === 'body' && parsed.filter.trim() === '$.') {
    return {
      name,
      status: 'missing',
      source: 'response',
      requestId: request.id,
      value: formatMessage(variableTexts.completeJsonPath, { name: request.name }),
    };
  }

  const readableFilter = parsed.filter || variableTexts.wholeContent;
  const summary = formatMessage(variableTexts.summary, { field: parsed.field, name: request.name, filter: readableFilter });
  const response = responsesByItemId[request.id];

  if (response) {
    const extracted = extractResponsePreview(response, parsed);
    if (!extracted.ok) {
      return {
        name,
        status: 'missing',
        source: 'response',
        requestId: request.id,
        value: formatMessage(variableTexts.extractionIn, { value: extracted.value, name: request.name }),
      };
    }
    return {
      name,
      value: summary,
      status: 'response',
      source: 'response',
      requestId: request.id,
      preview: extracted.value,
    };
  }

  return {
    name,
    value: formatMessage(variableTexts.extractedOnSend, { summary }),
    status: 'response',
    source: 'response',
    requestId: request.id,
  };
};

export const describeVariable = (
  name: string,
  variables: VariableMap,
  requests: SourceRequest[],
  masked = false,
  responsesByItemId: Record<string, HttpResponse> = {}
): VariableDescription => {
  const variable = variables.get(name);
  if (variable) {
    const rawValue = variable.value.trim();
    const innerResponse =
      rawValue.startsWith('{{') && rawValue.endsWith('}}') ? rawValue.slice(2, -2).trim() : null;
    if (innerResponse && isResponseVariable(innerResponse) && !variable.secret && !masked) {
      const responseDesc = describeResponse(innerResponse, requests, responsesByItemId);
      return {
        name,
        source: variable.source,
        status: responseDesc.status === 'missing' ? 'missing' : 'defined',
        value: `${responseDesc.value}`,
        preview: responseDesc.preview,
        requestId: responseDesc.requestId,
      };
    }
    const value = variable.secret || masked ? hiddenValue : variable.value || currentDictionary().vulpes.variables.empty;
    return { name, status: 'defined', source: variable.source, value };
  }
  if (isResponseVariable(name)) return describeResponse(name, requests, responsesByItemId);
  const variableTexts = currentDictionary().vulpes.variables;
  const description = dynamicVariableDescriptions()[name];
  if (description) return { name, status: 'dynamic', source: 'dynamic', value: formatMessage(variableTexts.generatedOnSend, { description }) };
  if (isDynamicVariable(name)) return { name, status: 'missing', source: 'dynamic', value: variableTexts.unknownDynamic };
  return { name, status: 'missing', source: '', value: variableTexts.notDefined };
};
