import { SearchQuery } from '@codemirror/search';
import { EditorSelection, StateEffect, StateField, type EditorState, type Text } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

export type SearchDirection = 'next' | 'previous';

export interface SearchSummary {
  total: number;
  capped: boolean;
  current: number;
}

interface SearchMatch {
  to: number;
  from: number;
}

interface SearchResult {
  term: string;
  capped: boolean;
  matches: SearchMatch[];
}

const maxSearchMatches = 10_000;

const setSearchTerm = StateEffect.define<string>();

const emptyResult: SearchResult = { term: '', capped: false, matches: [] };

export const emptySearchSummary: SearchSummary = { total: 0, capped: false, current: 0 };

const matchMark = Decoration.mark({ class: 'cm-vulpes-search-match' });

const currentMatchMark = Decoration.mark({ class: 'cm-vulpes-search-match cm-vulpes-search-current' });

function findMatches(doc: Text, term: string): SearchResult {
  if (!term) return emptyResult;
  const matches: SearchMatch[] = [];
  const cursor = new SearchQuery({ search: term, literal: true }).getCursor(doc);
  for (let step = cursor.next(); !step.done; step = cursor.next()) {
    if (matches.length === maxSearchMatches) return { term, capped: true, matches };
    matches.push({ from: step.value.from, to: step.value.to });
  }
  return { term, capped: false, matches };
}

const searchField = StateField.define<SearchResult>({
  create: () => emptyResult,
  update(result, transaction) {
    let term = result.term;
    for (const effect of transaction.effects) {
      if (effect.is(setSearchTerm)) term = effect.value;
    }
    if (term === result.term && !transaction.docChanged) return result;
    return findMatches(transaction.newDoc, term);
  },
});

function firstMatchFrom(matches: SearchMatch[], position: number) {
  let low = 0;
  let high = matches.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (matches[middle].from < position) low = middle + 1;
    else high = middle;
  }
  return low;
}

function currentMatchIndex(state: EditorState) {
  const { matches } = state.field(searchField);
  const { from, to } = state.selection.main;
  const index = firstMatchFrom(matches, from);
  const match = matches[index];
  return match && match.from === from && match.to === to ? index : -1;
}

export function searchSummary(state: EditorState): SearchSummary {
  const { matches, capped } = state.field(searchField);
  return { total: matches.length, capped, current: currentMatchIndex(state) + 1 };
}

export function searchSummaryChanged(update: ViewUpdate) {
  const searchChanged = update.state.field(searchField) !== update.startState.field(searchField);
  if (!searchChanged && !update.selectionSet) return false;
  const before = searchSummary(update.startState);
  const after = searchSummary(update.state);
  return before.total !== after.total || before.capped !== after.capped || before.current !== after.current;
}

function revealMatch(view: EditorView, match: SearchMatch) {
  view.dispatch({
    userEvent: 'select.search',
    selection: EditorSelection.single(match.from, match.to),
    effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
  });
}

export function applySearchTerm(view: EditorView, term: string) {
  view.dispatch({ effects: setSearchTerm.of(term) });
  const { matches } = view.state.field(searchField);
  if (matches.length === 0) return;
  const index = firstMatchFrom(matches, view.state.selection.main.from);
  revealMatch(view, matches[index % matches.length]);
}

export function selectSearchMatch(view: EditorView, direction: SearchDirection) {
  const { matches } = view.state.field(searchField);
  if (matches.length === 0) return;
  const { from, to } = view.state.selection.main;
  const index = direction === 'next' ? firstMatchFrom(matches, to) : firstMatchFrom(matches, from) - 1;
  revealMatch(view, matches[(index + matches.length) % matches.length]);
}

function visibleMatchDecorations(view: EditorView): DecorationSet {
  const { matches } = view.state.field(searchField);
  if (matches.length === 0) return Decoration.none;
  const current = currentMatchIndex(view.state);
  const marks = [];
  for (const { from, to } of view.visibleRanges) {
    for (let index = firstMatchFrom(matches, from); index < matches.length && matches[index].from < to; index++) {
      const mark = index === current ? currentMatchMark : matchMark;
      marks.push(mark.range(matches[index].from, matches[index].to));
    }
  }
  return Decoration.set(marks);
}

const searchHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = visibleMatchDecorations(view);
    }
    update(update: ViewUpdate) {
      const searchChanged = update.state.field(searchField) !== update.startState.field(searchField);
      if (searchChanged || update.selectionSet || update.viewportChanged) this.decorations = visibleMatchDecorations(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

const searchTheme = EditorView.baseTheme({
  '.cm-vulpes-search-match': {
    borderRadius: '2px',
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  '.cm-vulpes-search-current': {
    outline: '1px solid #f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.55)',
  },
});

export const editorSearch = [searchField, searchHighlighter, searchTheme];
