import React from 'react';
import { iconButtonClass } from './FormStyles';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { SearchSummary } from '../../functions/EditorSearch';

interface SearchBarProps {
  value: string;
  onNext: () => void;
  placeholder?: string;
  onPrevious: () => void;
  summary: SearchSummary;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

const summaryLabel = ({ total, capped, current }: SearchSummary) => {
  if (total === 0) return 'Nenhum resultado';
  return `${current || '–'}/${total}${capped ? '+' : ''}`;
};

const SearchBar: React.FC<SearchBarProps> = ({ value, onNext, placeholder, onPrevious, summary, onChange, inputRef }) => {
  const hasMatches = summary.total > 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      onChange('');
      return;
    }
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (event.shiftKey) onPrevious();
    else onNext();
  };

  return (
    <div className="flex items-center gap-1 h-7 w-64 min-w-0 pl-2 pr-0.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20">
      <Search className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-zinc-500" />
      <input
        ref={inputRef}
        value={value}
        spellCheck={false}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onChange={(event) => onChange(event.target.value)}
        className="flex-1 min-w-0 bg-transparent text-[11px] text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none"
      />
      {value && (
        <>
          <span
            className={`flex-shrink-0 text-[10px] font-semibold tabular-nums ${
              hasMatches ? 'text-gray-500 dark:text-zinc-400' : 'text-red-500 dark:text-red-400'
            }`}
          >
            {summaryLabel(summary)}
          </span>
          <button type="button" title="Anterior (Shift+Enter)" disabled={!hasMatches} onClick={onPrevious} className={iconButtonClass}>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Próximo (Enter)" disabled={!hasMatches} onClick={onNext} className={iconButtonClass}>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Limpar (Esc)" onClick={() => onChange('')} className={iconButtonClass}>
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
};

export default SearchBar;
