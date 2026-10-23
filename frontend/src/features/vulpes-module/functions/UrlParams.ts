import { emptyKeyValue } from './RequestDefaults';
import type { KeyValue } from '../../../interfaces/VulpesInterfaces';

const splitUrl = (url: string) => {
  const separator = url.indexOf('?');
  return separator < 0 ? { base: url, query: '' } : { base: url.slice(0, separator), query: url.slice(separator + 1) };
};

const parseQuery = (query: string): KeyValue[] =>
  query
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const separator = pair.indexOf('=');
      if (separator < 0) return { ...emptyKeyValue(), key: pair };
      return { ...emptyKeyValue(), key: pair.slice(0, separator), value: pair.slice(separator + 1) };
    });

const buildQuery = (params: KeyValue[]) =>
  params
    .filter((param) => param.enabled && (param.key || param.value))
    .map((param) => (param.value === '' ? param.key : `${param.key}=${param.value}`))
    .join('&');

export const paramsFromUrl = (url: string, previous: KeyValue[]): KeyValue[] => {
  const descriptions = new Map(previous.filter((param) => param.enabled).map((param) => [param.key, param.description]));
  const parsed = parseQuery(splitUrl(url).query).map((param) => ({ ...param, description: descriptions.get(param.key) ?? '' }));
  return [...parsed, ...previous.filter((param) => !param.enabled)];
};

export const urlFromParams = (url: string, params: KeyValue[]) => {
  const query = buildQuery(params);
  const { base } = splitUrl(url);
  return query ? `${base}?${query}` : base;
};

const pathStartIndex = (url: string) => {
  const schemeEnd = url.indexOf('://');
  const authorityStart = schemeEnd >= 0 ? schemeEnd + 3 : 0;
  for (let position = authorityStart; position < url.length; position++) {
    const character = url[position];
    if (character === '/') return position;
    if (character === '?' || character === '#') return -1;
  }
  return -1;
};

const pathVariableNames = (url: string) => {
  const pathStart = pathStartIndex(url);
  if (pathStart < 0) return [];
  const { base } = splitUrl(url.slice(pathStart));
  return base
    .split('/')
    .filter((segment) => segment.length > 1 && segment.startsWith(':'))
    .map((segment) => segment.slice(1));
};

export const pathVariablesFromUrl = (url: string, previous: KeyValue[]): KeyValue[] =>
  pathVariableNames(url).map((name) => previous.find((variable) => variable.key === name) ?? { ...emptyKeyValue(), key: name });
