import React from 'react';

export interface SectionTabItem<Key extends string> {
  key: Key;
  label: string;
  count?: number;
  hidden?: boolean;
}

interface SectionTabsProps<Key extends string> {
  active: Key;
  trailing?: React.ReactNode;
  tabs: SectionTabItem<Key>[];
  onChange: (key: Key) => void;
}

function SectionTabs<Key extends string>({ tabs, active, trailing, onChange }: SectionTabsProps<Key>) {
  return (
    <div className="flex items-center gap-1 px-3 border-b border-gray-200 dark:border-white/5 flex-shrink-0 overflow-x-auto">
      {tabs
        .filter((tab) => !tab.hidden)
        .map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              type="button"
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`relative px-2.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
              {!!tab.count && <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">({tab.count})</span>}
              {isActive && <span className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      {trailing && <div className="ml-auto flex items-center gap-2 pl-2 py-1">{trailing}</div>}
    </div>
  );
}

export default SectionTabs;
