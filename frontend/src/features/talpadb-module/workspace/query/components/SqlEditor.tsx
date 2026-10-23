import { basicSetup } from 'codemirror';
import { indentWithTab } from '@codemirror/commands';
import { useTheme } from '../../../../../hooks/use-theme';
import { sql, type SQLNamespace } from '@codemirror/lang-sql';
import { engineInfo } from '../../../functions/DatabaseEngines';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { diagnosticCount, setDiagnostics } from '@codemirror/lint';
import type { DatabaseEngine } from '../../../../../interfaces/TalpadbInterfaces';
import { buildCodeEditorTheme } from '../../../../shared/functions/CodeEditorTheme';
import { useGeneralConfigsStore } from '../../../../settings/store/GeneralConfigsStore';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { resolveSqlEditorColors } from '../../../../settings/constants/SqlEditorThemePresets';

export interface SqlEditorHandle {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getSelection: () => { text: string; from: number; to: number };
  markError: (position: number | null, message?: string) => void;
}

interface SqlEditorProps {
  readOnly?: boolean;
  onRun?: () => void;
  onSave?: () => void;
  placeholder?: string;
  initialValue?: string;
  schema?: SQLNamespace;
  defaultSchema?: string;
  engine?: DatabaseEngine;
  onExplain?: (analyze: boolean) => void;
}

const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(
  (
    {
      onRun,
      schema,
      onSave,
      onExplain,
      placeholder,
      readOnly = false,
      initialValue = '',
      engine = 'postgres',
      defaultSchema = 'public',
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
            compartments.theme.of(buildCodeEditorTheme(editorColors, editorTheme.fontSize)),
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
        effects: compartments.theme.reconfigure(buildCodeEditorTheme(editorColors, editorTheme.fontSize)),
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
