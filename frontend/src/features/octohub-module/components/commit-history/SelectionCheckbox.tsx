import React from 'react';
import { SelectionState } from '../../functions/lineSelection';
import { Square, SquareCheck, SquareMinus } from 'lucide-react';

interface SelectionCheckboxProps {
    size?: string;
    title?: string;
    state: SelectionState;
}

const SelectionCheckbox: React.FC<SelectionCheckboxProps> = ({ state, title, size = 'w-4 h-4' }) => {
    if (state === 'all') return <SquareCheck className={`${size} text-emerald-500`} aria-label={title} />;
    if (state === 'partial') return <SquareMinus className={`${size} text-emerald-500`} aria-label={title} />;
    return <Square className={`${size} text-zinc-400`} aria-label={title} />;
};

export default SelectionCheckbox;
