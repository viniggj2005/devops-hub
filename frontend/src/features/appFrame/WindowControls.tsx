import { Window } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { isDetachedWindow } from "./WindowContext";
import { CircleX, Copy, Minus } from "lucide-react";

const closeLabel = isDetachedWindow ? "Fechar janela" : "Fechar";

const controlButtonClass = `
  inline-flex h-8 w-8 items-center justify-center
  rounded-full cursor-pointer
  text-gray-400 hover:bg-white/10 hover:text-white
  hover:scale-95 transition
`;

export function useWindowMaximise() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    Window.IsMaximised().then(setMaximized);
  }, []);

  const toggleMaximise = async () => {
    await Window.ToggleMaximise();
    setMaximized(await Window.IsMaximised());
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
      <button onClick={() => Window.Minimise()} className={controlButtonClass} aria-label="Minimizar" title="Minimizar">
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
        onClick={() => Window.Close()}
        title={closeLabel}
        aria-label={closeLabel}
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
