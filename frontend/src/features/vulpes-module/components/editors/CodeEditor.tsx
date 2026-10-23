import { basicSetup } from 'codemirror';
import { xml } from '@codemirror/lang-xml';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { indentWithTab } from '@codemirror/commands';
import { useTheme } from '../../../../hooks/use-theme';
import { javascript } from '@codemirror/lang-javascript';
import type { RawLanguage } from '../../../../interfaces/VulpesInterfaces';
import { Annotation, Compartment, EditorState, Prec } from '@codemirror/state';
import { buildCodeEditorTheme } from '../../../shared/functions/CodeEditorTheme';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import { resolveSqlEditorColors } from '../../../settings/constants/SqlEditorThemePresets';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { keymap, Decoration, EditorView, ViewPlugin, ViewUpdate, DecorationSet, MatchDecorator, placeholder as placeholderExtension } from '@codemirror/view';
import { editorSearch, searchSummary, applySearchTerm, selectSearchMatch, searchSummaryChanged, type SearchSummary, type SearchDirection } from '../../functions/EditorSearch';

export type CodeLanguage = RawLanguage | 'graphql';

export interface CodeEditorHandle {
  selectMatch: (direction: SearchDirection) => void;
}

interface CodeEditorProps {
  value: string;
  readOnly?: boolean;
  onRun?: () => void;
  onSave?: () => void;
  onFind?: () => void;
  placeholder?: string;
  searchQuery?: string;
  lineWrapping?: boolean;
  language?: CodeLanguage;
  onChange?: (value: string) => void;
  onSearchChange?: (summary: SearchSummary) => void;
}

const externalChange = Annotation.define<boolean>();

const variableDecorator = new MatchDecorator({
  regexp: /\{\{[^{}]+\}\}/g,
  decoration: Decoration.mark({ class: 'cm-vulpes-variable' }),
});

const variableHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = variableDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = variableDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

const variableTheme = EditorView.baseTheme({
  '.cm-vulpes-variable': {
    color: '#f59e0b',
    borderRadius: '3px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
});

const languageExtension = (language: CodeLanguage) => {
  switch (language) {
    case 'xml':
      return xml();
    case 'json':
      return json();
    case 'html':
      return html();
    case 'javascript':
      return javascript();
    default:
      return [];
  }
};

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({
  value,
  onRun,
  onSave,
  onFind,
  onChange,
  placeholder,
  searchQuery,
  onSearchChange,
  readOnly = false,
  language = 'text',
  lineWrapping = false,
}, ref) => {
  const { theme } = useTheme();
  const lastValueRef = useRef(value);
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onRun, onSave, onFind, onChange, onSearchChange });
  callbacks.current = { onRun, onSave, onFind, onChange, onSearchChange };
  const editorTheme = useGeneralConfigsStore((state) => state.sqlEditorTheme);
  const moduleConfig = useGeneralConfigsStore((state) => state.modules['vulpes']);
  const customTheme = moduleConfig.theme === 'custom' ? moduleConfig.customTheme : null;
  const colors = useMemo(
    () => resolveSqlEditorColors(editorTheme, theme === 'dark', customTheme),
    [editorTheme, theme, customTheme]
  );
  const compartments = useMemo(
    () => ({ theme: new Compartment(), language: new Compartment(), readOnly: new Compartment(), wrapping: new Compartment() }),
    []
  );

  useEffect(() => {
    const runCommand = (command: () => void) => () => {
      command();
      return true;
    };
    const focusSearch = () => {
      if (!callbacks.current.onFind) return false;
      callbacks.current.onFind();
      return true;
    };
    const view = new EditorView({
      parent: containerRef.current as HTMLDivElement,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.highest(
            keymap.of([
              { key: 'Mod-f', run: focusSearch },
              { key: 'Mod-Enter', run: runCommand(() => callbacks.current.onRun?.()) },
              { key: 'Mod-s', preventDefault: true, run: runCommand(() => callbacks.current.onSave?.()) },
            ])
          ),
          basicSetup,
          editorSearch,
          variableTheme,
          variableHighlighter,
          keymap.of([indentWithTab]),
          compartments.language.of(languageExtension(language)),
          compartments.readOnly.of(EditorState.readOnly.of(readOnly)),
          compartments.wrapping.of(lineWrapping ? EditorView.lineWrapping : []),
          compartments.theme.of(buildCodeEditorTheme(colors, editorTheme.fontSize)),
          placeholder ? placeholderExtension(placeholder) : [],
          EditorView.updateListener.of((update) => {
            if (searchSummaryChanged(update)) callbacks.current.onSearchChange?.(searchSummary(update.state));
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || update.transactions.some((transaction) => transaction.annotation(externalChange))) return;
            const nextValue = update.state.doc.toString();
            lastValueRef.current = nextValue;
            callbacks.current.onChange?.(nextValue);
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === lastValueRef.current) return;
    lastValueRef.current = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: externalChange.of(true),
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || searchQuery === undefined) return;
    applySearchTerm(view, searchQuery);
    callbacks.current.onSearchChange?.(searchSummary(view.state));
  }, [searchQuery]);

  useImperativeHandle(
    ref,
    () => ({
      selectMatch: (direction: SearchDirection) => {
        if (viewRef.current) selectSearchMatch(viewRef.current, direction);
      },
    }),
    []
  );

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.theme.reconfigure(buildCodeEditorTheme(colors, editorTheme.fontSize)) });
  }, [colors, editorTheme.fontSize, compartments]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.language.reconfigure(languageExtension(language)) });
  }, [language, compartments]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.readOnly.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly, compartments]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.wrapping.reconfigure(lineWrapping ? EditorView.lineWrapping : []) });
  }, [lineWrapping, compartments]);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden" />
  );
});

export default CodeEditor;
