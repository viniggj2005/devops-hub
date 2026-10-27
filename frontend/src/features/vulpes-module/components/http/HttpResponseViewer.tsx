import toast from 'react-hot-toast';
import SearchBar from '../editors/SearchBar';
import SectionTabs from '../editors/SectionTabs';
import { useVulpesStore } from '../../VulpesStore';
import { iconButtonClass } from '../editors/FormStyles';
import React, { useMemo, useRef, useState } from 'react';
import { requireToken } from '../../actions/ActionHelpers';
import { VulpesServices } from '../../services/VulpesServices';
import { emptySearchSummary } from '../../functions/EditorSearch';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import { cookieFlags, formatCookieExpiry } from '../../functions/Cookies';
import CodeEditor, { type CodeEditorHandle } from '../editors/CodeEditor';
import type { HttpResponse, TabRuntime } from '../../../../interfaces/VulpesInterfaces';
import { Copy, Download, WrapText, AlertTriangle, Cookie as CookieIcon } from 'lucide-react';
import { HeadersTable, ResponseEmpty, ResponseError, ResponseLoading } from '../response/ResponseStates';
import { prettyJson, statusTone, formatBytes, mediaTypeOf, formatDuration, responseFileName, languageForContentType } from '../../functions/Formatters';

type ResponseSection = 'body' | 'headers' | 'cookies' | 'request';

type BodyView = 'pretty' | 'raw' | 'preview';

interface HttpResponseViewerProps {
  runtime: TabRuntime;
  onCancel: () => void;
  collectionId: number | null;
}

const timingRows = (response: HttpResponse) => [
  ['DNS', response.timings.dnsMs],
  ['Conexão TCP', response.timings.connectMs],
  ['Handshake TLS', response.timings.tlsMs],
  ['Espera (TTFB)', response.timings.waitMs],
  ['Download', response.timings.downloadMs],
] as const;

interface ResponseBodyProps {
  searchTerm: string;
  response: HttpResponse;
  onSearchTermChange: (term: string) => void;
}

