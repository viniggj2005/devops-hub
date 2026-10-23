import type React from 'react';

// Inicia um arraste com o mouse (divisores redimensionáveis) e devolve o deslocamento acumulado.
export function startDrag(
  event: React.MouseEvent,
  cursor: 'col-resize' | 'row-resize',
  onMove: (deltaX: number, deltaY: number) => void
) {
  event.preventDefault();
  const startX = event.clientX;
  const startY = event.clientY;
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = 'none';

  const handleMove = (moveEvent: MouseEvent) =>
    onMove(moveEvent.clientX - startX, moveEvent.clientY - startY);
  const handleUp = () => {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
  };

  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
}
