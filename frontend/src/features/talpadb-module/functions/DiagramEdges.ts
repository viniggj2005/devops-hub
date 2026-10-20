import { columnAnchorY, DiagramNode, Point } from './DiagramLayout';
import type {
  DiagramRelation,
  DiagramLineStyle,
  DiagramAnchorSide,
  DiagramEdgeAnchor,
  DiagramEdgeAnchors,
} from '../../../interfaces/TalpadbInterfaces';

const STUB = 24;
const SELF_LOOP = 36;
const SNAP_DISTANCE = 8;
const SIDE_MARGIN = 0.04;

export interface EdgeInput {
  style: DiagramLineStyle;
  source: DiagramNode;
  target: DiagramNode;
  waypoints: Point[];
  sourcePosition: Point;
  targetPosition: Point;
  sourceColumn?: string;
  targetColumn?: string;
  anchors?: DiagramEdgeAnchors;
}

export interface EdgeGeometry {
  path: string;
  controlPoints: Point[];
}

interface Endpoint {
  point: Point;
  outward: Point;
}

const outwardBySide: Record<DiagramAnchorSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

export const relationKey = (relation: DiagramRelation) =>
  `${relation.sourceSchema}.${relation.sourceTable}:${relation.name}`;

const isHorizontal = (vector: Point) => vector.y === 0;

const offsetPoint = (point: Point, vector: Point, distance: number): Point => ({
  x: point.x + vector.x * distance,
  y: point.y + vector.y * distance,
});

const samePoint = (first: Point, second: Point) => Math.abs(first.x - second.x) < 0.5 && Math.abs(first.y - second.y) < 0.5;

const withoutDuplicates = (points: Point[]) =>
  points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]));

const polylinePath = (points: Point[]) =>
  withoutDuplicates(points)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

const orthogonalPoints = (points: Point[]) => {
  const route: Point[] = [points[0]];
  for (let index = 1; index < points.length; index++) {
    const previous = route[route.length - 1];
    const next = points[index];
    if (previous.x !== next.x && previous.y !== next.y) route.push({ x: next.x, y: previous.y });
    route.push(next);
  }
  return route;
};

const smoothPath = (points: Point[], startOutward: Point, endOutward: Point) => {
  const unique = withoutDuplicates(points);
  const last = unique.length - 1;
  const at = (index: number) => unique[Math.min(last, Math.max(0, index))];
  let path = `M ${unique[0].x} ${unique[0].y}`;
  for (let index = 0; index < last; index++) {
    const before = at(index - 1);
    const current = at(index);
    const next = at(index + 1);
    const after = at(index + 2);
    const reach = Math.hypot(next.x - current.x, next.y - current.y) / 3;
    const firstControl =
      index === 0
        ? offsetPoint(current, startOutward, reach)
        : { x: current.x + (next.x - before.x) / 6, y: current.y + (next.y - before.y) / 6 };
    const secondControl =
      index === last - 1
        ? offsetPoint(next, endOutward, reach)
        : { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 };
    path += ` C ${firstControl.x} ${firstControl.y}, ${secondControl.x} ${secondControl.y}, ${next.x} ${next.y}`;
  }
  return path;
};

function endpointOf(node: DiagramNode, position: Point, anchor: DiagramEdgeAnchor, columnName?: string): Endpoint {
  const outward = outwardBySide[anchor.side];
  if (isHorizontal(outward)) {
    const y = anchor.offset === null ? position.y + columnAnchorY(node, columnName) : position.y + anchor.offset * node.height;
    return { outward, point: { x: anchor.side === 'left' ? position.x : position.x + node.width, y } };
  }
  const x = position.x + (anchor.offset ?? 0.5) * node.width;
  return { outward, point: { x, y: anchor.side === 'top' ? position.y : position.y + node.height } };
}

const defaultOrthogonalBends = (startStub: Point, startOutward: Point, endStub: Point, endOutward: Point): Point[] => {
  const startHorizontal = isHorizontal(startOutward);
  const endHorizontal = isHorizontal(endOutward);
  if (startHorizontal && endHorizontal) {
    const middleX = (startStub.x + endStub.x) / 2;
    return [
      { x: middleX, y: startStub.y },
      { x: middleX, y: endStub.y },
    ];
  }
  if (!startHorizontal && !endHorizontal) {
    const middleY = (startStub.y + endStub.y) / 2;
    return [
      { x: startStub.x, y: middleY },
      { x: endStub.x, y: middleY },
    ];
  }
  return [startHorizontal ? { x: endStub.x, y: startStub.y } : { x: startStub.x, y: endStub.y }];
};

