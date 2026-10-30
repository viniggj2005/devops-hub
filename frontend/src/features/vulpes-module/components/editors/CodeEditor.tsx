import { basicSetup } from 'codemirror';
import { xml } from '@codemirror/lang-xml';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { indentWithTab } from '@codemirror/commands';
import { useTheme } from '../../../../hooks/use-theme';
import { javascript } from '@codemirror/lang-javascript';
import type { RawLanguage } from '../../../../interfaces/VulpesInterfaces';
import { buildCodeEditorTheme } from '../../../shared/functions/CodeEditorTheme';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import { resolveSqlEditorColors } from '../../../settings/constants/SqlEditorThemePresets';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Annotation, Compartment, EditorState, Prec, RangeSetBuilder } from '@codemirror/state';
import { useVariableScope, type VariableScopeValue } from '../../contexts/VariableScopeContext';
import { autocompletion, startCompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import {
  buildSuggestions,
  describeVariable,
  filterSuggestions,
  findVariableQuery,
  isResponseVariable,
  suggestionInsertion,
} from '../../functions/VariableSuggestions';
import {
  keymap,
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  hoverTooltip,
  DecorationSet,
  placeholder as placeholderExtension,
} from '@codemirror/view';
import {
  editorSearch,
  searchSummary,
  applySearchTerm,
  selectSearchMatch,
  type SearchSummary,
  searchSummaryChanged,
  type SearchDirection,
} from '../../functions/EditorSearch';

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
const scopeRefreshAnnotation = Annotation.define<boolean>();

const definedDecoration = Decoration.mark({ class: 'cm-vulpes-variable cm-vulpes-variable-defined' });
const dynamicDecoration = Decoration.mark({ class: 'cm-vulpes-variable cm-vulpes-variable-dynamic' });
const missingDecoration = Decoration.mark({ class: 'cm-vulpes-variable cm-vulpes-variable-missing' });
const responseDecoration = Decoration.mark({ class: 'cm-vulpes-variable cm-vulpes-variable-response' });

const buildVariableDecorations = (view: EditorView, scope: VariableScopeValue): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();
  const pattern = /\{\{([^{}]+)\}\}/g;
  for (const { from, to } of view.visibleRanges) {
    const slice = view.state.doc.sliceString(from, to);
    pattern.lastIndex = 0;
    let match = pattern.exec(slice);
    while (match !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      const name = match[1].trim();
      const info = describeVariable(name, scope.variables, scope.requests, false, scope.responsesByItemId);
      const deco =
        info.status === 'dynamic'
          ? dynamicDecoration
          : info.status === 'response'
            ? responseDecoration
            : info.status === 'defined'
              ? definedDecoration
              : missingDecoration;
      builder.add(start, end, deco);
      match = pattern.exec(slice);
    }
  }
  return builder.finish();
};

const createVariableHighlighter = (scopeRef: React.MutableRefObject<VariableScopeValue>) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildVariableDecorations(view, scopeRef.current);
      }
      update(update: ViewUpdate) {
        const refreshed = update.transactions.some((tr) => tr.annotation(scopeRefreshAnnotation));
        if (update.docChanged || update.viewportChanged || refreshed) {
          this.decorations = buildVariableDecorations(update.view, scopeRef.current);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );

const createVariableHoverTooltip = (scopeRef: React.MutableRefObject<VariableScopeValue>) =>
  hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const pattern = /\{\{([^{}]+)\}\}/g;
    let match = pattern.exec(line.text);
    while (match !== null) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      if (pos >= from && pos <= to) {
        const rawName = match[1].trim();
        const scope = scopeRef.current;
        const info = describeVariable(rawName, scope.variables, scope.requests, false, scope.responsesByItemId);
        return {
          pos: from,
          end: to,
          above: true,
          create() {
            const dom = document.createElement('div');
            dom.className = 'cm-vulpes-tooltip';

            const header = document.createElement('div');
            header.className = 'cm-vulpes-tooltip-header';

            const title = document.createElement('code');
            title.className = 'cm-vulpes-tooltip-title';
            title.textContent = isResponseVariable(rawName) ? '$response' : `{{${rawName}}}`;

            const badge = document.createElement('span');
            badge.className = `cm-vulpes-tooltip-badge cm-vulpes-tooltip-badge-${info.status}`;
            badge.textContent =
              info.status === 'defined'
                ? `✓ ${info.source}`
                : info.status === 'response'
                  ? '✓ Resposta vinculada'
                  : info.status === 'dynamic'
                    ? '✓ Dinâmica'
                    : '✕ Não reconhecida';

            header.appendChild(title);
            header.appendChild(badge);
            dom.appendChild(header);

            const body = document.createElement('div');
            body.className = 'cm-vulpes-tooltip-body';
            body.textContent = info.value;
            dom.appendChild(body);

            if (info.preview !== undefined) {
              const preview = document.createElement('div');
              preview.className = 'cm-vulpes-tooltip-preview';
              preview.textContent = `Valor atual: ${info.preview || '(vazio)'}`;
              dom.appendChild(preview);
            }

            if (isResponseVariable(rawName)) {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'cm-vulpes-tooltip-btn';
              btn.textContent = 'Configurar vínculo de resposta…';
              btn.onclick = (event) => {
                event.preventDefault();
                scope.openResponseBuilder({
                  initialExpression: rawName,
                  onApply: (expression: string) => {
                    view.dispatch({
                      changes: { from, to, insert: expression },
                    });
                  },
                });
              };
              dom.appendChild(btn);
            }

            return { dom };
          },
        };
      }
      match = pattern.exec(line.text);
    }
    return null;
  });

