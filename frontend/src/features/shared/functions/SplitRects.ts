import type { SplitLayout, SplitOrientation } from '../../../interfaces/SplitInterfaces';

export interface PaneRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type SplitRatioKey = 'column' | 'firstRow' | 'secondRow';

export type SplitRatios = Record<SplitRatioKey, number>;

export interface SplitHandle {
  end: number;
  start: number;
  key: SplitRatioKey;
  position: number;
  orientation: SplitOrientation;
}

export const defaultSplitRatios: SplitRatios = { column: 50, firstRow: 50, secondRow: 50 };

const rect = (left: number, top: number, width: number, height: number): PaneRect => ({ left, top, width, height });

const handle = (key: SplitRatioKey, orientation: SplitOrientation, position: number, start = 0, end = 100): SplitHandle => ({
  key,
  end,
  start,
  position,
  orientation,
});

export function computeSplitLayout(count: number, layout: SplitLayout, ratios: SplitRatios) {
  const { column, firstRow, secondRow } = ratios;

  if (count <= 1) return { rects: [rect(0, 0, 100, 100)], handles: [] };

  if (count === 2) {
    if (layout === 'horizontal') {
      return {
        rects: [rect(0, 0, 100, firstRow), rect(0, firstRow, 100, 100 - firstRow)],
        handles: [handle('firstRow', 'row', firstRow)],
      };
    }
    return {
      rects: [rect(0, 0, column, 100), rect(column, 0, 100 - column, 100)],
      handles: [handle('column', 'column', column)],
    };
  }

  if (count === 3) {
    if (layout === 'horizontal') {
      return {
        rects: [
          rect(0, 0, 100, firstRow),
          rect(0, firstRow, column, 100 - firstRow),
          rect(column, firstRow, 100 - column, 100 - firstRow),
        ],
        handles: [handle('firstRow', 'row', firstRow), handle('column', 'column', column, firstRow, 100)],
      };
    }
    return {
      rects: [
        rect(0, 0, column, 100),
        rect(column, 0, 100 - column, secondRow),
        rect(column, secondRow, 100 - column, 100 - secondRow),
      ],
      handles: [handle('column', 'column', column), handle('secondRow', 'row', secondRow, column, 100)],
    };
  }

  return {
    rects: [
      rect(0, 0, column, firstRow),
      rect(column, 0, 100 - column, secondRow),
      rect(0, firstRow, column, 100 - firstRow),
      rect(column, secondRow, 100 - column, 100 - secondRow),
    ],
    handles: [
      handle('column', 'column', column),
      handle('firstRow', 'row', firstRow, 0, column),
      handle('secondRow', 'row', secondRow, column, 100),
    ],
  };
}
