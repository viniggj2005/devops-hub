import React, { useEffect, useState } from 'react';
import { isHexColor } from '../functions/CustomThemePalette';

interface ColorFieldProps {
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}

const ColorField: React.FC<ColorFieldProps> = ({ label, value, hint, onChange }) => {
  const [typedValue, setTypedValue] = useState(value);

  useEffect(() => setTypedValue(value), [value]);

  const handleTypedValue = (nextValue: string) => {
    const normalizedValue = nextValue.startsWith('#') ? nextValue : `#${nextValue}`;
    setTypedValue(normalizedValue);
    if (isHexColor(normalizedValue)) onChange(normalizedValue.toLowerCase());
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800/60 p-1.5">
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={event => onChange(event.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
        />
        <input
          type="text"
          maxLength={7}
          spellCheck={false}
          value={typedValue}
          aria-label={`${label} em hexadecimal`}
          onChange={event => handleTypedValue(event.target.value)}
          className={`w-full bg-transparent font-mono text-sm uppercase outline-none ${isHexColor(typedValue) ? '' : 'text-red-500'}`}
        />
      </div>
      {hint && <span className="text-xs text-gray-500 dark:text-zinc-400">{hint}</span>}
    </label>
  );
};

export default ColorField;
