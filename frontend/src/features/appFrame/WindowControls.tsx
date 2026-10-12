import { useEffect, useState } from "react";
import { CircleX, Copy, Minus } from "lucide-react";
import { Quit, WindowMinimise, WindowIsMaximised, WindowToggleMaximise } from "../../../wailsjs/runtime/runtime";

const controlButtonClass = `
  inline-flex h-8 w-8 items-center justify-center
  rounded-full cursor-pointer
  text-gray-400 hover:bg-white/10 hover:text-white
  hover:scale-95 transition
`;

export function useWindowMaximise() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    WindowIsMaximised().then(setMaximized);
  }, []);

  const toggleMaximise = async () => {
    await WindowToggleMaximise();
    setMaximized(await WindowIsMaximised());
  };

  return { maximized, toggleMaximise };
}

interface WindowControlsProps {
  maximized: boolean;
  onToggleMaximise: () => void;
}

export function WindowControls({ maximized, onToggleMaximise }: WindowControlsProps) {
  return (
    <div className="appframe-no-drag shrink-0 flex items-center gap-1.5 px-2" onDoubleClick={event => event.stopPropagation()}>
      <button onClick={() => WindowMinimise()} className={controlButtonClass} aria-label="Minimizar" title="Minimizar">
        <Minus className="w-5 h-5" />
      </button>

      <button
        onClick={onToggleMaximise}
        className={controlButtonClass}
        title={maximized ? "Restaurar" : "Maximizar"}
        aria-label={maximized ? "Restaurar" : "Maximizar"}
      >
        <Copy className="w-4 h-4 rotate-90" />
      </button>

      <button
        onClick={() => Quit()}
        title="Fechar"
        aria-label="Fechar"
        className="
          inline-flex h-8 w-8 items-center justify-center
          rounded-full cursor-pointer
          text-red-400/80
          hover:bg-red-500/20 hover:text-red-300 hover:scale-95
          transition
        "
      >
        <CircleX className="w-5 h-5" />
      </button>
    </div>
  );
}

export function AuthWindowBar() {
  const { maximized, toggleMaximise } = useWindowMaximise();

  return (
    <div
      onDoubleClick={toggleMaximise}
      className="appframe-drag fixed top-0 inset-x-0 z-50 h-10 flex items-center justify-end select-none"
    >
      <WindowControls maximized={maximized} onToggleMaximise={toggleMaximise} />
    </div>
  );
}
