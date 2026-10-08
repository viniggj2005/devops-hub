import React from 'react';
import { Tag } from 'lucide-react';

interface TagBadgeProps {
    name: string;
    size?: 'sm' | 'md';
}

const TagBadge: React.FC<TagBadgeProps> = ({ name, size = 'sm' }) => {
    const sizeClasses = size === 'sm' ? 'px-1.5 py-px text-[9px] gap-1' : 'px-2 py-0.5 text-[11px] gap-1.5';
    const iconClasses = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
    return (
        <span
            title={`Tag ${name}`}
            className={`inline-flex items-center max-w-full rounded border font-mono font-semibold border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 ${sizeClasses}`}
        >
            <Tag className={`${iconClasses} shrink-0`} />
            <span className="truncate">{name}</span>
        </span>
    );
};

export default TagBadge;
