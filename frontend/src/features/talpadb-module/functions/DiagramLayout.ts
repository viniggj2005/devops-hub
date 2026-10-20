import type {
  DiagramTable,
  DiagramColumn,
  DatabaseDiagram,
  DiagramLineStyle,
  DiagramAnchorSide,
  DiagramEdgeAnchor,
  SavedDiagramLayout,
  DiagramEdgeAnchors,
} from '../../../interfaces/TalpadbInterfaces';

export const DIAGRAM_BADGE_GAP = 3;
export const DIAGRAM_PADDING_X = 12;
export const DIAGRAM_ROW_HEIGHT = 22;
export const DIAGRAM_BADGE_WIDTH = 20;
export const DIAGRAM_HEADER_HEIGHT = 34;
export const DIAGRAM_HEADER_FONT = '600 12px ui-sans-serif, system-ui, sans-serif';
export const DIAGRAM_COLUMN_FONT = '12px ui-monospace, SFMono-Regular, Consolas, monospace';

const RANK_GAP = 140;
const NODE_GAP = 36;
const MIN_WIDTH = 170;
const TYPE_GAP = 18;
const MAX_COLUMN_HEIGHT = 1800;
const ISOLATED_ROW_GAP = 48;

export type DiagramBadge = 'PK' | 'FK' | 'UQ' | 'NN';

export const diagramBadgeLabels: Record<DiagramBadge, string> = {
  PK: 'chave primária',
  FK: 'chave estrangeira',
  UQ: 'valor único',
  NN: 'não aceita NULL',
};

export interface DiagramNode {
  key: string;
  width: number;
  height: number;
  title: string;
  badgesWidth: number;
  hiddenColumns: number;
  table: DiagramTable;
  columns: DiagramColumn[];
}

export function columnBadges(column: DiagramColumn): DiagramBadge[] {
  if (column.isPrimaryKey) return column.isForeignKey ? ['PK', 'FK'] : ['PK'];
  const badges: DiagramBadge[] = [];
  if (column.isForeignKey) badges.push('FK');
  if (column.isUnique) badges.push('UQ');
  if (column.notNull) badges.push('NN');
  return badges;
}

const isKeyColumn = (column: DiagramColumn) => column.isPrimaryKey || column.isForeignKey || column.isUnique;

export interface Point {
  x: number;
  y: number;
}

export const tableKey = (schema: string, name: string) => `${schema}.${name}`;

let measureContext: CanvasRenderingContext2D | null = null;

const measureText = (text: string, font: string) => {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * 7.2;
  measureContext.font = font;
  return measureContext.measureText(text).width;
};

export function buildDiagramNodes(diagram: DatabaseDiagram, keysOnly: boolean): Record<string, DiagramNode> {
  const showSchema = new Set(diagram.tables.map((table) => table.schema)).size > 1;
  const nodes: Record<string, DiagramNode> = {};

  for (const table of diagram.tables) {
    const key = tableKey(table.schema, table.name);
    const columns = keysOnly ? table.columns.filter(isKeyColumn) : table.columns;
    const hiddenColumns = table.columns.length - columns.length;
    const title = showSchema ? key : table.name;
    const badgeSlots = columns.reduce((most, column) => Math.max(most, columnBadges(column).length), 0);
    const badgesWidth = badgeSlots ? badgeSlots * (DIAGRAM_BADGE_WIDTH + DIAGRAM_BADGE_GAP) + 4 : 0;

    const headerWidth = measureText(title, DIAGRAM_HEADER_FONT) + DIAGRAM_PADDING_X * 2 + 18;
    const columnsWidth = columns.reduce(
      (widest, column) =>
        Math.max(
          widest,
          DIAGRAM_PADDING_X * 2 +
            badgesWidth +
            measureText(column.name, DIAGRAM_COLUMN_FONT) +
            TYPE_GAP +
            measureText(column.dataType, DIAGRAM_COLUMN_FONT)
        ),
      0
    );
    const rows = columns.length + (hiddenColumns > 0 ? 1 : 0);

    nodes[key] = {
      key,
      table,
      title,
      columns,
      badgesWidth,
      hiddenColumns,
      width: Math.ceil(Math.max(MIN_WIDTH, headerWidth, columnsWidth)),
      height: DIAGRAM_HEADER_HEIGHT + Math.max(1, rows) * DIAGRAM_ROW_HEIGHT + 6,
    };
  }
  return nodes;
}

