import React from 'react';

interface SettingsModuleRowProps {
  icon: string;
  title: string;
  color: string;
  description: string;
  children: React.ReactNode;
  expandedContent?: React.ReactNode;
}

const SettingsModuleRow: React.FC<SettingsModuleRowProps> = ({ icon, title, color, description, children, expandedContent }) => (
  <div className="rounded-2xl bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-white/5 p-5">
    <div className="flex flex-col xl:flex-row xl:items-center gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shrink-0`}>
          <img src={icon} alt="" className="w-8 h-8 brightness-0 invert" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
    {expandedContent}
  </div>
);

export default SettingsModuleRow;
