import { ScreenPoint } from '../services/WindowService';
import { PointerEvent, RefObject, useRef, useState } from 'react';

const dragStartDistance = 8;
const previewIntervalMs = 80;
const detachDistanceBelowStrip = 48;

export type TabDropMode = 'idle' | 'merge' | 'newWindow';

interface TabDrag {
  tabId: string;
  startX: number;
  startY: number;
  outside: boolean;
  dragging: boolean;
  previewing: boolean;
  mergeTarget: boolean;
  lastPreviewAt: number;
}

export interface TabDragHint {
  x: number;
  y: number;
  mode: TabDropMode;
}

export interface TabDragActions {
  clearPreview: () => void;
  canDrag: (tabId: string) => boolean;
  canOpenInNewWindow: (tabId: string) => boolean;
  previewDrop: (dropPoint: ScreenPoint) => Promise<boolean>;
  dropOutside: (tabId: string, dropPoint: ScreenPoint) => void;
  openInNewWindow: (tabId: string, dropPoint: ScreenPoint) => void;
}

const toScreenPoint = (event: PointerEvent<HTMLElement>): ScreenPoint => ({ screenX: event.screenX, screenY: event.screenY });

const isOutsideWindow = (event: PointerEvent<HTMLElement>) =>
  event.clientX < 0 || event.clientY < 0 || event.clientX > window.innerWidth || event.clientY > window.innerHeight;

export function useTabDetachDrag(stripRef: RefObject<HTMLElement | null>, actions: TabDragActions) {
  const dragRef = useRef<TabDrag | null>(null);
  const suppressClickRef = useRef(false);
  const [hint, setHint] = useState<TabDragHint | null>(null);

  const isBelowStrip = (event: PointerEvent<HTMLElement>) => {
    const strip = stripRef.current?.getBoundingClientRect();
    return Boolean(strip && event.clientY > strip.bottom + detachDistanceBelowStrip);
  };

  const modeFor = (drag: TabDrag, belowStrip: boolean): TabDropMode => {
    if (drag.outside && drag.mergeTarget) return 'merge';
    if ((drag.outside || belowStrip) && actions.canOpenInNewWindow(drag.tabId)) return 'newWindow';
    return 'idle';
  };

  const stopPreview = (drag: TabDrag) => {
    if (!drag.previewing) return;
    drag.previewing = false;
    drag.mergeTarget = false;
    actions.clearPreview();
  };

  const refreshPreview = (drag: TabDrag, event: PointerEvent<HTMLElement>) => {
    const now = Date.now();
    if (now - drag.lastPreviewAt < previewIntervalMs) return;
    drag.lastPreviewAt = now;
    drag.previewing = true;
    const pointer = { x: event.clientX, y: event.clientY };
    actions.previewDrop(toScreenPoint(event)).then(mergeTarget => {
      if (dragRef.current !== drag || !drag.outside) return;
      drag.mergeTarget = mergeTarget;
      setHint({ ...pointer, mode: modeFor(drag, false) });
    }).catch(() => undefined);
  };

  const resetDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setHint(null);
    return drag;
  };

  const handlersFor = (tabId: string) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      suppressClickRef.current = false;
      if (event.button !== 0 || (event.target as HTMLElement).closest('button') || !actions.canDrag(tabId)) return;
      dragRef.current = {
        tabId,
        outside: false,
        dragging: false,
        lastPreviewAt: 0,
        previewing: false,
        mergeTarget: false,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.tabId !== tabId) return;
      if (!drag.dragging) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < dragStartDistance) return;
        drag.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      drag.outside = isOutsideWindow(event);
      if (drag.outside) {
        refreshPreview(drag, event);
      } else {
        stopPreview(drag);
      }
      setHint({ x: event.clientX, y: event.clientY, mode: modeFor(drag, isBelowStrip(event)) });
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const drag = resetDrag();
      if (!drag?.dragging || drag.tabId !== tabId) return;
      suppressClickRef.current = true;

      if (isOutsideWindow(event)) {
        actions.dropOutside(tabId, toScreenPoint(event));
        return;
      }
      stopPreview(drag);
      if (isBelowStrip(event) && actions.canOpenInNewWindow(tabId)) actions.openInNewWindow(tabId, toScreenPoint(event));
    },
    onPointerCancel: () => {
      const drag = resetDrag();
      if (drag) stopPreview(drag);
    },
  });

  const consumeSuppressedClick = () => {
    const suppressed = suppressClickRef.current;
    suppressClickRef.current = false;
    return suppressed;
  };

  return { hint, handlersFor, consumeSuppressedClick };
}
