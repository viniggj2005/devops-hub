import { useVariableScope } from '../../contexts/VariableScopeContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveText, tokenizeVariables, VariableMap } from '../../functions/Variables';
import { VariableAutocompletePortal, VariableInspectorPortal } from './VariableAutocompletePortal';
import { buildSuggestions, describeVariable, filterSuggestions, findVariableQuery, suggestionInsertion, type VariableQuery, type VariableSuggestion } from '../../functions/VariableSuggestions';

interface VariableInputProps {
  value: string;
  masked?: boolean;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  onEnter?: () => void;
  placeholder?: string;
  variables?: VariableMap;
  inputClassName?: string;
  onChange: (value: string) => void;
}

const VariableInput: React.FC<VariableInputProps> = ({
  value,
  onEnter,
  onChange,
  placeholder,
  masked = false,
  compact = false,
  disabled = false,
  className = '',
  inputClassName = '',
  variables: overrideVariables,
}) => {
  const scope = useVariableScope(overrideVariables);
  const { variables, requests, responsesByItemId, openResponseBuilder } = scope;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const explicitModeRef = useRef(false);
  const hoverTimerRef = useRef<number | null>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inspectorHovered, setInspectorHovered] = useState(false);
  const [activeQuery, setActiveQuery] = useState<VariableQuery | null>(null);

  const paddingClass = compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  const sharedTextClass = `${paddingClass} font-mono whitespace-pre`;

  const tokens = useMemo(() => tokenizeVariables(value), [value]);
  const resolved = useMemo(() => resolveText(value, variables), [value, variables]);

  const allSuggestions = useMemo(
    () => buildSuggestions(variables, requests, responsesByItemId),
    [variables, requests, responsesByItemId]
  );

  const filteredSuggestions = useMemo(
    () => (activeQuery ? filterSuggestions(allSuggestions, activeQuery.query) : []),
    [allSuggestions, activeQuery]
  );

  const descriptions = useMemo(() => {
    const seen = new Set<string>();
    const list = [];
    for (const token of tokens) {
      if (token.variable && !seen.has(token.variable)) {
        seen.add(token.variable);
        list.push(describeVariable(token.variable, variables, requests, masked, responsesByItemId));
      }
    }
    return list;
  }, [tokens, variables, requests, masked, responsesByItemId]);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeQuery?.query]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const syncScroll = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (mirrorRef.current) mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  const updateQueryFromCursor = useCallback((text: string, cursor: number | null) => {
    if (cursor === null) {
      explicitModeRef.current = false;
      setActiveQuery(null);
      return;
    }
    const detected = findVariableQuery(text, cursor, explicitModeRef.current);
    if (!detected) explicitModeRef.current = false;
    setActiveQuery(detected);
  }, []);

  const applyInsertion = useCallback(
    (insertionText: string, replaceFrom: number, replaceTo: number, nextCursorPos?: number) => {
      const nextValue = value.slice(0, replaceFrom) + insertionText + value.slice(replaceTo);
      const nextCursor = nextCursorPos ?? replaceFrom + insertionText.length;
      explicitModeRef.current = false;
      onChange(nextValue);
      setActiveQuery(null);
      requestAnimationFrame(() => {
        const element = inputRef.current;
        if (!element) return;
        element.focus();
        element.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [value, onChange]
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: VariableSuggestion) => {
      if (!activeQuery) return;
      const { insert, from, to, cursor } = suggestionInsertion(activeQuery, suggestion);
      applyInsertion(insert, from, to, cursor);
    },
    [activeQuery, applyInsertion]
  );

  const handleOpenResponseBuilder = useCallback(
    (existingExpression?: string) => {
      const querySnapshot = activeQuery;
      explicitModeRef.current = false;
      setActiveQuery(null);
      openResponseBuilder({
        initialExpression: existingExpression,
        onApply: (expression: string) => {
          if (existingExpression) {
            const targetToken = `{{${existingExpression}}}`;
            const tokenIndex = value.indexOf(targetToken);
            if (tokenIndex >= 0) {
              applyInsertion(expression, tokenIndex, tokenIndex + targetToken.length);
              return;
            }
          }
          if (querySnapshot) {
            applyInsertion(expression, querySnapshot.from, querySnapshot.to);
            return;
          }
          const cursor = inputRef.current?.selectionStart ?? value.length;
          applyInsertion(expression, cursor, cursor);
        },
      });
    },
    [activeQuery, openResponseBuilder, value, applyInsertion]
  );

  const variableClass = (name: string) => {
    const info = describeVariable(name, variables, requests, masked, responsesByItemId);
    if (info.status === 'dynamic') {
      return 'rounded px-0.5 bg-sky-500/15 text-sky-600 dark:text-sky-300 ring-1 ring-inset ring-sky-500/30';
    }
    if (info.status === 'response') {
      return 'rounded px-0.5 bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-500/30';
    }
    if (info.status === 'defined') {
      return 'rounded px-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/30';
    }
    return 'rounded px-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/30 underline decoration-wavy decoration-rose-500/70';
  };

  const showInspector =
    !activeQuery && descriptions.length > 0 && (isFocused || isHovered || inspectorHovered);

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => {
        if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        hoverTimerRef.current = window.setTimeout(() => setIsHovered(false), 140);
      }}
      className={`relative min-w-0 ${className}`}
    >
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className={`absolute inset-0 overflow-hidden pointer-events-none text-gray-800 dark:text-zinc-100 ${sharedTextClass}`}
      >
        {tokens.map((token, index) =>
          token.variable === null ? (
            <span key={index}>{masked ? '•'.repeat(token.text.length) : token.text}</span>
          ) : (
            <span key={index} className={variableClass(token.variable)}>
              {token.text}
            </span>
          )
        )}
      </div>

      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        title={descriptions.length > 0 ? resolved : undefined}
        onScroll={syncScroll}
        onKeyUp={syncScroll}
        onSelect={syncScroll}
        onFocus={(event) => {
          setIsFocused(true);
          syncScroll(event);
        }}
        onBlur={() => {
          setIsFocused(false);
          explicitModeRef.current = false;
          setActiveQuery(null);
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          const cursor = event.target.selectionStart;
          onChange(nextValue);
          updateQueryFromCursor(nextValue, cursor);
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && (event.code === 'Space' || event.key === ' ' || event.key === '/')) {
            event.preventDefault();
            explicitModeRef.current = true;
            const cursor = event.currentTarget.selectionStart ?? value.length;
            const detected = findVariableQuery(value, cursor, true);
            setActiveQuery(detected);
            return;
          }

          if (activeQuery) {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (filteredSuggestions.length > 0) {
                setActiveIndex((prev) => (prev + 1) % filteredSuggestions.length);
              }
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (filteredSuggestions.length > 0) {
                setActiveIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
              }
              return;
            }
            if ((event.key === 'Enter' || event.key === 'Tab') && filteredSuggestions[activeIndex]) {
              event.preventDefault();
              handleSelectSuggestion(filteredSuggestions[activeIndex]);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              explicitModeRef.current = false;
              setActiveQuery(null);
              return;
            }
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter?.();
          }
        }}
        className={`relative w-full bg-transparent text-transparent caret-gray-800 dark:caret-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none selection:bg-amber-500/30 disabled:opacity-50 ${sharedTextClass} ${inputClassName}`}
      />

      {activeQuery && (
        <VariableAutocompletePortal
          activeIndex={activeIndex}
          anchor={wrapperRef.current}
          suggestions={filteredSuggestions}
          hasRequests={requests.length > 0}
          onHoverIndex={setActiveIndex}
          onSelect={handleSelectSuggestion}
          onOpenResponseBuilder={() => handleOpenResponseBuilder()}
        />
      )}

      {showInspector && (
        <VariableInspectorPortal
          anchor={wrapperRef.current}
          descriptions={descriptions}
          onEditResponse={(expression) => handleOpenResponseBuilder(expression)}
          onMouseEnter={() => {
            if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
            setInspectorHovered(true);
          }}
          onMouseLeave={() => setInspectorHovered(false)}
        />
      )}
    </div>
  );
};

export default VariableInput;
