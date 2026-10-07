import { createPortal } from 'react-dom';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
    label: string;
    hint?: string;
    disabled?: boolean;
    onClick: () => void;
    icon: React.ComponentType<{ className?: string }>;
}

export type ContextMenuEntry = ContextMenuItem | 'separator';

interface ContextMenuProps {
    x: number;
    y: number;
    title?: string;
    onClose: () => void;
    entries: ContextMenuEntry[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, title, entries, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: x, top: y });

    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;
        const { width, height } = menu.getBoundingClientRect();
        setPosition({
            left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
            top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
        });
    }, [x, y]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('blur', onClose);
        window.addEventListener('resize', onClose);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('blur', onClose);
            window.removeEventListener('resize', onClose);
        };
    }, [onClose]);

    return createPortal(
        <>
            <div
                className="fixed inset-0 z-[9998]"
                onMouseDown={onClose}
                onWheel={onClose}
                onContextMenu={(event) => {
                    event.preventDefault();
                    onClose();
                }}
            />
            <div
                ref={menuRef}
                role="menu"
                style={position}
                onContextMenu={(event) => event.preventDefault()}
                className="fixed z-[9999] min-w-[240px] py-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#252526] shadow-2xl shadow-black/40 text-[13px] text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100"
            >
                {title && (
                    <div className="px-3 pt-1 pb-1.5 text-[10px] font-mono text-zinc-400 truncate max-w-[280px]">{title}</div>
                )}
                {entries.map((entry, index) => {
                    if (entry === 'separator') {
                        return <div key={`separator-${index}`} className="my-1 h-px bg-zinc-200 dark:bg-white/10" />;
                    }
                    const Icon = entry.icon;
                    return (
                        <button
                            key={entry.label}
                            role="menuitem"
                            disabled={entry.disabled}
                            title={entry.hint}
                            onClick={() => {
                                onClose();
                                entry.onClick();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                        >
                            <Icon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                            {entry.label}
                        </button>
                    );
                })}
            </div>
        </>,
        document.body
    );
};

export default ContextMenu;
