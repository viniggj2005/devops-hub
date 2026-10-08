import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ThemeOption<Value extends string> {
  value: Value;
  label: string;
  icon: LucideIcon;
}

interface ThemeOptionPickerProps<Value extends string> {
  label: string;
  selected: Value;
  options: ThemeOption<Value>[];
  onSelect: (value: Value) => void;
}

const ThemeOptionPicker = <Value extends string>({ label, selected, options, onSelect }: ThemeOptionPickerProps<Value>) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-gray-100 dark:bg-zinc-800 p-1 gap-1">
    {options.map(option => {
      const isSelected = option.value === selected;
      const OptionIcon = option.icon;
      return (
        <button
          type="button"
          role="radio"
          key={option.value}
          aria-checked={isSelected}
          onClick={() => onSelect(option.value)}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isSelected
            ? 'bg-white dark:bg-zinc-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <OptionIcon className="w-4 h-4" />
          {option.label}
        </button>
      );
    })}
  </div>
);

export default ThemeOptionPicker;
