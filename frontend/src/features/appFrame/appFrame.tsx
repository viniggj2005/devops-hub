import { useAppStore } from "./AppStore";
import appIcon from "../../assets/images/hub.svg";
import { X, Box, Home, Terminal, Settings } from "lucide-react";
import { WindowControls, useWindowMaximise } from "./WindowControls";
import { PostgresModuleIcon } from "../postgres-module/moduleInfo";

export function AppFrame() {
  const { maximized, toggleMaximise } = useWindowMaximise();
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore();

  const getTabIcon = (type: string) => {
    if (type === 'home') return <Home className="w-4 h-4" />;
    if (type === 'docker') return <Box className="w-4 h-4 text-blue-500" />;
    if (type === 'settings') return <Settings className="w-4 h-4 text-gray-500" />;
    if (type === 'ferretshell') return <Terminal className="w-4 h-4 text-purple-500" />;
    if (type === 'octohub') return <img src="/gitoctocat.svg" className="w-4 h-4 brightness-0 dark:invert" />;
    if (type === 'postgres') return <PostgresModuleIcon className="w-4 h-4 text-cyan-500" />;
    return null;
  };

  return (
    <div
      className="
        appframe-drag
        h-11
        flex items-center
        px-1
        rounded-t-sm
        bg-[#1e1e1e] dark:bg-[#0a0a0c]
        text-gray-300
        select-none
        border-b border-gray-800
      "
      onDoubleClick={toggleMaximise}
    >
      <div className="flex items-center gap-3 w-48 shrink-0">
        <div className="flex items-center justify-center pl-2">
          <img
            src={appIcon}
            className="w-7 h-7 opacity-80"
            draggable={false}
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase tracking-[0.18em] font-medium text-gray-300">
            Devops Hub
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex items-end h-full overflow-hidden pt-2 px-2 gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.button === 1 && event.preventDefault()}
              onAuxClick={(event) => {
                if (event.button !== 1 || tab.type === 'home') return;
                event.preventDefault();
                closeTab(tab.id);
              }}
              className={`
                appframe-no-drag
                group relative flex items-center min-w-[120px] max-w-[200px] h-full px-3 gap-2
                rounded-t-lg border-t border-x border-transparent
                cursor-pointer transition-colors
                ${isActive
                  ? 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-white/10 text-black dark:text-white z-10 before:absolute before:bottom-[-1px] before:left-0 before:right-0 before:h-[1px] before:bg-white dark:before:bg-zinc-900'
                  : 'bg-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }
              `}
              title={tab.title}
            >
              {getTabIcon(tab.type)}
              <span className="text-xs font-medium truncate flex-1">{tab.title}</span>

              {tab.type !== 'home' && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`
                    p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
                    hover:bg-black/10 dark:hover:bg-white/10
                    ${isActive ? 'opacity-100' : ''}
                  `}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <WindowControls maximized={maximized} onToggleMaximise={toggleMaximise} />
    </div>
  );
}
