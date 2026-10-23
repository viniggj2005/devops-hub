import React, { useMemo, useRef } from 'react';
import { isDynamicVariable, resolveText, tokenizeVariables, VariableMap } from '../../functions/Variables';

interface VariableInputProps {
  value: string;
  className?: string;
  placeholder?: string;
  variables: VariableMap;
  onEnter?: () => void;
  onChange: (value: string) => void;
}

const sharedTextClass = 'px-3 py-2 text-sm font-mono whitespace-pre';

const VariableInput: React.FC<VariableInputProps> = ({ value, variables, placeholder, className = '', onEnter, onChange }) => {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => tokenizeVariables(value), [value]);
  const resolved = useMemo(() => resolveText(value, variables), [value, variables]);
  const hasVariables = tokens.some((token) => token.variable !== null);

  const syncScroll = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (mirrorRef.current) mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  const variableClass = (name: string) => {
    if (isDynamicVariable(name)) return 'rounded-sm bg-sky-500/15 text-sky-600 dark:text-sky-300';
    if (variables.has(name)) return 'rounded-sm bg-amber-500/15 text-amber-700 dark:text-amber-300';
    return 'rounded-sm bg-rose-500/15 text-rose-600 dark:text-rose-400';
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className={`absolute inset-0 overflow-hidden pointer-events-none text-gray-800 dark:text-zinc-100 ${sharedTextClass}`}
      >
        {tokens.map((token, index) =>
          token.variable === null ? (
            <span key={index}>{token.text}</span>
          ) : (
            <span key={index} className={variableClass(token.variable)}>
              {token.text}
            </span>
          )
        )}
      </div>
      <input
        value={value}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        title={hasVariables ? resolved : undefined}
        onScroll={syncScroll}
        onKeyUp={syncScroll}
        onSelect={syncScroll}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onEnter?.();
        }}
        className={`relative w-full bg-transparent text-transparent caret-gray-800 dark:caret-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none selection:bg-amber-500/30 ${sharedTextClass}`}
      />
    </div>
  );
};

export default VariableInput;
