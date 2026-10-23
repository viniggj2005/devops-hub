import { iconButtonClass } from '../editors/FormStyles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import { formatBytes, formatClock, prettyJson } from '../../functions/Formatters';
import type { LoggedRealtimeEvent } from '../../../../interfaces/VulpesInterfaces';
import { Copy, Tags, Search, Trash2, Unplug, Loader2, PlugZap, ArrowUpRight, AlertTriangle, ArrowDownLeft, ArrowDownToLine } from 'lucide-react';

type DirectionFilter = 'all' | 'incoming' | 'outgoing';

interface RealtimeMessageLogProps {
  emptyHint: string;
  onClear: () => void;
  showEventNames?: boolean;
  events: LoggedRealtimeEvent[];
}

const filters: { key: DirectionFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'outgoing', label: 'Enviadas' },
  { key: 'incoming', label: 'Recebidas' },
];

const eventIcon = (event: LoggedRealtimeEvent) => {
  if (event.kind === 'metadata') return <Tags className="w-3.5 h-3.5 text-sky-500" />;
  if (event.kind === 'closed') return <Unplug className="w-3.5 h-3.5 text-gray-400" />;
  if (event.kind === 'error') return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
  if (event.kind === 'connecting') return <Loader2 className="w-3.5 h-3.5 text-amber-500" />;
  if (event.kind === 'connected') return <PlugZap className="w-3.5 h-3.5 text-emerald-500" />;
  if (event.direction === 'outgoing') return <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />;
  if (event.direction === 'incoming') return <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />;
  return <Tags className="w-3.5 h-3.5 text-gray-400" />;
};

const eventSummary = (event: LoggedRealtimeEvent) => {
  if (event.kind === 'connecting') return `Conectando em ${event.data}`;
  if (event.kind === 'connected') return event.data ? `Conectado · ${event.data}` : 'Conectado';
  if (event.kind === 'metadata') return `Metadata (${event.event}) recebida`;
  if (event.kind === 'closed' && event.event) return `Stream encerrado · ${event.event}${event.data ? `: ${event.data}` : ''}`;
  if (event.encoding === 'base64') return `[binário] ${event.data}`;
  return event.data || '(vazio)';
};

const detailText = (event: LoggedRealtimeEvent) => prettyJson(event.data) ?? event.data;

const RealtimeMessageLog: React.FC<RealtimeMessageLogProps> = ({ events, emptyHint, onClear, showEventNames = false }) => {
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<DirectionFilter>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return events.filter((event) => {
      if (filter !== 'all' && event.direction !== filter) return false;
      if (!normalizedSearch) return true;
      return `${event.event} ${event.data}`.toLowerCase().includes(normalizedSearch);
    });
  }, [events, filter, search]);

  useEffect(() => {
    if (autoScroll && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [visibleEvents.length, autoScroll]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-white/5">
          {filters.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                filter === option.key
                  ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            placeholder="Filtrar mensagens"
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-white/10 pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
        <span className="ml-auto text-[11px] text-gray-400 dark:text-zinc-500">{events.length} eventos</span>
        <button
          type="button"
          title="Rolar automaticamente"
          onClick={() => setAutoScroll((current) => !current)}
          className={`${iconButtonClass} ${autoScroll ? 'text-amber-500' : ''}`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Limpar mensagens" onClick={onClear} className={iconButtonClass}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-auto font-mono text-xs">
        {visibleEvents.length === 0 && (
          <p className="p-6 text-center font-sans text-xs text-gray-500 dark:text-zinc-400">{events.length ? 'Nenhuma mensagem corresponde ao filtro.' : emptyHint}</p>
        )}
        {visibleEvents.map((event) => {
          const isExpanded = expanded === event.sequence;
          const canExpand = event.kind === 'message' || event.kind === 'ack' || event.kind === 'metadata' || event.kind === 'error';
          return (
            <div key={event.sequence} className="border-b border-gray-100 dark:border-white/5">
              <button
                type="button"
                disabled={!canExpand}
                onClick={() => setExpanded(isExpanded ? null : event.sequence)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 disabled:cursor-default ${
                  event.kind === 'error' ? 'bg-rose-500/5' : ''
                }`}
              >
                <span className="flex-shrink-0">{eventIcon(event)}</span>
                <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-zinc-500">{formatClock(event.timestamp)}</span>
                {showEventNames && event.event && event.kind === 'message' && (
                  <span className="flex-shrink-0 px-1.5 rounded bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 font-sans font-semibold text-[11px]">
                    {event.event}
                  </span>
                )}
                {event.hasAck && (
                  <span className="flex-shrink-0 px-1.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 font-sans font-semibold text-[11px]">
                    ack #{event.ackId}
                  </span>
                )}
                <span
                  className={`flex-1 min-w-0 truncate ${
                    event.direction === 'system' ? 'font-sans text-gray-500 dark:text-zinc-400' : 'text-gray-800 dark:text-zinc-200'
                  } ${event.kind === 'error' ? 'text-rose-600 dark:text-rose-400' : ''}`}
                >
                  {eventSummary(event)}
                </span>
                {event.kind === 'message' && (
                  <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-zinc-500">{formatBytes(event.sizeBytes)}</span>
                )}
              </button>
              {isExpanded && (
                <div className="relative mx-3 mb-2 rounded-lg bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-white/10">
                  <button
                    type="button"
                    title="Copiar"
                    onClick={() => copyToClipboard(event.data)}
                    className={`absolute right-1 top-1 ${iconButtonClass}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <pre className="p-3 pr-9 max-h-80 overflow-auto whitespace-pre-wrap break-all text-gray-800 dark:text-zinc-200 select-text">
                    {detailText(event)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RealtimeMessageLog;
