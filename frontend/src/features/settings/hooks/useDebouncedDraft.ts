import { useEffect, useState } from 'react';

const saveDelayInMilliseconds = 400;

export function useDebouncedDraft<Value>(savedValue: Value, save: (value: Value) => void) {
  const [draft, setDraft] = useState<Value>(savedValue);

  useEffect(() => setDraft(savedValue), [savedValue]);

  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(savedValue)) return;
    const saveTimeout = setTimeout(() => save(draft), saveDelayInMilliseconds);
    return () => clearTimeout(saveTimeout);
  }, [draft, savedValue, save]);

  return [draft, setDraft] as const;
}
