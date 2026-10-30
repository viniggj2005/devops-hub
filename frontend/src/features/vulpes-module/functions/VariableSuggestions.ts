import { isDynamicVariable, type VariableMap } from './Variables';
import type { CollectionItem, HttpResponse } from '../../../interfaces/VulpesInterfaces';
import { parseResponseTag, buildResponseTag, discoverJsonPaths, decodeResponseBodyText, extractResponsePreview } from './ResponseVariables';

export type SuggestionKind = 'coleção' | 'ambiente' | 'dinâmica' | 'resposta';

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
  source: string;
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
const responseVariable = '$response';
const maxPathsPerRequest = 18;
const maxHeadersPerRequest = 6;

export const dynamicVariableDescriptions: Record<string, string> = {
  $guid: 'UUID v4 aleatório',
  $randomUUID: 'UUID v4 aleatório',
  $timestamp: 'Data atual em segundos (Unix)',
  $isoTimestamp: 'Data atual em ISO 8601',
  $randomInt: 'Número inteiro entre 0 e 1000',
  $randomBoolean: 'true ou false',
  $randomAlphaNumeric: 'Um caractere alfanumérico',
  $randomFirstName: 'Primeiro nome',
  $randomLastName: 'Sobrenome',
  $randomFullName: 'Nome completo',
  $randomNamePrefix: 'Pronome de tratamento (Mr., Dr.)',
  $randomNameSuffix: 'Sufixo de nome (Jr., PhD)',
  $randomUserName: 'Nome de usuário',
  $randomEmail: 'E-mail',
  $randomExampleEmail: 'E-mail em domínio example',
  $randomPassword: 'Senha alfanumérica de 15 caracteres',
  $randomPhoneNumber: 'Telefone',
  $randomPhoneNumberExt: 'Telefone com DDI',
  $randomCity: 'Cidade',
  $randomStreetName: 'Nome de rua',
  $randomStreetAddress: 'Endereço com número',
  $randomCountry: 'País',
  $randomCountryCode: 'Código de país (BR, US)',
  $randomLatitude: 'Latitude',
  $randomLongitude: 'Longitude',
  $randomIP: 'Endereço IPv4',
  $randomIPV6: 'Endereço IPv6',
  $randomMACAddress: 'Endereço MAC',
  $randomUrl: 'URL',
  $randomDomainName: 'Domínio',
  $randomDomainSuffix: 'Sufixo de domínio (com, io)',
  $randomDomainWord: 'Palavra de domínio',
  $randomProtocol: 'http ou https',
  $randomUserAgent: 'User-Agent de navegador',
  $randomSemver: 'Versão semântica (1.2.3)',
  $randomLocale: 'Locale (pt_BR, en_US)',
  $randomColor: 'Nome de cor',
  $randomHexColor: 'Cor hexadecimal',
  $randomAbbreviation: 'Sigla técnica (API, SQL)',
  $randomCompanyName: 'Nome de empresa',
  $randomCompanySuffix: 'Sufixo de empresa (Ltda, Inc)',
  $randomCatchPhrase: 'Frase de efeito',
  $randomBs: 'Frase curta',
  $randomJobTitle: 'Cargo',
  $randomJobArea: 'Área de atuação',
  $randomJobType: 'Tipo de cargo',
  $randomJobDescriptor: 'Adjetivo de cargo',
  $randomDepartment: 'Departamento',
  $randomProduct: 'Produto',
  $randomProductName: 'Nome de produto',
  $randomProductAdjective: 'Adjetivo de produto',
  $randomProductMaterial: 'Material de produto',
  $randomPrice: 'Preço (123.45)',
  $randomCurrencyCode: 'Código de moeda (BRL, USD)',
  $randomCurrencySymbol: 'Símbolo de moeda',
  $randomBankAccount: 'Conta bancária de 8 dígitos',
  $randomCreditCardMask: 'Final de cartão (4 dígitos)',
  $randomBitcoin: 'Endereço Bitcoin',
  $randomDatePast: 'Data no último ano',
  $randomDateFuture: 'Data no próximo ano',
  $randomDateRecent: 'Data nos últimos 2 dias',
  $randomWeekday: 'Dia da semana',
  $randomMonth: 'Mês',
  $randomFileName: 'Nome de arquivo',
  $randomFileExt: 'Extensão de arquivo',
  $randomFileType: 'Tipo de arquivo',
  $randomMimeType: 'MIME type',
  $randomDatabaseType: 'Tipo de coluna SQL',
  $randomDatabaseColumn: 'Nome de coluna',
  $randomAvatarImage: 'URL de avatar',
  $randomImageUrl: 'URL de imagem',
  $randomWord: 'Palavra',
  $randomWords: 'Algumas palavras',
  $randomLoremWord: 'Palavra lorem ipsum',
  $randomLoremWords: 'Palavras lorem ipsum',
  $randomLoremSlug: 'Slug lorem-ipsum',
  $randomLoremSentence: 'Frase lorem ipsum',
  $randomLoremSentences: 'Frases lorem ipsum',
  $randomLoremParagraph: 'Parágrafo lorem ipsum',
  $randomLoremText: 'Texto lorem ipsum',
  $randomLoremLines: 'Linhas lorem ipsum',
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
  if (typed !== null && !/[{}]/.test(typed)) {
    const after = text.slice(cursor);
    const close = after.indexOf('}}');
    const closesHere = close >= 0 && !/[{}]/.test(after.slice(0, close));
    return { from: open, to: closesHere ? cursor + close + 2 : cursor, query: typed.trim() };
  }
  return explicit ? { from: cursor, to: cursor, query: '' } : null;
};

