import { createPortal } from 'react-dom';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Settings2, Sparkles } from 'lucide-react';
import { isResponseVariable, type SuggestionKind, type VariableSuggestion, type VariableDescription } from '../../functions/VariableSuggestions';

export const kindBadgeStyles: Record<SuggestionKind, string> = {
  dinâmica: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  coleção: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  resposta: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  ambiente: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
};

interface PortalPosition {
  top: number;
  left: number;
  width: number;
}

const computePosition = (anchor: HTMLElement | null, estimatedHeight: number, minWidth = 340): PortalPosition | null => {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
  const top = openAbove ? Math.max(8, rect.top - estimatedHeight - 6) : rect.bottom + 4;
  const width = Math.min(Math.max(rect.width, minWidth), 520);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  return { top, left, width };
};

interface VariableAutocompletePortalProps {
  activeIndex: number;
  hasRequests: boolean;
  anchor: HTMLElement | null;
  suggestions: VariableSuggestion[];
  onHoverIndex: (index: number) => void;
  onOpenResponseBuilder: () => void;
  onSelect: (suggestion: VariableSuggestion) => void;
}

export const VariableAutocompletePortal: React.FC<VariableAutocompletePortalProps> = ({
  anchor,
  onSelect,
  suggestions,
  activeIndex,
  hasRequests,
  onHoverIndex,
  onOpenResponseBuilder,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PortalPosition | null>(null);

  useLayoutEffect(() => {
    const update = () => setPosition(computePosition(anchor, 310, 360));
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor, suggestions.length]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const item = container.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!position) return null;

  return createPortal(
    <div
      style={{ top: position.top, left: position.left, width: position.width }}
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-[120] rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
          Variáveis · ↑↓ Enter
        </span>
        {hasRequests && (
          <button
            type="button"
            onClick={onOpenResponseBuilder}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-300 hover:bg-violet-500/25 transition-colors"
          >
            <Link2 className="w-3 h-3" />
            Vincular resposta de outra requisição…
          </button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-gray-500 dark:text-zinc-400">
          Nenhuma variável correspondente encontrada.
        </div>
      ) : (
        <div ref={listRef} className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
          {suggestions.map((suggestion, index) => {
            const active = index === activeIndex;
            return (
              <button
                type="button"
                key={`${suggestion.kind}:${suggestion.name}`}
                onMouseEnter={() => onHoverIndex(index)}
                onClick={() => onSelect(suggestion)}
                className={`w-full px-3 py-1.5 text-left transition-colors flex flex-col gap-0.5 ${
                  active ? 'bg-amber-500/15 dark:bg-amber-500/15' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-gray-900 dark:text-zinc-100 truncate">
                    {suggestion.label}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded border text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${kindBadgeStyles[suggestion.kind]}`}
                  >
                    {suggestion.kind}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-mono truncate">
                  {suggestion.detail}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body
  );
};

interface VariableInspectorPortalProps {
  anchor: HTMLElement | null;
  descriptions: VariableDescription[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onEditResponse?: (expression: string) => void;
}

export const VariableInspectorPortal: React.FC<VariableInspectorPortalProps> = ({
  anchor,
  descriptions,
  onMouseEnter,
  onMouseLeave,
  onEditResponse,
}) => {
  const [position, setPosition] = useState<PortalPosition | null>(null);

  useLayoutEffect(() => {
    const update = () => setPosition(computePosition(anchor, 130, 320));
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor, descriptions.length]);

  if (!position || descriptions.length === 0) return null;

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ top: position.top, left: position.left, width: position.width }}
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-[115] rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-2.5 space-y-2"
    >
      {descriptions.map((item, index) => {
        const isResp = isResponseVariable(item.name);
        return (
          <div
            key={`${item.name}-${index}`}
            className="rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.03] px-2.5 py-2 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {item.status === 'defined' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                {item.status === 'response' && <Link2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />}
                {item.status === 'dynamic' && <Sparkles className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />}
                {item.status === 'missing' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                <code className="text-xs font-mono font-bold text-gray-900 dark:text-zinc-100 truncate">
                  {isResp ? '$response' : `{{${item.name}}}`}
                </code>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.status === 'defined'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : item.status === 'response'
                        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : item.status === 'dynamic'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {item.status === 'defined'
                    ? `✓ ${item.source}`
                    : item.status === 'response'
                      ? '✓ Resposta vinculada'
                      : item.status === 'dynamic'
                        ? '✓ Dinâmica'
                        : '✕ Não reconhecida'}
                </span>
                {isResp && onEditResponse && (
                  <button
                    type="button"
                    onClick={() => onEditResponse(item.name)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-300 hover:bg-violet-500/25"
                  >
                    <Settings2 className="w-3 h-3" />
                    Configurar
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] font-mono text-gray-600 dark:text-zinc-300 break-all line-clamp-2">
              {item.value}
            </p>
            {item.preview !== undefined && (
              <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 break-all line-clamp-2">
                Valor atual: {item.preview || '(vazio)'}
              </p>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
};

