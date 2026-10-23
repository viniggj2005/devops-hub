import { ChevronDown } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useDismiss } from '../../../shared/hooks/useDismiss';
import { HTTP_METHODS, methodColor } from '../../functions/RequestDefaults';

interface MethodSelectProps {
  method: string;
  onChange: (method: string) => void;
}

const MethodSelect: React.FC<MethodSelectProps> = ({ method, onChange }) => {
  const [open, setOpen] = useState(false);
  const [customMethod, setCustomMethod] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss(containerRef, open, () => setOpen(false));

  const choose = (nextMethod: string) => {
    const normalized = nextMethod.trim().toUpperCase();
    if (normalized) onChange(normalized);
    setCustomMethod('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`h-full flex items-center gap-1.5 pl-3 pr-2 text-xs font-extrabold tracking-wide ${methodColor(method)} hover:bg-gray-100 dark:hover:bg-white/5 transition-colors`}
      >
        <span className="w-14 text-left truncate">{method}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-44 py-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl">
          {HTTP_METHODS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className={`w-full px-3 py-1.5 text-left text-xs font-bold ${methodColor(option)} hover:bg-amber-500/10 ${option === method ? 'bg-amber-500/10' : ''}`}
            >
              {option}
            </button>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              choose(customMethod);
            }}
            className="px-2 pt-1 mt-1 border-t border-gray-100 dark:border-white/10"
          >
            <input
              value={customMethod}
              placeholder="Outro método…"
              onChange={(event) => setCustomMethod(event.target.value)}
              className="w-full rounded-md bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-white/10 px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-amber-500"
            />
          </form>
        </div>
      )}
    </div>
  );
};

export default MethodSelect;
