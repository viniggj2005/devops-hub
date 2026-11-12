import { useLanguageStore } from './LanguageStore';
import { dictionaries, formatMessage } from './Languages';

export interface LocalizedPayload {
  code: string;
  detail?: string;
  cause?: LocalizedPayload;
  errors?: LocalizedPayload[];
  params?: Record<string, string>;
}

const isLocalizedPayload = (value: unknown): value is LocalizedPayload =>
  Boolean(value) && typeof value === 'object' && typeof (value as LocalizedPayload).code === 'string';

const readPayload = (error: unknown): LocalizedPayload | null => {
  if (!error || typeof error !== 'object' || !('cause' in error)) return null;
  const { cause } = error as { cause: unknown };
  return isLocalizedPayload(cause) ? cause : null;
};

const findErrorTemplate = (errorTexts: object, code: string) => {
  const template = code.split('.').reduce<unknown>(
    (node, segment) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined),
    errorTexts,
  );
  return typeof template === 'string' ? template : null;
};

export const currentLanguage = () => useLanguageStore.getState().language;

export const currentDictionary = () => dictionaries[currentLanguage()];

export const translatePayload = (payload: LocalizedPayload): string | null => {
  if (payload.errors?.length) {
    const messages = payload.errors.map(joinedPayload => translatePayload(joinedPayload));
    return messages.every(Boolean) ? messages.join('\n') : null;
  }
  const template = payload.code ? findErrorTemplate(currentDictionary().errors, payload.code) : null;
  const causeMessage = payload.cause ? translatePayload(payload.cause) : payload.detail;
  if (!template) return payload.code ? null : causeMessage ?? null;
  const message = formatMessage(template, payload.params ?? {});
  if (!causeMessage) return message;
  return message ? `${message}: ${causeMessage}` : causeMessage;
};

const searchPayload = (payload: LocalizedPayload | undefined, code: string): LocalizedPayload | null => {
  if (!payload) return null;
  if (payload.code === code) return payload;
  const joinedMatch = payload.errors?.map(joinedPayload => searchPayload(joinedPayload, code)).find(Boolean);
  return joinedMatch ?? searchPayload(payload.cause, code);
};

export const findErrorPayload = (error: unknown, code: string) => searchPayload(readPayload(error) ?? undefined, code);

export const hasErrorCode = (error: unknown, ...codes: string[]) => {
  const payload = readPayload(error);
  return payload !== null && codes.includes(payload.code);
};

export const translateError = (error: unknown): string => {
  const payload = readPayload(error);
  const translated = payload ? translatePayload(payload) : null;
  if (translated) return translated;
  if (!error) return currentDictionary().errors.common.unknown;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
};
