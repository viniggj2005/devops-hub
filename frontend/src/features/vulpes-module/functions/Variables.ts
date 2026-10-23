import type { Collection, Environment, Variable } from '../../../interfaces/VulpesInterfaces';

export interface ResolvedVariable {
  value: string;
  secret: boolean;
  source: 'coleção' | 'ambiente';
}

export interface TextToken {
  text: string;
  variable: string | null;
}

export type VariableMap = Map<string, ResolvedVariable>;

const variablePattern = /\{\{([^{}]+)\}\}/g;

const maxResolutionPasses = 10;

export const isDynamicVariable = (name: string) => name.startsWith('$');

export const buildVariableMap = (collection?: Collection | null, environment?: Environment | null): VariableMap => {
  const variables: VariableMap = new Map();
  const addLayer = (layer: Variable[], source: ResolvedVariable['source']) =>
    layer
      .filter((variable) => variable.enabled && variable.key)
      .forEach((variable) => variables.set(variable.key, { value: variable.value, secret: variable.secret, source }));
  addLayer(collection?.variables ?? [], 'coleção');
  addLayer(environment?.variables ?? [], 'ambiente');
  return variables;
};

export const resolveText = (text: string, variables: VariableMap) => {
  let resolved = text;
  for (let pass = 0; pass < maxResolutionPasses; pass++) {
    const next = resolved.replace(variablePattern, (match, name: string) => variables.get(name.trim())?.value ?? match);
    if (next === resolved) break;
    resolved = next;
  }
  return resolved;
};

export const tokenizeVariables = (text: string): TextToken[] => {
  const tokens: TextToken[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(variablePattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) tokens.push({ text: text.slice(lastIndex, start), variable: null });
    tokens.push({ text: match[0], variable: match[1].trim() });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex), variable: null });
  return tokens;
};
