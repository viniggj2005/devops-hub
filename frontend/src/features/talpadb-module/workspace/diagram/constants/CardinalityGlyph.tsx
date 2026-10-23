import React from 'react';
import type { RelationEndKind } from '../../../functions/DiagramEdges';

export const GLYPH_WIDTH = 24;
export const GLYPH_HEIGHT = 16;

export const cardinalityLabels: Record<RelationEndKind, string> = {
  one: 'exatamente um',
  zeroOrOne: 'zero ou um',
  zeroOrMany: 'zero ou muitos',
};

interface CardinalityGlyphProps {
  color: string;
  background: string;
  kind: RelationEndKind;
}

const CardinalityGlyph: React.FC<CardinalityGlyphProps> = ({ kind, color, background }) => {
  const middle = GLYPH_HEIGHT / 2;
  const strokeProps = { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, fill: 'none' };
  const bar = (positionX: number) => (
    <line key={`bar-${positionX}`} x1={positionX} y1={middle - 6} x2={positionX} y2={middle + 6} {...strokeProps} />
  );
  const circle = (positionX: number) => (
    <circle key={`circle-${positionX}`} cx={positionX} cy={middle} r={3.5} stroke={color} strokeWidth={1.5} fill={background} />
  );

  if (kind === 'one') return <g>{[bar(18), bar(13)]}</g>;
  if (kind === 'zeroOrOne') return <g>{[bar(18), circle(9)]}</g>;
  return (
    <g>
      <path
        d={`M 13 ${middle} L ${GLYPH_WIDTH} ${middle - 6} M 13 ${middle} L ${GLYPH_WIDTH} ${middle + 6} M 13 ${middle} L ${GLYPH_WIDTH} ${middle}`}
        {...strokeProps}
      />
      {circle(7)}
    </g>
  );
};

export default CardinalityGlyph;

