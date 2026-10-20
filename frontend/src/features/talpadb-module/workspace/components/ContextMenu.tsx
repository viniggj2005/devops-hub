import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, title, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const close = () => onCloseRef.current();
    const handlePointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, []);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-[60] min-w-[220px] max-w-[320px] py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl text-sm"
    >
      {title && (
        <div className="px-3 pt-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 truncate">
          {title}
        </div>
      )}
      {items.map((item, index) =>
        item.separator ? (
          <div key={`separator-${index}`} className="my-1 h-px bg-gray-100 dark:bg-white/5" />
        ) : (
          <button
            key={`${item.label}-${index}`}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onClick?.();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              item.danger
                ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                : 'text-gray-700 dark:text-zinc-200 hover:bg-cyan-500/10 hover:text-cyan-700 dark:hover:text-cyan-300'
            }`}
          >
            {item.icon && <item.icon className="w-4 h-4 flex-shrink-0 opacity-80" />}
            <span className="truncate">{item.label}</span>
          </button>
        )
      )}
    </div>,
    document.body
  );
};

export default ContextMenu;
