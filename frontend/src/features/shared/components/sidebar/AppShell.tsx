import Sidebar from './Sidebar';
import React, { useState } from 'react';
import { AppShellProps } from '../../../../interfaces/SharedInterfaces';

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div
      onContextMenu={(event) => event.preventDefault()}
      className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-zinc-100 transition-colors duration-200 overflow-hidden"
    >
      <Sidebar
        open={isSidebarOpen}
        collapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppShell;
