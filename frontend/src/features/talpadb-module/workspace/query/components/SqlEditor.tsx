import { basicSetup } from 'codemirror';
import { tags } from '@lezer/highlight';
import { indentWithTab } from '@codemirror/commands';
import { useTheme } from '../../../../../hooks/use-theme';
import { diagnosticCount, setDiagnostics } from '@codemirror/lint';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { sql, type SQLNamespace } from '@codemirror/lang-sql';
import { engineInfo } from '../../../functions/DatabaseEngines';
import type { DatabaseEngine } from '../../../../../interfaces/TalpadbInterfaces';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { hexToRgb } from '../../../../settings/functions/CustomThemePalette';
import { useGeneralConfigsStore } from '../../../../settings/store/GeneralConfigsStore';
import type { SqlEditorColors } from '../../../../../interfaces/GeneralConfigsInterfaces';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { isDarkBackground, resolveSqlEditorColors } from '../../../../settings/constants/SqlEditorThemePresets';

export interface SqlEditorHandle {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getSelection: () => { text: string; from: number; to: number };
  markError: (position: number | null, message?: string) => void;
}

interface SqlEditorProps {
  readOnly?: boolean;
  engine?: DatabaseEngine;
  onRun?: () => void;
  onSave?: () => void;
  placeholder?: string;
  initialValue?: string;
  schema?: SQLNamespace;
  defaultSchema?: string;
  onExplain?: (analyze: boolean) => void;
}

const withAlpha = (hex: string, alpha: number) => `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`;

function buildTheme(colors: SqlEditorColors, fontSize: number) {
  const dark = isDarkBackground(colors.background);
  const highlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: colors.keyword },
    { tag: tags.typeName, color: colors.type },
    { tag: tags.string, color: colors.string },
    { tag: tags.operator, color: colors.operator },
    { tag: tags.standard(tags.name), color: colors.function },
    { tag: [tags.number, tags.bool, tags.null], color: colors.number },
    { tag: [tags.name, tags.special(tags.string), tags.special(tags.name)], color: colors.identifier },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: colors.comment, fontStyle: 'italic' },
  ]);

  return [
    EditorView.theme(
      {
        '&': {
          height: '100%',
          fontSize: `${fontSize}px`,
          color: colors.foreground,
          backgroundColor: colors.background,
        },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
          lineHeight: '1.6',
        },
        '.cm-gutters': {
          border: 'none',
          color: colors.lineNumbers,
          backgroundColor: colors.background,
          borderRight: `1px solid ${withAlpha(colors.foreground, 0.08)}`,
        },
        '.cm-activeLine': { backgroundColor: colors.activeLine },
        '.cm-activeLineGutter': { backgroundColor: 'transparent', color: colors.foreground },
        '&.cm-focused': { outline: 'none' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: colors.cursor },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
          { backgroundColor: colors.selection },
        '.cm-matchingBracket': { backgroundColor: withAlpha(colors.cursor, 0.2) },
        '.cm-tooltip': {
          overflow: 'hidden',
          borderRadius: '10px',
          color: colors.foreground,
          backgroundColor: colors.background,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          border: `1px solid ${withAlpha(colors.foreground, 0.12)}`,
        },
        '.cm-tooltip-autocomplete > ul > li': { padding: '2px 10px' },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
          color: colors.foreground,
          backgroundColor: colors.selection,
        },
        '.cm-placeholder': { color: colors.lineNumbers },
      },
      { dark }
    ),
    syntaxHighlighting(highlightStyle),
  ];
}

const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(
  (
    {
      initialValue = '',
      readOnly = false,
      engine = 'postgres',
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
    const editorTheme = useGeneralConfigsStore((state) => state.sqlEditorTheme);
    const moduleConfig = useGeneralConfigsStore((state) => state.modules['talpadb']);
    const customTheme = moduleConfig.theme === 'custom' ? moduleConfig.customTheme : null;
    const editorColors = useMemo(
      () => resolveSqlEditorColors(editorTheme, theme === 'dark', customTheme),
      [editorTheme, theme, customTheme]
    );
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
              sql({ dialect: engineInfo(engine).dialect, upperCaseKeywords: true, schema, defaultSchema })
            ),
            compartments.theme.of(buildTheme(editorColors, editorTheme.fontSize)),
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
        effects: compartments.theme.reconfigure(buildTheme(editorColors, editorTheme.fontSize)),
      });
    }, [editorColors, editorTheme.fontSize, compartments]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartments.language.reconfigure(
          sql({ dialect: engineInfo(engine).dialect, upperCaseKeywords: true, schema, defaultSchema })
        ),
      });
    }, [engine, schema, defaultSchema, compartments]);

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