const ResponseBody: React.FC<ResponseBodyProps> = ({ searchTerm, response, onSearchTermChange }) => {
  const [view, setView] = useState<BodyView>('pretty');
  const [wrapLines, setWrapLines] = useState(true);
  const [searchSummary, setSearchSummary] = useState(emptySearchSummary);
  const editorRef = useRef<CodeEditorHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mediaType = mediaTypeOf(response.contentType);
  const isImage = mediaType.startsWith('image/');
  const isHtml = mediaType.includes('html');
  const isBinary = response.bodyEncoding === 'base64';
  const language = languageForContentType(response.contentType);
  const prettyBody = useMemo(() => (isBinary ? null : prettyJson(response.body)), [response.body, isBinary]);

  if (isBinary && !isImage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6">
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Conteúdo binário ({formatBytes(response.sizeBytes)})</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{response.contentType || 'Tipo de conteúdo não informado'} · use o botão de download para salvar.</p>
      </div>
    );
  }

  const views: { key: BodyView; label: string; hidden?: boolean }[] = [
    { key: 'pretty', label: 'Formatado', hidden: isImage },
    { key: 'raw', label: 'Bruto', hidden: isImage },
    { key: 'preview', label: 'Visualizar', hidden: !isHtml && !isImage },
  ];
  const activeView = isImage ? 'preview' : view;
  const showsEditor = activeView !== 'preview';
  const editorContent =
    activeView === 'raw'
      ? { value: response.body, language: 'text' as const }
      : { value: prettyBody ?? response.body, language: prettyBody ? ('json' as const) : language };

  const focusSearch = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-1 px-3 py-1.5">
        {views
          .filter((option) => !option.hidden)
          .map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setView(option.key)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                activeView === option.key
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        {showsEditor && (
          <div className="ml-auto flex items-center gap-1 min-w-0">
            <SearchBar
              value={searchTerm}
              inputRef={searchInputRef}
              summary={searchSummary}
              onChange={onSearchTermChange}
              placeholder="Buscar na resposta"
              onNext={() => editorRef.current?.selectMatch('next')}
              onPrevious={() => editorRef.current?.selectMatch('previous')}
            />
            <button
              type="button"
              title="Quebrar linhas"
              onClick={() => setWrapLines((current) => !current)}
              className={`${iconButtonClass} ${wrapLines ? 'text-amber-500' : ''}`}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 border-t border-gray-100 dark:border-white/5">
        {activeView === 'preview' && isImage && (
          <div className="h-full overflow-auto flex items-center justify-center p-4 bg-[repeating-conic-gradient(#8881_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
            <img alt="Pré-visualização da resposta" className="max-w-full max-h-full object-contain" src={`data:${mediaType};base64,${response.body}`} />
          </div>
        )}
        {activeView === 'preview' && isHtml && (
          <iframe title="Pré-visualização HTML" sandbox="" srcDoc={response.body} className="w-full h-full bg-white" />
        )}
        {showsEditor && (
          <CodeEditor
            readOnly
            ref={editorRef}
            key={activeView}
            onFind={focusSearch}
            searchQuery={searchTerm}
            lineWrapping={wrapLines}
            value={editorContent.value}
            onSearchChange={setSearchSummary}
            language={editorContent.language}
          />
        )}
      </div>
    </div>
  );
};

const HttpResponseViewer: React.FC<HttpResponseViewerProps> = ({ runtime, onCancel, collectionId }) => {
  const [section, setSection] = useState<ResponseSection>('body');
  const [searchTerm, setSearchTerm] = useState('');
  const openCookies = useVulpesStore((state) => state.openCookies);
  const response = runtime.httpResponse;

  if (runtime.running) return <ResponseLoading label="Enviando requisição…" onCancel={onCancel} />;
  if (runtime.error) return <ResponseError message={runtime.error} />;
  if (!response) return <ResponseEmpty hint="Envie a requisição (Ctrl+Enter) para ver a resposta aqui." />;

  const saveBody = async () => {
    try {
      const path = await VulpesServices.saveResponseBody(requireToken(), responseFileName(response), response.body, response.bodyEncoding);
      if (path) toast.success(`Resposta salva em ${path}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${statusTone(response.statusCode)}`}>{response.status}</span>
        <span className="relative group text-[11px] font-semibold text-gray-500 dark:text-zinc-400 cursor-default">
          {formatDuration(response.timings.totalMs)}
          <span className="hidden group-hover:block absolute left-0 top-full mt-1 z-30 w-52 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-3 space-y-1">
            {timingRows(response).map(([label, value]) => (
              <span key={label} className="flex justify-between text-[11px]">
                <span className="text-gray-500 dark:text-zinc-400">{label}</span>
                <span className="font-mono text-gray-800 dark:text-zinc-200">{formatDuration(value)}</span>
              </span>
            ))}
            <span className="flex justify-between text-[11px] pt-1 border-t border-gray-100 dark:border-white/10 font-bold text-gray-800 dark:text-zinc-100">
              <span>Total</span>
              <span className="font-mono">{formatDuration(response.timings.totalMs)}</span>
            </span>
          </span>
        </span>
        <span className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{formatBytes(response.sizeBytes)}</span>
        <span className="text-[11px] text-gray-400 dark:text-zinc-500">{response.protocol}</span>
        <div className="ml-auto flex items-center gap-1">
          {response.bodyEncoding === 'text' && (
            <button type="button" title="Copiar corpo" onClick={() => copyToClipboard(response.body)} className={iconButtonClass}>
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" title="Salvar corpo em arquivo" onClick={saveBody} className={iconButtonClass}>
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <SectionTabs
        active={section}
        onChange={setSection}
        tabs={[
          { key: 'body', label: 'Corpo' },
          { key: 'headers', label: 'Headers', count: response.headers.length },
          { key: 'cookies', label: 'Cookies', count: response.cookies.length },
          { key: 'request', label: 'Requisição enviada' },
        ]}
      />
      {response.truncated && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          A resposta foi truncada em 64 MB.
        </div>
      )}
      {section === 'body' && (
        <ResponseBody
          response={response}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          key={`${response.url}-${response.timings.totalMs}`}
        />
      )}
      {section === 'headers' && (
        <div className="flex-1 overflow-auto">
          <HeadersTable headers={response.headers} emptyLabel="A resposta não possui headers." />
        </div>
      )}
      {section === 'cookies' && (
        <div className="flex-1 overflow-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-white/5 text-[11px] text-gray-500 dark:text-zinc-400">
            <CookieIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="flex-1 min-w-0">
              {collectionId
                ? 'Cookies recebidos são salvos na coleção e enviados nas próximas requisições para o mesmo domínio.'
                : 'Salve a requisição em uma coleção para guardar os cookies recebidos.'}
            </span>
            {collectionId && (
              <button
                type="button"
                onClick={() => openCookies(collectionId)}
                className="flex-shrink-0 px-2 py-0.5 rounded-md font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                Gerenciar cookies
              </button>
            )}
          </div>
          {response.cookies.length === 0 ? (
            <p className="p-4 text-xs text-gray-500 dark:text-zinc-400">Nenhum cookie definido pela resposta.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/5">
                  {['Nome', 'Valor', 'Domínio', 'Path', 'Expira', 'Flags'].map((column) => (
                    <th key={column} className="px-3 py-1.5 font-bold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {response.cookies.map((cookie, index) => (
                  <tr key={`${cookie.name}-${index}`} className="border-b border-gray-100 dark:border-white/5 align-top">
                    <td className="px-3 py-1.5 font-semibold text-gray-700 dark:text-zinc-300">{cookie.name}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-zinc-400 break-all">{cookie.value}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-zinc-400">{cookie.domain || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-zinc-400">{cookie.path || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{formatCookieExpiry(cookie.expires)}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{cookieFlags(cookie) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {section === 'request' && (
        <div className="flex-1 overflow-auto">
          <p className="px-4 py-2 text-xs font-mono break-all text-gray-700 dark:text-zinc-300 border-b border-gray-100 dark:border-white/5">
            <span className="font-bold text-amber-600 dark:text-amber-400 mr-2">{response.method}</span>
            {response.url}
            <span className="ml-2 text-gray-400">{response.protocol}</span>
          </p>
          <HeadersTable headers={response.requestHeaders} emptyLabel="Nenhum header enviado." />
        </div>
      )}
    </div>
  );
};

export default HttpResponseViewer;
