import { useEffect, useState } from "react";
import { CircleX, Copy, Minus } from "lucide-react";
import appIcon from "../../assets/images/hub.svg";
import { Quit, WindowMinimise, WindowIsMaximised, WindowToggleMaximise } from "../../../wailsjs/runtime/runtime";

export function AppFrame() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    async function check() {
      const isMax = await WindowIsMaximised();
      setMaximized(isMax);
    }
    check();
  }, []);

  async function toggleMax() {
    await WindowToggleMaximise();
    const isMax = await WindowIsMaximised();
    setMaximized(isMax);
  }

  return (
    <div
      className="
        appframe-drag
        cursor-grab
        active:cursor-grabbing
        h-11
        flex items-center
        px-1
        rounded-t-sm
        bg-gradient-to-br dark:from-slate-800 dark:via-blue-900 dark:to-slate-800 from-gray-50 via-blue-50 to-purple-50
        
        shadow-sm
        select-none
      "
      onDoubleClick={toggleMax}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center pl-1">
          <img
            src={appIcon}
            className="w-8 h-8 opacity-80"
            draggable={false}
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase tracking-[0.18em] text-black-100/50 font-medium">
            Devops Hub
          </span>
        </div>
      </div>

      <div
        className="
          appframe-no-drag
          ml-auto flex items-center gap-1.5
        "
      >
        <button
          onClick={() => WindowMinimise()}
          className="
            inline-flex h-8 w-8 items-center justify-center
            rounded-full
            text-blue-300/70 hover:bg-white/10 hover:text-blue-200
            hover:scale-95
            transition
          "
          aria-label="Minimizar"
        >
          <Minus className="w-6 h-6" />
        </button>

        <button
          onClick={toggleMax}
          className="
            inline-flex h-8 w-8 items-center justify-center
            rounded-full
            text-blue-300/70 hover:bg-white/10 hover:text-blue-200
            hover:scale-95
            transition
          "
          aria-label={maximized ? "Restaurar" : "Maximizar"}
        >
          <Copy className="w-5 h-5 rotate-90" />
        </button>

        <button
          onClick={() => Quit()}
          className="
            inline-flex h-8 w-8 items-center justify-center
            rounded-full
            text-red-400/80
            hover:bg-red-500/20 hover:text-red-300 hover:scale-95
            transition
          "
          aria-label="Fechar"
        >
          <CircleX className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
