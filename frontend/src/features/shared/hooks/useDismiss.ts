import { RefObject, useEffect, useRef } from 'react';

type DismissRef = RefObject<HTMLElement | null>;

export function useDismiss(insideRefs: DismissRef | DismissRef[], open: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  const insideRefsRef = useRef(insideRefs);
  onDismissRef.current = onDismiss;
  insideRefsRef.current = insideRefs;

  useEffect(() => {
    if (!open) return;
    const isInside = (target: Node) => {
      const refs = Array.isArray(insideRefsRef.current) ? insideRefsRef.current : [insideRefsRef.current];
      return refs.some((ref) => ref.current?.contains(target));
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!isInside(event.target as Node)) onDismissRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissRef.current();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);
}
