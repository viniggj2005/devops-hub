import React, { useEffect, useRef, useState } from 'react';

export function useListNavigation(itemCount: number, onChoose: (index: number) => void, onClose: () => void) {
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeIndex >= itemCount) setActiveIndex(Math.max(0, itemCount - 1));
    }, [itemCount, activeIndex]);

    useEffect(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, itemCount - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (itemCount > 0) onChoose(activeIndex);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
        }
    };

    return { activeIndex, setActiveIndex, onKeyDown, listRef };
}