const createVariableCompletionSource =
  (scopeRef: React.MutableRefObject<VariableScopeValue>) => (context: CompletionContext) => {
    const docText = context.state.doc.toString();
    const queryState = findVariableQuery(docText, context.pos, context.explicit);
    if (!queryState) return null;

    const scope = scopeRef.current;
    const allSuggestions = buildSuggestions(
      scope.variables,
      scope.requests,
      scope.responsesByItemId
    );
    const filtered = filterSuggestions(allSuggestions, queryState.query);

    const options: Completion[] = [];

    if (scope.requests.length > 0) {
      options.push({
        label: '🔗 Vincular resposta de outra requisição…',
        detail: 'construtor visual',
        info: 'Escolher requisição, inspecionar JSON e inserir {{$response ...}}',
        boost: 99,
        apply: (view) => {
          scope.openResponseBuilder({
            onApply: (expression: string) => {
              view.dispatch({
                changes: {
                  from: queryState.from,
                  to: queryState.to,
                  insert: expression,
                },
              });
              view.focus();
            },
          });
        },
      });
    }

    for (const suggestion of filtered) {
      options.push({
        label: suggestion.label,
        detail: `${suggestion.kind} · ${suggestion.detail}`,
        apply: (view) => {
          const { insert, from, to, cursor } = suggestionInsertion(queryState, suggestion);
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: cursor },
          });
        },
      });
    }

    return {
      from: queryState.from,
      to: context.pos,
      filter: false,
      options,
    };
  };

const variableTheme = EditorView.baseTheme({
  '.cm-vulpes-variable': {
    borderRadius: '3px',
    padding: '0 2px',
  },
  '.cm-vulpes-variable-defined': {
    color: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  '.cm-vulpes-variable-response': {
    color: '#a78bfa',
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
  },
  '.cm-vulpes-variable-dynamic': {
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  '.cm-vulpes-variable-missing': {
    color: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.14)',
    textDecoration: 'underline wavy rgba(244, 63, 94, 0.8)',
  },
  '.cm-tooltip.cm-vulpes-tooltip, .cm-vulpes-tooltip': {
    padding: '8px 10px',
    borderRadius: '10px',
    backgroundColor: '#18181b',
    color: '#f4f4f5',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 14px 30px rgba(0, 0, 0, 0.35)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '11px',
    maxWidth: '380px',
  },
  '.cm-vulpes-tooltip-header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
  },
  '.cm-vulpes-tooltip-title': {
    fontWeight: '700',
    color: '#fafafa',
  },
  '.cm-vulpes-tooltip-badge': {
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  '.cm-vulpes-tooltip-badge-defined': {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    color: '#6ee7b7',
  },
  '.cm-vulpes-tooltip-badge-response': {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#c4b5fd',
  },
  '.cm-vulpes-tooltip-badge-dynamic': {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    color: '#7dd3fc',
  },
  '.cm-vulpes-tooltip-badge-missing': {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    color: '#fda4af',
  },
  '.cm-vulpes-tooltip-body': {
    color: '#d4d4d8',
    wordBreak: 'break-all',
  },
  '.cm-vulpes-tooltip-preview': {
    marginTop: '4px',
    color: '#34d399',
    wordBreak: 'break-all',
  },
  '.cm-vulpes-tooltip-btn': {
    marginTop: '6px',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    color: '#ddd6fe',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'center',
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
  const scope = useVariableScope();
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

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
    () => ({
      theme: new Compartment(),
      language: new Compartment(),
      readOnly: new Compartment(),
      wrapping: new Compartment(),
    }),
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
    const triggerVariableCompletion = (targetView: EditorView) => {
      if (targetView.state.readOnly) return false;
      startCompletion(targetView);
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
              { key: 'Mod-Space', run: triggerVariableCompletion },
              { key: 'Mod-/', run: triggerVariableCompletion },
              { key: 'Mod-Enter', run: runCommand(() => callbacks.current.onRun?.()) },
              { key: 'Mod-s', preventDefault: true, run: runCommand(() => callbacks.current.onSave?.()) },
            ])
          ),
          basicSetup,
          editorSearch,
          variableTheme,
          createVariableHighlighter(scopeRef),
          createVariableHoverTooltip(scopeRef),
          autocompletion({
            override: [createVariableCompletionSource(scopeRef)],
            activateOnTyping: true,
          }),
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
    if (!view) return;
    view.dispatch({ annotations: scopeRefreshAnnotation.of(true) });
  }, [scope.variables, scope.requests, scope.responsesByItemId]);

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
