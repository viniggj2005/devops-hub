import { useVulpesStore } from '../../VulpesStore';
import CookieEditorModal from './CookieEditorModal';
import { useTranslation } from '../../../i18n/useTranslation';
import { runWithToast } from '../../actions/ActionHelpers';
import React, { useEffect, useMemo, useState } from 'react';
import Select from '../../../shared/components/forms/Select';
import { collectionActions } from '../../actions/CollectionActions';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import { iconButtonClass, primaryButtonClass } from '../editors/FormStyles';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import type { Cookie, CookiesTab } from '../../../../interfaces/VulpesInterfaces';
import { Copy, Globe, Plus, Search, Trash2, Pencil, Cookie as CookieIcon } from 'lucide-react';
import { cookieFlags, emptyCookie, sameCookie, isCookieExpired, formatCookieExpiry, groupCookiesByDomain } from '../../functions/Cookies';

interface CookiesViewProps {
  tab: CookiesTab;
  paneControls?: React.ReactNode;
}

interface EditingState {
  draft: Cookie;
  original: Cookie | null;
}

const tableColumns = ['name', 'value', 'path', 'expires', 'flags', ''] as const;

const storedCookies = (collectionId: number) =>
  useVulpesStore.getState().collections.find((collection) => collection.id === collectionId)?.cookies ?? [];