export function layoutDiagram(diagram: DatabaseDiagram, nodes: Record<string, DiagramNode>): Record<string, Point> {
  const targetsBySource = new Map<string, Set<string>>();
  const neighbors = new Map<string, Set<string>>();
  const link = (map: Map<string, Set<string>>, from: string, to: string) => {
    if (!map.has(from)) map.set(from, new Set());
    map.get(from)!.add(to);
  };

  for (const relation of diagram.relations) {
    const source = tableKey(relation.sourceSchema, relation.sourceTable);
    const target = tableKey(relation.targetSchema, relation.targetTable);
    if (source === target || !nodes[source] || !nodes[target]) continue;
    link(targetsBySource, source, target);
    link(neighbors, source, target);
    link(neighbors, target, source);
  }

  const ranks = new Map<string, number>();
  const visiting = new Set<string>();
  const rankOf = (key: string): number => {
    const known = ranks.get(key);
    if (known !== undefined) return known;
    if (visiting.has(key)) return 0;
    visiting.add(key);
    let rank = 0;
    for (const target of targetsBySource.get(key) ?? []) rank = Math.max(rank, rankOf(target) + 1);
    visiting.delete(key);
    ranks.set(key, rank);
    return rank;
  };

  const keys = Object.keys(nodes).sort();
  const connected = keys.filter((key) => neighbors.has(key));
  const isolated = keys.filter((key) => !neighbors.has(key));

  const columns: string[][] = [];
  for (const key of connected) {
    const rank = rankOf(key);
    (columns[rank] ??= []).push(key);
  }

  const order = new Map<string, number>();
  const refreshOrder = () =>
    columns.forEach((column) => column?.forEach((key, index) => order.set(key, index / Math.max(1, column.length))));
  refreshOrder();
  for (let sweep = 0; sweep < 4; sweep++) {
    for (const column of columns) {
      if (!column) continue;
      const barycenter = (key: string) => {
        const linked = [...(neighbors.get(key) ?? [])].map((neighbor) => order.get(neighbor) ?? 0);
        return linked.length ? linked.reduce((sum, value) => sum + value, 0) / linked.length : order.get(key) ?? 0;
      };
      column.sort((first, second) => barycenter(first) - barycenter(second));
    }
    refreshOrder();
  }

  const positions: Record<string, Point> = {};
  let cursorX = 0;
  let connectedHeight = 0;
  for (const column of columns) {
    if (!column?.length) continue;
    let subColumnX = cursorX;
    let subColumnWidth = 0;
    let cursorY = 0;
    for (const key of column) {
      const node = nodes[key];
      if (cursorY > 0 && cursorY + node.height > MAX_COLUMN_HEIGHT) {
        subColumnX += subColumnWidth + NODE_GAP * 2;
        subColumnWidth = 0;
        cursorY = 0;
      }
      positions[key] = { x: subColumnX, y: cursorY };
      cursorY += node.height + NODE_GAP;
      subColumnWidth = Math.max(subColumnWidth, node.width);
      connectedHeight = Math.max(connectedHeight, cursorY);
    }
    cursorX = subColumnX + subColumnWidth + RANK_GAP;
  }

  const rowWidth = Math.max(cursorX - RANK_GAP, 1600);
  let rowX = 0;
  let rowY = connected.length ? connectedHeight + ISOLATED_ROW_GAP : 0;
  let rowHeight = 0;
  for (const key of isolated) {
    const node = nodes[key];
    if (rowX > 0 && rowX + node.width > rowWidth) {
      rowX = 0;
      rowY += rowHeight + NODE_GAP;
      rowHeight = 0;
    }
    positions[key] = { x: rowX, y: rowY };
    rowX += node.width + NODE_GAP;
    rowHeight = Math.max(rowHeight, node.height);
  }

  return positions;
}

const SAVED_GAP = 80;

const isPoint = (value: unknown): value is Point =>
  Boolean(value) &&
  typeof value === 'object' &&
  Number.isFinite((value as Point).x) &&
  Number.isFinite((value as Point).y);

const lineStyles: DiagramLineStyle[] = ['curved', 'straight', 'orthogonal'];

const anchorSides: DiagramAnchorSide[] = ['left', 'right', 'top', 'bottom'];

