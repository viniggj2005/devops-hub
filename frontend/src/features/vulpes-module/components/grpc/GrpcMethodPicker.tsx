import React, { useMemo, useRef, useState } from 'react';
import { useDismiss } from '../../../shared/hooks/useDismiss';
import { ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react';
import type { GrpcMethod, GrpcService } from '../../../../interfaces/VulpesInterfaces';

interface GrpcMethodPickerProps {
  loading: boolean;
  selected: string;
  onReload: () => void;
  services: GrpcService[] | null;
  onSelect: (method: GrpcMethod) => void;
}

export const streamingLabel = (method: GrpcMethod) => {
  if (method.clientStreaming && method.serverStreaming) return 'bidirecional';
  if (method.clientStreaming) return 'client stream';
  if (method.serverStreaming) return 'server stream';
  return 'unário';
};

const shortMethodName = (fullName: string) => {
  const [service, method] = fullName.split('/');
  return method ? `${service.split('.').pop()}/${method}` : fullName;
};

const GrpcMethodPicker: React.FC<GrpcMethodPickerProps> = ({ services, selected, loading, onSelect, onReload }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss(containerRef, open, () => setOpen(false));

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (services ?? [])
      .map((service) => ({
        ...service,
        methods: service.methods.filter((method) => !normalizedSearch || method.fullName.toLowerCase().includes(normalizedSearch)),
      }))
      .filter((service) => service.methods.length > 0);
  }, [services, search]);

  const toggle = () => {
    if (!open && services === null && !loading) onReload();
    setOpen((current) => !current);
  };

  return (
    <div ref={containerRef} className="relative flex-shrink-0 w-72">
      <button
        type="button"
        onClick={toggle}
        title={selected || 'Selecionar método'}
        className="h-full w-full flex items-center gap-2 px-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-xs hover:border-amber-500/60 transition-colors"
      >
        <span className={`flex-1 min-w-0 truncate text-left font-mono ${selected ? 'text-gray-800 dark:text-zinc-100' : 'text-gray-400'}`}>
          {selected ? shortMethodName(selected) : 'Selecionar método'}
        </span>
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[420px] max-h-96 flex flex-col rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl">
          <div className="flex items-center gap-2 p-2 border-b border-gray-100 dark:border-white/10">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={search}
                placeholder="Buscar método"
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-md bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-white/10 pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={onReload}
              disabled={loading}
              title="Recarregar serviços"
              className="p-1.5 rounded-md text-gray-500 hover:text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex-1 overflow-auto py-1">
            {services === null && <p className="p-4 text-xs text-gray-500 dark:text-zinc-400">{loading ? 'Carregando serviços…' : 'Clique em recarregar para buscar os serviços.'}</p>}
            {services !== null && filteredServices.length === 0 && (
              <p className="p-4 text-xs text-gray-500 dark:text-zinc-400">Nenhum método encontrado.</p>
            )}
            {filteredServices.map((service) => (
              <div key={service.name}>
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 truncate">{service.name}</p>
                {service.methods.map((method) => (
                  <button
                    type="button"
                    key={method.fullName}
                    onClick={() => {
                      onSelect(method);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-amber-500/10 ${
                      method.fullName === selected ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <span className="flex-1 min-w-0 truncate font-mono text-gray-800 dark:text-zinc-100">{method.name}</span>
                    <span className="flex-shrink-0 px-1.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-300 text-[10px] font-semibold">
                      {streamingLabel(method)}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GrpcMethodPicker;