const CookiesView: React.FC<CookiesViewProps> = ({ tab, paneControls }) => {
  const confirm = useConfirmToast();
  const { dictionary, formatMessage } = useTranslation();
  const cookieTexts = dictionary.vulpes.cookies;
  const columnLabels = { name: dictionary.vulpes.common.name, value: dictionary.vulpes.common.value, path: cookieTexts.path, expires: cookieTexts.expires, flags: cookieTexts.flags, '': '' };
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const collections = useVulpesStore((state) => state.collections);
  const setCookiesCollection = useVulpesStore((state) => state.setCookiesCollection);
  const collection = collections.find((candidate) => candidate.id === tab.collectionId) ?? null;
  const cookies = useMemo(() => collection?.cookies ?? [], [collection]);

  useEffect(() => {
    if (!collection && collections.length) setCookiesCollection(tab.id, collections[0].id);
  }, [collection, collections, setCookiesCollection, tab.id]);

  const domains = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = term
      ? cookies.filter((cookie) => [cookie.name, cookie.domain, cookie.value, cookie.path].some((field) => field.toLowerCase().includes(term)))
      : cookies;
    return groupCookiesByDomain(matching);
  }, [cookies, search]);

  const collectionOptions = collections.map((candidate) => ({ value: String(candidate.id), label: candidate.name }));

  const saveCookie = async (cookie: Cookie) => {
    if (!collection) return;
    const original = editing?.original;
    const remaining = storedCookies(collection.id).filter(
      (candidate) => !sameCookie(candidate, cookie) && !(original && sameCookie(candidate, original))
    );
    const saved = await runWithToast(() => collectionActions.saveCookies(collection.id, [...remaining, cookie]), cookieTexts.cookieSaved);
    if (saved) setEditing(null);
  };

  const removeCookie = (cookie: Cookie) => {
    if (!collection) return;
    runWithToast(
      () => collectionActions.saveCookies(collection.id, storedCookies(collection.id).filter((candidate) => !sameCookie(candidate, cookie))),
      cookieTexts.cookieRemoved
    );
  };

  const removeDomain = (domain: string, count: number) => {
    if (!collection) return;
    confirm({
      title: cookieTexts.removeDomainTitle,
      message: formatMessage(cookieTexts.removeDomainMessage, { count, domain, collection: collection.name }),
      onConfirm: async () => {
        await collectionActions.saveCookies(collection.id, storedCookies(collection.id).filter((cookie) => cookie.domain !== domain));
      },
    });
  };

  const clearAll = () => {
    if (!collection) return;
    confirm({
      title: cookieTexts.clearAllTitle,
      message: formatMessage(cookieTexts.clearAllMessage, { count: cookies.length, collection: collection.name }),
      onConfirm: async () => {
        await collectionActions.saveCookies(collection.id, []);
      },
    });
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2 flex-shrink-0">
        <CookieIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="text-sm font-bold text-gray-900 dark:text-white">Cookies</span>
        <div className="w-56">
          <Select
            variant="navbar"
            aria-label={cookieTexts.collectionLabel}
            options={collectionOptions}
            value={collection ? String(collection.id) : ''}
            placeholder={cookieTexts.selectCollection}
            noOptionsMessage={cookieTexts.noCollections}
            onChange={(value) => setCookiesCollection(tab.id, Number(value))}
          />
        </div>
        <span className="text-[11px] text-gray-400 dark:text-zinc-500">{formatMessage(cookieTexts.countLabel, { count: cookies.length })}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              placeholder={cookieTexts.filterPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
              className="w-44 rounded-lg bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-white/10 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
          <button type="button" disabled={!collection} onClick={() => setEditing({ draft: emptyCookie(), original: null })} className={primaryButtonClass}>
            <Plus className="w-3.5 h-3.5" />
            {cookieTexts.newCookie}
          </button>
          <button type="button" title={cookieTexts.clearAll} disabled={!cookies.length} onClick={clearAll} className={`${iconButtonClass} hover:text-rose-500`}>
            <Trash2 className="w-4 h-4" />
          </button>
          {paneControls}
        </div>
      </div>
      <p className="px-4 pb-3 text-[11px] text-gray-400 dark:text-zinc-500 flex-shrink-0">
        {cookieTexts.description}
      </p>

      <div className="flex-1 min-h-0 overflow-auto px-4 pb-4 space-y-3">
        {!collection && (
          <div className="py-12 text-center text-xs text-gray-500 dark:text-zinc-400">{cookieTexts.noCollection}</div>
        )}
        {collection && cookies.length === 0 && (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <CookieIcon className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{formatMessage(cookieTexts.emptyIn, { name: collection.name })}</p>
            <p className="max-w-sm text-xs text-gray-500 dark:text-zinc-400">
              {cookieTexts.emptyHint}
            </p>
          </div>
        )}
        {collection && cookies.length > 0 && domains.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-500 dark:text-zinc-400">{cookieTexts.noMatch}</p>
        )}
        {domains.map(({ domain, cookies: domainCookies }) => (
          <section key={domain} className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <header className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <Globe className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="font-mono text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">{domain}</span>
              <span className="text-[10px] text-gray-400 dark:text-zinc-500">{domainCookies.length}</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  title={formatMessage(cookieTexts.newCookieIn, { domain })}
                  onClick={() => setEditing({ draft: emptyCookie(domain), original: null })}
                  className={iconButtonClass}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={formatMessage(cookieTexts.removeDomain, { domain })}
                  onClick={() => removeDomain(domain, domainCookies.length)}
                  className={`${iconButtonClass} hover:text-rose-500`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </header>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/5">
                  {tableColumns.map((column) => (
                    <th key={column} className="px-3 py-1.5 font-bold">
                      {columnLabels[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {domainCookies.map((cookie) => {
                  const expired = isCookieExpired(cookie);
                  return (
                    <tr
                      key={`${cookie.name}-${cookie.path}`}
                      onDoubleClick={() => setEditing({ draft: cookie, original: cookie })}
                      className={`group border-b last:border-b-0 border-gray-100 dark:border-white/5 align-top hover:bg-amber-500/5 ${expired ? 'opacity-50' : ''}`}
                    >
                      <td className="px-3 py-1.5 font-semibold text-gray-700 dark:text-zinc-300 whitespace-nowrap">{cookie.name}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-zinc-400 max-w-[260px]">
                        <span title={cookie.value} className="block truncate">
                          {cookie.value || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-zinc-400 whitespace-nowrap">{cookie.path}</td>
                      <td className={`px-3 py-1.5 whitespace-nowrap ${expired ? 'text-rose-500' : 'text-gray-600 dark:text-zinc-400'}`}>
                        {expired ? cookieTexts.expired : formatCookieExpiry(cookie.expires)}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{cookieFlags(cookie) || '—'}</td>
                      <td className="px-2 py-1 w-px whitespace-nowrap">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" title={cookieTexts.copyValue} onClick={() => copyToClipboard(cookie.value)} className={iconButtonClass}>
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title={cookieTexts.editCookie} onClick={() => setEditing({ draft: cookie, original: cookie })} className={iconButtonClass}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title={cookieTexts.removeCookie} onClick={() => removeCookie(cookie)} className={`${iconButtonClass} hover:text-rose-500`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <CookieEditorModal cookie={editing?.draft ?? null} creating={!editing?.original} onClose={() => setEditing(null)} onSave={saveCookie} />
    </div>
  );
};

export default CookiesView;
