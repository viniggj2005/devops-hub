import React, { memo } from 'react';
import type { DiagramPalette } from '../constants/DiagramPalette';
import {
  Point,
  DiagramNode,
  columnBadges,
  DIAGRAM_BADGE_GAP,
  DIAGRAM_PADDING_X,
  diagramBadgeLabels,
  DIAGRAM_ROW_HEIGHT,
  DIAGRAM_BADGE_WIDTH,
  DIAGRAM_HEADER_FONT,
  DIAGRAM_COLUMN_FONT,
  DIAGRAM_HEADER_HEIGHT,
} from '../../../functions/DiagramLayout';

interface DiagramTableNodeProps {
  dimmed: boolean;
  position: Point;
  selected: boolean;
  node: DiagramNode;
  palette: DiagramPalette;
  onOpen: (node: DiagramNode) => void;
  onDragStart: (event: React.MouseEvent, key: string) => void;
}

const fontFamily = (font: string) => font.slice(font.indexOf('px ') + 3);

const DiagramTableNode: React.FC<DiagramTableNodeProps> = ({
  node,
  dimmed,
  palette,
  position,
  selected,
  onOpen,
  onDragStart,
}) => {
  const radius = 8;
  const headerColor = node.table.kind === 'p' ? palette.partitionedHeader : palette.header;
  const tooltip = [node.title, node.table.kind === 'p' ? 'tabela particionada' : '', node.table.comment ?? '']
    .filter(Boolean)
    .join('\n');

  return (
    <g
      transform={`translate(${position.x} ${position.y})`}
      opacity={dimmed ? 0.3 : 1}
      style={{ cursor: 'move' }}
      onMouseDown={(event) => onDragStart(event, node.key)}
      onDoubleClick={() => onOpen(node)}
    >
      <title>{tooltip}</title>
      <rect
        rx={radius}
        width={node.width}
        height={node.height}
        fill={palette.node}
        stroke={selected ? palette.accent : palette.border}
        strokeWidth={selected ? 2 : 1}
      />
      <path
        fill={headerColor}
        d={`M 0 ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0 H ${node.width - radius} A ${radius} ${radius} 0 0 1 ${node.width} ${radius} V ${DIAGRAM_HEADER_HEIGHT} H 0 Z`}
      />
      <text
        x={DIAGRAM_PADDING_X}
        y={DIAGRAM_HEADER_HEIGHT / 2 + 4}
        fill={palette.headerText}
        fontSize={12}
        fontWeight={600}
        fontFamily={fontFamily(DIAGRAM_HEADER_FONT)}
      >
        {node.title}
      </text>

      {node.columns.map((column, index) => {
        const badges = columnBadges(column);
        const rowTop = DIAGRAM_HEADER_HEIGHT + index * DIAGRAM_ROW_HEIGHT + 3;
        const description = [column.name, column.dataType, ...badges.map((badge) => diagramBadgeLabels[badge])].join(' · ');
        return (
          <g key={column.name}>
            <title>{description}</title>
            {badges.map((badge, badgeIndex) => {
              const badgeX = DIAGRAM_PADDING_X + badgeIndex * (DIAGRAM_BADGE_WIDTH + DIAGRAM_BADGE_GAP);
              return (
                <g key={badge}>
                  <rect
                    rx={3}
                    x={badgeX}
                    height={14}
                    y={rowTop + 4}
                    width={DIAGRAM_BADGE_WIDTH}
                    fill={palette.badges[badge].fill}
                  />
                  <text
                    fontSize={9}
                    fontWeight={700}
                    y={rowTop + 14.5}
                    textAnchor="middle"
                    fill={palette.badges[badge].text}
                    x={badgeX + DIAGRAM_BADGE_WIDTH / 2}
                    fontFamily={fontFamily(DIAGRAM_HEADER_FONT)}
                  >
                    {badge}
                  </text>
                </g>
              );
            })}
            <text
              fontSize={12}
              y={rowTop + 15}
              fill={palette.text}
              x={DIAGRAM_PADDING_X + node.badgesWidth}
              fontWeight={column.isPrimaryKey ? 600 : 400}
              fontFamily={fontFamily(DIAGRAM_COLUMN_FONT)}
            >
              {column.name}
            </text>
            <text
              fontSize={12}
              y={rowTop + 15}
              textAnchor="end"
              fill={palette.muted}
              x={node.width - DIAGRAM_PADDING_X}
              fontFamily={fontFamily(DIAGRAM_COLUMN_FONT)}
            >
              {column.dataType}
            </text>
          </g>
        );
      })}

      {node.hiddenColumns > 0 && (
        <text
          fontSize={11}
          fontStyle="italic"
          fill={palette.muted}
          x={DIAGRAM_PADDING_X + node.badgesWidth}
          fontFamily={fontFamily(DIAGRAM_HEADER_FONT)}
          y={DIAGRAM_HEADER_HEIGHT + node.columns.length * DIAGRAM_ROW_HEIGHT + 18}
        >
          + {node.hiddenColumns} {node.hiddenColumns === 1 ? 'coluna' : 'colunas'}
        </text>
      )}
    </g>
  );
};

export default memo(DiagramTableNode);
