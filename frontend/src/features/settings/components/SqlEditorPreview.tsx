import React from 'react';
import { SqlEditorColorKey, SqlEditorColors } from '../../../interfaces/GeneralConfigsInterfaces';

type TokenKind = Extract<
  SqlEditorColorKey,
  'keyword' | 'type' | 'string' | 'number' | 'comment' | 'operator' | 'identifier' | 'function' | 'foreground'
>;

type Token = [TokenKind, string];

const sampleLines: Token[][] = [
  [['comment', '-- Pedidos dos últimos 30 dias']],
  [['keyword', 'SELECT '], ['identifier', 'c.nome'], ['foreground', ', '], ['function', 'count'], ['foreground', '(*) '], ['keyword', 'AS '], ['identifier', 'total']],
  [['keyword', 'FROM '], ['identifier', 'public.pedidos p']],
  [['keyword', 'JOIN '], ['identifier', 'clientes c '], ['keyword', 'ON '], ['identifier', 'c.id '], ['operator', '= '], ['identifier', 'p.cliente_id']],
  [['keyword', 'WHERE '], ['identifier', 'p.criado_em '], ['operator', '> '], ['function', 'now'], ['foreground', '() '], ['operator', '- '], ['type', 'interval '], ['string', "'30 days'"]],
  [['keyword', '  AND '], ['identifier', 'p.valor '], ['operator', '>= '], ['number', '100.50']],
  [['keyword', 'GROUP BY '], ['identifier', 'c.nome'], ['keyword', ' LIMIT '], ['number', '10'], ['foreground', ';']],
];

const activeLineIndex = 3;

interface SqlEditorPreviewProps {
  fontSize: number;
  colors: SqlEditorColors;
}

const SqlEditorPreview: React.FC<SqlEditorPreviewProps> = ({ colors, fontSize }) => (
  <div
    style={{ backgroundColor: colors.background, color: colors.foreground, fontSize }}
    className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 py-3 font-mono leading-relaxed"
  >
    {sampleLines.map((line, lineIndex) => (
      <div
        key={lineIndex}
        style={{ backgroundColor: lineIndex === activeLineIndex ? colors.activeLine : undefined }}
        className="flex whitespace-pre"
      >
        <span style={{ color: lineIndex === activeLineIndex ? colors.foreground : colors.lineNumbers }} className="w-10 shrink-0 select-none pr-3 text-right">
          {lineIndex + 1}
        </span>
        <span>
          {line.map(([kind, text], tokenIndex) => (
            <span
              key={tokenIndex}
              style={{
                color: colors[kind],
                fontStyle: kind === 'comment' ? 'italic' : undefined,
                backgroundColor: lineIndex === 1 && tokenIndex === 1 ? colors.selection : undefined,
              }}
            >
              {text}
            </span>
          ))}
          {lineIndex === activeLineIndex && (
            <span style={{ borderLeft: `2px solid ${colors.cursor}` }} className="ml-px inline-block h-[1.1em] align-middle" />
          )}
        </span>
      </div>
    ))}
  </div>
);

export default SqlEditorPreview;
