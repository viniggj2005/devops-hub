import { basicSetup } from 'codemirror';
import { diagnosticCount, setDiagnostics } from '@codemirror/lint';
import { indentWithTab } from '@codemirror/commands';
import { useTheme } from '../../../../../hooks/use-theme';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { PostgreSQL, sql, type SQLNamespace } from '@codemirror/lang-sql';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

export interface SqlEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  getSelection: () => { text: string; from: number; to: number };
  focus: () => void;
  markError: (position: number | null, message?: string) => void;
}

interface SqlEditorProps {
  initialValue?: string;
  readOnly?: boolean;
  placeholder?: string;
  schema?: SQLNamespace;
  defaultSchema?: string;
  onRun?: () => void;
  onExplain?: (analyze: boolean) => void;
  onSave?: () => void;
}

function buildTheme(dark: boolean) {
  return [
    EditorView.theme(
      {
        '&': {
          height: '100%',
          fontSize: '13px',
          backgroundColor: dark ? '#0b1120' : '#ffffff',
          color: dark ? '#e4e4e7' : '#18181b',
        },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
          lineHeight: '1.6',
        },
        '.cm-gutters': {
          backgroundColor: dark ? '#0b1120' : '#f9fafb',
          color: dark ? '#52525b' : '#9ca3af',
          border: 'none',
          borderRight: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
        },
        '.cm-activeLine': {
          backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(6,182,212,0.05)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
          color: dark ? '#a1a1aa' : '#52525b',
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: dark ? '#22d3ee' : '#0891b2' },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
          { backgroundColor: dark ? 'rgba(34,211,238,0.22)' : 'rgba(8,145,178,0.18)' },
        '.cm-matchingBracket': {
          backgroundColor: dark ? 'rgba(34,211,238,0.18)' : 'rgba(8,145,178,0.15)',
        },
        '.cm-tooltip': {
          border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
          backgroundColor: dark ? '#18181b' : '#ffffff',
          color: dark ? '#e4e4e7' : '#18181b',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        },
        '.cm-tooltip-autocomplete > ul > li': { padding: '2px 10px' },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
          backgroundColor: dark ? 'rgba(34,211,238,0.2)' : 'rgba(8,145,178,0.12)',
          color: dark ? '#ffffff' : '#0e7490',
        },
        '.cm-placeholder': { color: dark ? '#52525b' : '#9ca3af' },
      },
      { dark }
    ),
    syntaxHighlighting(dark ? oneDarkHighlightStyle : defaultHighlightStyle),
  ];
}

const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(
  (
    {
      initialValue = '',
      readOnly = false,
      placeholder,
      schema,
      defaultSchema = 'public',
      onRun,
      onExplain,
      onSave,
    },
    ref
  ) => {
    const { theme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const callbacks = useRef({ onRun, onExplain, onSave });
    callbacks.current = { onRun, onExplain, onSave };
    const compartments = useMemo(
      () => ({
        theme: new Compartment(),
        language: new Compartment(),
        readOnly: new Compartment(),
      }),
      []
    );

    useEffect(() => {
      const runCommand = (command: () => void) => () => {
        command();
        return true;
      };

      const view = new EditorView({
        parent: containerRef.current as HTMLDivElement,
        state: EditorState.create({
          doc: initialValue,
          extensions: [
            Prec.highest(
              keymap.of([
                { key: 'Mod-Enter', run: runCommand(() => callbacks.current.onRun?.()) },
                {
                  key: 'F5',
                  run: runCommand(() => callbacks.current.onRun?.()),
                  preventDefault: true,
                },
                {
                  key: 'F7',
                  run: runCommand(() => callbacks.current.onExplain?.(false)),
                  preventDefault: true,
                },
                {
                  key: 'Shift-F7',
                  run: runCommand(() => callbacks.current.onExplain?.(true)),
                  preventDefault: true,
                },
                {
                  key: 'Mod-s',
                  run: runCommand(() => callbacks.current.onSave?.()),
                  preventDefault: true,
                },
              ])
            ),
            basicSetup,
            keymap.of([indentWithTab]),
            compartments.language.of(
              sql({ dialect: PostgreSQL, upperCaseKeywords: true, schema, defaultSchema })
            ),
            compartments.theme.of(buildTheme(theme === 'dark')),
            compartments.readOnly.of([
              EditorState.readOnly.of(readOnly),
              EditorView.editable.of(!readOnly),
            ]),
            placeholder ? placeholderExtension(placeholder) : [],
            // Ao editar, some o destaque de erro da última execução.
            EditorView.updateListener.of((update) => {
              if (update.docChanged && diagnosticCount(update.state) > 0) {
                queueMicrotask(() => update.view.dispatch(setDiagnostics(update.view.state, [])));
              }
            }),
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // O editor é criado uma única vez; mudanças de props são aplicadas via compartments abaixo.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartments.theme.reconfigure(buildTheme(theme === 'dark')),
      });
    }, [theme, compartments]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartments.language.reconfigure(
          sql({ dialect: PostgreSQL, upperCaseKeywords: true, schema, defaultSchema })
        ),
      });
    }, [schema, defaultSchema, compartments]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartments.readOnly.reconfigure([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
      });
    }, [readOnly, compartments]);

    useImperativeHandle(
      ref,
      () => ({
        getValue: () => viewRef.current?.state.doc.toString() ?? '',
        setValue: (value: string) => {
          const view = viewRef.current;
          if (!view) return;
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
        },
        getSelection: () => {
          const view = viewRef.current;
          if (!view) return { text: '', from: 0, to: 0 };
          const range = view.state.selection.main;
          return {
            text: view.state.sliceDoc(range.from, range.to),
            from: range.from,
            to: range.to,
          };
        },
        focus: () => viewRef.current?.focus(),
        markError: (position: number | null, message = 'Erro') => {
          const view = viewRef.current;
          if (!view) return;
          if (position === null) {
            view.dispatch(setDiagnostics(view.state, []));
            return;
          }
          const length = view.state.doc.length;
          const from = Math.max(0, Math.min(position, length));
          const line = view.state.doc.lineAt(from);
          const word = /^[\w$."]+/.exec(line.text.slice(from - line.from));
          const to = Math.min(length, from + Math.max(1, word ? word[0].length : 1));
          view.dispatch(setDiagnostics(view.state, [{ from, to, severity: 'error', message }]));
          view.dispatch({ selection: { anchor: from }, scrollIntoView: true });
        },
      }),
      []
    );

    // F5 recarrega a janela globalmente (main.tsx); dentro do editor ele executa a query.
    const stopGlobalShortcuts = (event: React.KeyboardEvent) => {
      if (event.key === 'F5') event.stopPropagation();
    };

    return (
      <div
        ref={containerRef}
        onKeyDown={stopGlobalShortcuts}
        className="h-full w-full overflow-hidden"
      />
    );
  }
);

export default SqlEditor;