const isAnchor = (value: unknown): value is DiagramEdgeAnchor => {
  const anchor = value as DiagramEdgeAnchor;
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    anchorSides.includes(anchor.side) &&
    (anchor.offset === null || (Number.isFinite(anchor.offset) && anchor.offset >= 0 && anchor.offset <= 1))
  );
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function parseSavedLayout(raw: string): SavedDiagramLayout | null {
  if (!raw) return null;
  try {
    const parsed = asRecord(JSON.parse(raw));
    const positions = Object.fromEntries(
      Object.entries(asRecord(parsed.positions)).filter(([, point]) => isPoint(point))
    ) as Record<string, Point>;
    const edges = Object.fromEntries(
      Object.entries(asRecord(parsed.edges))
        .filter(([, points]) => Array.isArray(points) && points.length > 0 && points.every(isPoint))
    ) as Record<string, Point[]>;
    const lineStyle = lineStyles.includes(parsed.lineStyle as DiagramLineStyle) ? (parsed.lineStyle as DiagramLineStyle) : 'curved';
    const anchors = Object.fromEntries(
      Object.entries(asRecord(parsed.anchors))
        .map(([key, value]) => {
          const record = asRecord(value);
          const edgeAnchors: DiagramEdgeAnchors = {};
          if (isAnchor(record.source)) edgeAnchors.source = record.source;
          if (isAnchor(record.target)) edgeAnchors.target = record.target;
          return [key, edgeAnchors] as const;
        })
        .filter(([, edgeAnchors]) => edgeAnchors.source || edgeAnchors.target)
    );
    return { keysOnly: parsed.keysOnly === true, lineStyle, edges, positions, anchors };
  } catch {
    return null;
  }
}

const roundPoint = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) });

export function roundPositions(positions: Record<string, Point>): Record<string, Point> {
  return Object.fromEntries(Object.entries(positions).map(([key, point]) => [key, roundPoint(point)]));
}

export function roundAnchors(
  anchors: Record<string, DiagramEdgeAnchors>,
  keepKeys: Set<string>
): Record<string, DiagramEdgeAnchors> {
  const roundAnchor = (anchor?: DiagramEdgeAnchor) =>
    anchor && { side: anchor.side, offset: anchor.offset === null ? null : Math.round(anchor.offset * 1000) / 1000 };
  return Object.fromEntries(
    Object.entries(anchors)
      .filter(([key, edgeAnchors]) => keepKeys.has(key) && (edgeAnchors.source || edgeAnchors.target))
      .map(([key, edgeAnchors]) => [key, { source: roundAnchor(edgeAnchors.source), target: roundAnchor(edgeAnchors.target) }])
  );
}

export function roundEdges(edges: Record<string, Point[]>, keepKeys: Set<string>): Record<string, Point[]> {
  return Object.fromEntries(
    Object.entries(edges)
      .filter(([key, points]) => keepKeys.has(key) && points.length > 0)
      .map(([key, points]) => [key, points.map(roundPoint)])
  );
}

export function mergeSavedPositions(
  automatic: Record<string, Point>,
  saved: Record<string, Point>,
  nodes: Record<string, DiagramNode>
): Record<string, Point> {
  const savedKeys = Object.keys(saved).filter((key) => nodes[key]);
  if (!savedKeys.length) return automatic;

  const merged: Record<string, Point> = {};
  for (const key of savedKeys) merged[key] = saved[key];

  const newKeys = Object.keys(automatic).filter((key) => !merged[key]);
  if (!newKeys.length) return merged;

  const savedLeft = Math.min(...savedKeys.map((key) => saved[key].x));
  const savedBottom = Math.max(...savedKeys.map((key) => saved[key].y + nodes[key].height));
  const automaticLeft = Math.min(...newKeys.map((key) => automatic[key].x));
  const automaticTop = Math.min(...newKeys.map((key) => automatic[key].y));
  for (const key of newKeys) {
    merged[key] = {
      x: automatic[key].x - automaticLeft + savedLeft,
      y: automatic[key].y - automaticTop + savedBottom + SAVED_GAP,
    };
  }
  return merged;
}

export function columnAnchorY(node: DiagramNode, columnName: string | undefined) {
  const index = columnName ? node.columns.findIndex((column) => column.name === columnName) : -1;
  if (index < 0) return DIAGRAM_HEADER_HEIGHT / 2;
  return DIAGRAM_HEADER_HEIGHT + index * DIAGRAM_ROW_HEIGHT + DIAGRAM_ROW_HEIGHT / 2 + 3;
}
