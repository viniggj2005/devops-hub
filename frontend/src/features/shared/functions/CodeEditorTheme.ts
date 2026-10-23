import { tags } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';
import { hexToRgb } from '../../settings/functions/CustomThemePalette';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { isDarkBackground } from '../../settings/constants/SqlEditorThemePresets';
import type { SqlEditorColors } from '../../../interfaces/GeneralConfigsInterfaces';

export const withAlpha = (hex: string, alpha: number) => `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`;

const selectionStateClass = EditorView.editorAttributes.compute(['selection'], (state): Record<string, string> =>
  state.selection.ranges.some((range) => !range.empty) ? { class: 'cm-has-selection' } : {}
);

export function buildCodeEditorTheme(colors: SqlEditorColors, fontSize: number) {
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
        '&.cm-has-selection .cm-activeLine': { backgroundColor: 'transparent' },
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
    selectionStateClass,
    syntaxHighlighting(highlightStyle),
  ];
}
