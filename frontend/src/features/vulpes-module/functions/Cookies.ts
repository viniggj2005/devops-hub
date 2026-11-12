import type { Cookie } from '../../../interfaces/VulpesInterfaces';
import { currentDictionary, currentLanguage } from '../../i18n/TranslateError';

export interface DomainCookies {
  domain: string;
  cookies: Cookie[];
}

const invalidNameCharacters = /[\s()<>@,;:\\"/[\]?={}\u0000-\u001f\u007f-\uffff]/;

const invalidValueCharacters = /["\\;\u0000-\u001f\u007f-\uffff]/;

const twoDigits = (value: number) => String(value).padStart(2, '0');

export const emptyCookie = (domain = ''): Cookie => ({
  name: '',
  path: '/',
  value: '',
  domain,
  secure: false,
  expires: '',
  hostOnly: false,
  httpOnly: false,
  sameSite: '',
});

export const sameCookie = (left: Cookie, right: Cookie) =>
  left.name === right.name && left.path === right.path && left.domain.toLowerCase() === right.domain.toLowerCase();

export const isCookieExpired = (cookie: Cookie, now = Date.now()) =>
  Boolean(cookie.expires) && new Date(cookie.expires).getTime() <= now;

export const groupCookiesByDomain = (cookies: Cookie[]): DomainCookies[] => {
  const groups = new Map<string, Cookie[]>();
  cookies.forEach((cookie) => groups.set(cookie.domain, [...(groups.get(cookie.domain) ?? []), cookie]));
  return Array.from(groups, ([domain, entries]) => ({
    domain,
    cookies: [...entries].sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path)),
  })).sort((left, right) => left.domain.localeCompare(right.domain));
};

export const formatCookieExpiry = (expires: string) => {
  if (!expires) return currentDictionary().vulpes.cookies.session;
  const moment = new Date(expires);
  return Number.isNaN(moment.getTime()) ? expires : moment.toLocaleString(currentLanguage(), { dateStyle: 'short', timeStyle: 'short' });
};

export const cookieFlags = (cookie: Cookie) =>
  [cookie.hostOnly && currentDictionary().vulpes.cookies.hostOnlyFlag, cookie.httpOnly && 'HttpOnly', cookie.secure && 'Secure', cookie.sameSite && `SameSite=${cookie.sameSite}`]
    .filter(Boolean)
    .join(' · ');

export const toDateTimeLocal = (expires: string) => {
  if (!expires) return '';
  const moment = new Date(expires);
  if (Number.isNaN(moment.getTime())) return '';
  return `${moment.getFullYear()}-${twoDigits(moment.getMonth() + 1)}-${twoDigits(moment.getDate())}T${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
};

export const fromDateTimeLocal = (value: string) => {
  if (!value) return '';
  const moment = new Date(value);
  return Number.isNaN(moment.getTime()) ? '' : moment.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

export const cookieValidationError = (cookie: Cookie) => {
  const name = cookie.name.trim();
  const validationTexts = currentDictionary().vulpes.cookies.validation;
  if (!name) return validationTexts.nameRequired;
  if (invalidNameCharacters.test(name)) return validationTexts.invalidName;
  if (invalidValueCharacters.test(cookie.value)) return validationTexts.invalidValue;
  if (!cookie.domain.trim().replace(/^\./, '')) return validationTexts.domainRequired;
  if (cookie.path && !cookie.path.startsWith('/')) return validationTexts.pathSlash;
  if (isCookieExpired(cookie)) return validationTexts.expired;
  return null;
};

export const normalizeCookieDraft = (cookie: Cookie): Cookie => ({
  ...cookie,
  name: cookie.name.trim(),
  path: cookie.path.trim() || '/',
  domain: cookie.domain.trim().replace(/^\./, '').toLowerCase(),
});