export function edgeGeometry({
  style,
  source,
  target,
  waypoints,
  sourceColumn,
  targetColumn,
  sourcePosition,
  targetPosition,
  anchors = {},
}: EdgeInput): EdgeGeometry {
  const selfLoop = source.key === target.key;
  const sourceCenter = sourcePosition.x + source.width / 2;
  const targetCenter = targetPosition.x + target.width / 2;

  let automaticSourceSide: DiagramAnchorSide;
  let automaticTargetSide: DiagramAnchorSide;
  if (waypoints.length) {
    automaticSourceSide = waypoints[0].x < sourceCenter ? 'left' : 'right';
    automaticTargetSide = waypoints[waypoints.length - 1].x < targetCenter ? 'left' : 'right';
  } else if (selfLoop) {
    automaticSourceSide = 'right';
    automaticTargetSide = 'right';
  } else {
    automaticSourceSide = sourceCenter >= targetCenter ? 'left' : 'right';
    automaticTargetSide = automaticSourceSide === 'left' ? 'right' : 'left';
  }

  const start = endpointOf(source, sourcePosition, anchors.source ?? { side: automaticSourceSide, offset: null }, sourceColumn);
  const end = endpointOf(target, targetPosition, anchors.target ?? { side: automaticTargetSide, offset: null }, targetColumn);
  const startStub = offsetPoint(start.point, start.outward, STUB);
  const endStub = offsetPoint(end.point, end.outward, STUB);
  const controlPoints = [start.point, ...waypoints, end.point];

  let bends = waypoints;
  if (!bends.length && selfLoop) {
    bends = [offsetPoint(start.point, start.outward, SELF_LOOP), offsetPoint(end.point, end.outward, SELF_LOOP)];
  }

  if (style === 'straight') {
    return { controlPoints, path: polylinePath([start.point, ...bends, end.point]) };
  }

  if (style === 'orthogonal') {
    const route = bends.length ? bends : defaultOrthogonalBends(startStub, start.outward, endStub, end.outward);
    return { controlPoints, path: polylinePath(orthogonalPoints([start.point, startStub, ...route, endStub, end.point])) };
  }

  if (!bends.length) {
    const reach = (outward: Point) =>
      Math.max(48, (isHorizontal(outward) ? Math.abs(end.point.x - start.point.x) : Math.abs(end.point.y - start.point.y)) / 2);
    const firstControl = offsetPoint(start.point, start.outward, reach(start.outward));
    const secondControl = offsetPoint(end.point, end.outward, reach(end.outward));
    return {
      controlPoints,
      path: `M ${start.point.x} ${start.point.y} C ${firstControl.x} ${firstControl.y}, ${secondControl.x} ${secondControl.y}, ${end.point.x} ${end.point.y}`,
    };
  }
  return { controlPoints, path: smoothPath([start.point, ...bends, end.point], start.outward, end.outward) };
}

export function anchorFromPointer(
  node: DiagramNode,
  position: Point,
  pointer: Point,
  columnName: string | undefined,
  scale: number
): DiagramEdgeAnchor {
  const distances: Record<DiagramAnchorSide, number> = {
    left: Math.abs(pointer.x - position.x),
    right: Math.abs(pointer.x - (position.x + node.width)),
    top: Math.abs(pointer.y - position.y),
    bottom: Math.abs(pointer.y - (position.y + node.height)),
  };
  const side = (Object.keys(distances) as DiagramAnchorSide[]).reduce((closest, candidate) =>
    distances[candidate] < distances[closest] ? candidate : closest
  );
  const threshold = SNAP_DISTANCE / scale;
  const clampOffset = (value: number) => Math.min(1 - SIDE_MARGIN, Math.max(SIDE_MARGIN, value));

  if (side === 'left' || side === 'right') {
    const columnY = position.y + columnAnchorY(node, columnName);
    if (Math.abs(pointer.y - columnY) < threshold) return { side, offset: null };
    return { side, offset: clampOffset((pointer.y - position.y) / node.height) };
  }
  if (Math.abs(pointer.x - (position.x + node.width / 2)) < threshold) return { side, offset: 0.5 };
  return { side, offset: clampOffset((pointer.x - position.x) / node.width) };
}

const distanceToSegment = (point: Point, from: Point, to: Point) => {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const ratio = lengthSquared ? Math.max(0, Math.min(1, ((point.x - from.x) * deltaX + (point.y - from.y) * deltaY) / lengthSquared)) : 0;
  return Math.hypot(point.x - (from.x + ratio * deltaX), point.y - (from.y + ratio * deltaY));
};

export function nearestSegmentIndex(controlPoints: Point[], point: Point) {
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index < controlPoints.length - 1; index++) {
    const distance = distanceToSegment(point, controlPoints[index], controlPoints[index + 1]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  return nearestIndex;
}

export function followWeights(controlPoints: Point[], movedEnd: 'source' | 'target' | 'both'): number[] {
  const waypointCount = controlPoints.length - 2;
  if (waypointCount <= 0) return [];
  if (movedEnd === 'both') return Array(waypointCount).fill(1);

  const travelled = [0];
  for (let index = 1; index < controlPoints.length; index++) {
    const previous = controlPoints[index - 1];
    const current = controlPoints[index];
    travelled.push(travelled[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
  }
  const total = travelled[travelled.length - 1] || 1;
  return Array.from({ length: waypointCount }, (_value, index) => {
    const fromSource = travelled[index + 1] / total;
    return movedEnd === 'source' ? 1 - fromSource : fromSource;
  });
}

export function snapToNeighbors(point: Point, neighbors: Point[], scale: number): Point {
  const threshold = SNAP_DISTANCE / scale;
  let { x, y } = point;
  for (const neighbor of neighbors) {
    if (Math.abs(neighbor.x - x) < threshold) x = neighbor.x;
    if (Math.abs(neighbor.y - y) < threshold) y = neighbor.y;
  }
  return { x, y };
}
