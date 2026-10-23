import { useRef, useState } from "react";
import { AppTab, useAppStore } from "./AppStore";
import appIcon from "../../assets/images/hub.svg";
import { isDetachedWindow } from "./WindowContext";
import { useTabDetachDrag } from "./hooks/useTabDetachDrag";
import { VulpesModuleIcon } from "../vulpes-module/moduleInfo";
import { TalpadbModuleIcon } from "../talpadb-module/moduleInfo";
import { useTabTransferTarget } from "./hooks/useTabTransferTarget";
import { WindowControls, useWindowMaximise } from "./WindowControls";
import { clearTabDropPreviewApi, previewTabDropApi } from "./services/WindowService";
import ContextMenu, { ContextMenuEntry } from "../shared/components/menus/ContextMenu";
import { X, Home, Terminal, Settings, AppWindow, SquareArrowOutUpRight } from "lucide-react";

interface TabMenu {
  x: number;
  y: number;
  tab: AppTab;
}

const dragHintLabels = {
  newWindow: 'Solte para abrir em nova janela',
  merge: 'Solte para mover para a outra janela',
};

const tabActionButtonClass = `
  p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
  hover:bg-black/10 dark:hover:bg-white/10
`;

export function AppFrame() {
  const dropHighlighted = useTabTransferTarget();
  const tabStripRef = useRef<HTMLDivElement>(null);
  const { maximized, toggleMaximise } = useWindowMaximise();
  const [tabMenu, setTabMenu] = useState<TabMenu | null>(null);
  const {
    tabs,
    dropTab,
    closeTab,
    detachTab,
    canDragTab,
    activeTabId,
    setActiveTab,
    canOpenInNewWindow,
    canMoveToMainWindow,
    moveTabToMainWindow,
  } = useAppStore();
  const { hint, handlersFor, consumeSuppressedClick } = useTabDetachDrag(tabStripRef, {
    canDrag: canDragTab,
    canOpenInNewWindow,
    dropOutside: dropTab,
    openInNewWindow: detachTab,
    previewDrop: previewTabDropApi,
    clearPreview: clearTabDropPreviewApi,
  });

  const getTabIcon = (type: string) => {
    if (type === 'home') return <Home className="w-4 h-4" />;
    if (type === 'docker') {
      return (
        <span
          aria-hidden="true"
          className="inline-block w-4 h-4 bg-blue-500 shrink-0"
          style={{
            maskSize: 'contain',
            maskPosition: 'center',
            maskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            maskImage: 'url(/docker-manager.svg)',
            WebkitMaskImage: 'url(/docker-manager.svg)',
          }}
        />
      );
    }
    if (type === 'settings') return <Settings className="w-4 h-4 text-gray-500" />;
    if (type === 'ferretshell') return <Terminal className="w-4 h-4 text-purple-500" />;
    if (type === 'vulpes') return <VulpesModuleIcon className="w-4 h-4 text-amber-500" />;
    if (type === 'talpadb') return <TalpadbModuleIcon className="w-4 h-4 text-cyan-500" />;
    if (type === 'octohub') return <img src="/gitoctocat.svg" className="w-4 h-4 brightness-0 dark:invert" />;
    return null;
  };

  const tabMenuEntries = (tab: AppTab): ContextMenuEntry[] => {
    const entries: ContextMenuEntry[] = [];
    if (canDragTab(tab.id)) {
      entries.push({
        label: 'Abrir em nova janela',
        icon: SquareArrowOutUpRight,
        disabled: !canOpenInNewWindow(tab.id),
        hint: canOpenInNewWindow(tab.id) ? undefined : 'Esta já é a única aba desta janela',
        onClick: () => detachTab(tab.id),
      });
    }
    if (canMoveToMainWindow(tab.id)) {
      entries.push({ label: 'Mover para a janela principal', icon: AppWindow, onClick: () => moveTabToMainWindow(tab.id) });
    }
    if (tab.type !== 'home') {
      if (entries.length > 0) entries.push('separator');
      entries.push({ label: 'Fechar aba', icon: X, onClick: () => closeTab(tab.id) });
    }
    return entries;
  };

  const idleHintLabel = !isDetachedWindow || tabs.length > 1
    ? 'Arraste para baixo ou até outra janela'
    : 'Arraste até outra janela para mesclar';
  const hintLabel = hint && (hint.mode === 'idle' ? idleHintLabel : dragHintLabels[hint.mode]);

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

      <div ref={tabStripRef} className="relative flex-1 min-w-0 flex items-end h-full overflow-hidden pt-2 px-2 gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const draggable = canDragTab(tab.id);
          return (
            <div
              key={tab.id}
              {...handlersFor(tab.id)}
              onClick={() => {
                if (consumeSuppressedClick()) return;
                setActiveTab(tab.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (tabMenuEntries(tab).length > 0) setTabMenu({ x: event.clientX, y: event.clientY, tab });
              }}
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
                ${hint && draggable ? 'cursor-grabbing' : ''}
              `}
              title={draggable ? `${tab.title} — arraste para outra janela ou para baixo para destacar` : tab.title}
            >
              {getTabIcon(tab.type)}
              <span className="text-xs font-medium truncate flex-1">{tab.title}</span>

              {canMoveToMainWindow(tab.id) && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    moveTabToMainWindow(tab.id);
                  }}
                  title="Mover para a janela principal"
                  aria-label="Mover para a janela principal"
                  className={tabActionButtonClass}
                >
                  <AppWindow className="w-3.5 h-3.5" />
                </button>
              )}

              {canOpenInNewWindow(tab.id) && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    detachTab(tab.id);
                  }}
                  title="Abrir em nova janela"
                  aria-label="Abrir em nova janela"
                  className={tabActionButtonClass}
                >
                  <SquareArrowOutUpRight className="w-3.5 h-3.5" />
                </button>
              )}

              {tab.type !== 'home' && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`
                    ${tabActionButtonClass}
                    ${isActive ? 'opacity-100' : ''}
                  `}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {dropHighlighted && (
          <div className="pointer-events-none absolute inset-1 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-500/15">
            <span className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
              Solte para mover a aba para esta janela
            </span>
          </div>
        )}
      </div>

      <WindowControls maximized={maximized} onToggleMaximise={toggleMaximise} />

      {hint && (
        <div
          style={{
            left: Math.min(Math.max(hint.x + 14, 8), window.innerWidth - 280),
            top: Math.min(Math.max(hint.y + 14, 8), window.innerHeight - 40),
          }}
          className={`
            pointer-events-none fixed z-[100] flex items-center gap-2
            rounded-md px-2.5 py-1.5 text-xs font-medium shadow-lg
            border transition-colors
            ${hint.mode === 'idle'
              ? 'bg-zinc-800 border-white/10 text-gray-300'
              : 'bg-blue-600 border-blue-400 text-white'
            }
          `}
        >
          <SquareArrowOutUpRight className="w-3.5 h-3.5" />
          {hintLabel}
        </div>
      )}

      {tabMenu && (
        <ContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          title={tabMenu.tab.title}
          entries={tabMenuEntries(tabMenu.tab)}
          onClose={() => setTabMenu(null)}
        />
      )}
    </div>
  );
}