export const buildSuggestions = (
  variables: VariableMap,
  requests: SourceRequest[],
  responsesByItemId: Record<string, HttpResponse> = {}
): VariableSuggestion[] => {
  const defined: VariableSuggestion[] = [...variables.entries()].map(([name, variable]) => ({
    name,
    label: name,
    cursorBack: 0,
    kind: variable.source,
    detail: variable.secret ? hiddenValue : variable.value || '(vazio)',
  }));

  const responses: VariableSuggestion[] = [];
  requests.forEach((request) => {
    const response = responsesByItemId[request.id];
    if (response) {
      const discoveredPaths = discoverJsonPaths(decodeResponseBodyText(response), maxPathsPerRequest);
      discoveredPaths.forEach((pathItem) => {
        responses.push({
          cursorBack: 0,
          kind: 'resposta',
          label: `${request.name} → ${pathItem.path}`,
          detail: `Valor atual: ${pathItem.preview}`,
          name: buildResponseTag({ field: 'body', requestReference: request.reference, filter: pathItem.path, trigger: 'never' }, false),
        });
      });
      response.headers.slice(0, maxHeadersPerRequest).forEach((header) => {
        responses.push({
          cursorBack: 0,
          kind: 'resposta',
          label: `${request.name} → Header ${header.key}`,
          detail: `Header: ${header.value}`,
          name: buildResponseTag({ field: 'header', requestReference: request.reference, filter: header.key, trigger: 'never' }, false),
        });
      });
    }
    responses.push({
      cursorBack: 1,
      kind: 'resposta',
      label: `${responseVariable} → ${request.name} (JSONPath)`,
      name: `${responseVariable} 'body', '${request.reference}', '$.'`,
      detail: response
        ? `Extrair outro campo do body de "${request.name}"`
        : `Valor do body da resposta de "${request.name}" (complete o JSONPath)`,
    });
  });

  const dynamic: VariableSuggestion[] = Object.entries(dynamicVariableDescriptions).map(([name, description]) => ({
    name,
    label: name,
    cursorBack: 0,
    kind: 'dinâmica',
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
  const parsed = parseResponseTag(name);
  if (!parsed.valid) {
    return {
      name,
      status: 'missing',
      source: 'resposta',
      value: parsed.error ?? 'Referência {{$response}} inválida',
    };
  }

  const request =
    requests.find((candidate) => candidate.id === parsed.requestReference) ??
    requests.find((candidate) => candidate.name === parsed.requestReference);

  if (!request) {
    return {
      name,
      status: 'missing',
      source: 'resposta',
      value: parsed.requestReference
        ? `Requisição "${parsed.requestReference}" não encontrada na coleção`
        : 'Informe a requisição de origem',
    };
  }

  if (parsed.field === 'body' && parsed.filter.trim() === '$.') {
    return {
      name,
      status: 'missing',
      source: 'resposta',
      requestId: request.id,
      value: `Complete o JSONPath para "${request.name}" (ex: $.token)`,
    };
  }

  const readableFilter = parsed.filter || 'conteúdo inteiro';
  const summary = `${parsed.field} de "${request.name}" · ${readableFilter}`;
  const response = responsesByItemId[request.id];

  if (response) {
    const extracted = extractResponsePreview(response, parsed);
    if (!extracted.ok) {
      return {
        name,
        status: 'missing',
        source: 'resposta',
        requestId: request.id,
        value: `${extracted.value} (em "${request.name}")`,
      };
    }
    return {
      name,
      value: summary,
      status: 'response',
      source: 'resposta',
      requestId: request.id,
      preview: extracted.value,
    };
  }

  return {
    name,
    value: `${summary} · será extraído ao enviar`,
    status: 'response',
    source: 'resposta',
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
    const value = variable.secret || masked ? hiddenValue : variable.value || '(vazio)';
    return { name, status: 'defined', source: variable.source, value };
  }
  if (isResponseVariable(name)) return describeResponse(name, requests, responsesByItemId);
  const description = dynamicVariableDescriptions[name];
  if (description) return { name, status: 'dynamic', source: 'dinâmica', value: `${description} · gerado no envio` };
  if (isDynamicVariable(name)) return { name, status: 'missing', source: 'dinâmica', value: 'Variável dinâmica desconhecida' };
  return { name, status: 'missing', source: '', value: 'Não definida na coleção nem no ambiente ativo' };
};
