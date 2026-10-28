import { isDynamicVariable, type VariableMap } from './Variables';
import type { CollectionItem } from '../../../interfaces/VulpesInterfaces';

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
  kind: SuggestionKind;
  label: string;
  detail: string;
  cursorBack: number;
}

export interface VariableDescription {
  name: string;
  status: VariableStatus;
  source: string;
  value: string;
}

export interface SuggestionInsertion {
  to: number;
  from: number;
  insert: string;
  cursor: number;
}

const responseVariable = '$response';

const maxSuggestions = 60;

const hiddenValue = '••••••';

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

export const buildSuggestions = (variables: VariableMap, requests: SourceRequest[]): VariableSuggestion[] => {
  const defined: VariableSuggestion[] = [...variables.entries()].map(([name, variable]) => ({
    name,
    kind: variable.source,
    label: name,
    detail: variable.secret ? hiddenValue : variable.value || '(vazio)',
    cursorBack: 0,
  }));
  const dynamic: VariableSuggestion[] = Object.entries(dynamicVariableDescriptions).map(([name, description]) => ({
    name,
    kind: 'dinâmica',
    label: name,
    detail: description,
    cursorBack: 0,
  }));
  const responses: VariableSuggestion[] = requests.map((request) => ({
    name: `${responseVariable} 'body', '${request.reference}', '$.'`,
    kind: 'resposta',
    label: `${responseVariable} → ${request.name}`,
    detail: `Valor do body da resposta de "${request.name}" (complete o JSONPath)`,
    cursorBack: 1,
  }));
  return [...defined, ...responses, ...dynamic];
};

export const filterSuggestions = (suggestions: VariableSuggestion[], query: string) => {
  const needle = query.toLowerCase();
  if (!needle) return suggestions.slice(0, maxSuggestions);
  const rank = (suggestion: VariableSuggestion) => {
    const label = suggestion.label.toLowerCase();
    const name = suggestion.name.toLowerCase();
    if (name.startsWith(needle) || label.startsWith(needle)) return 0;
    if (name.includes(needle) || label.includes(needle)) return 1;
    return 2;
  };
  return suggestions
    .map((suggestion) => ({ suggestion, score: rank(suggestion) }))
    .filter((ranked) => ranked.score < 2)
    .sort((left, right) => left.score - right.score)
    .slice(0, maxSuggestions)
    .map((ranked) => ranked.suggestion);
};

export const suggestionInsertion = (query: VariableQuery, suggestion: VariableSuggestion): SuggestionInsertion => {
  const insert = `{{${suggestion.name}}}`;
  const cursor = suggestion.cursorBack > 0 ? query.from + 2 + suggestion.name.length - suggestion.cursorBack : query.from + insert.length;
  return { from: query.from, to: query.to, insert, cursor };
};

const quotedArguments = (expression: string) =>
  [...expression.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((match) => (match[1] ?? match[2] ?? '').replace(/\\(.)/g, '$1'));

const describeResponse = (name: string, requests: SourceRequest[]): VariableDescription => {
  const [field = 'body', reference = '', filter = '', trigger = 'never'] = quotedArguments(name);
  const request = requests.find((candidate) => candidate.id === reference) ?? requests.find((candidate) => candidate.name === reference);
  if (!request) {
    return { name, status: 'missing', source: 'resposta', value: reference ? `Requisição "${reference}" não encontrada na coleção` : 'Informe a requisição de origem' };
  }
  const readableFilter = filter.startsWith('b64::') ? 'filtro codificado' : filter || 'conteúdo inteiro';
  return { name, status: 'response', source: 'resposta', value: `${field} de "${request.name}" · ${readableFilter} · reenvio ${trigger}` };
};

export const describeVariable = (name: string, variables: VariableMap, requests: SourceRequest[], masked = false): VariableDescription => {
  const variable = variables.get(name);
  if (variable) {
    const value = variable.secret || masked ? hiddenValue : variable.value || '(vazio)';
    return { name, status: 'defined', source: variable.source, value };
  }
  if (isResponseVariable(name)) return describeResponse(name, requests);
  const description = dynamicVariableDescriptions[name];
  if (description) return { name, status: 'dynamic', source: 'dinâmica', value: `${description} · gerado no envio` };
  if (isDynamicVariable(name)) return { name, status: 'missing', source: 'dinâmica', value: 'Variável dinâmica desconhecida' };
  return { name, status: 'missing', source: '', value: 'Não definida na coleção nem no ambiente ativo' };
};
