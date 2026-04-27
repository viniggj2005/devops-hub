import Sidebar from './Sidebar';
import React, { useState } from 'react';
import { AppShellProps } from '../../../../interfaces/SharedInterfaces';

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <Sidebar
        open={isSidebarOpen}
        collapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <main className=" flex-1 min-h-0 flex flex-col px-4 pb-6 pt-0 sm:px-6 sm:pt-0 lg:px-8 lg:pt-6 xl:px-10 overflow-auto 
      bg-gradient-to-br dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 from-gray-50 via-blue-50  to-purple-50
      transition-colors duration-200 ">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
