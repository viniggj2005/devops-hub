import React from 'react';
import { CircleX, Copy, Minus, Pin, PinOff, Terminal } from 'lucide-react';
import { TerminalHeaderProps } from '../../../../../interfaces/TerminalInterfaces';

const TerminalModalHeader: React.FC<TerminalHeaderProps> = ({
  title,
  docked,
  onClose,
  maximized,
  onMinimize,
  onToggleMax,
  onToggleDock,
}) => {
  return (
    <div
      className={`flex items-center justify-between px-6 ${docked ? 'py-1' : 'py-4'}  bg-gradient-to-r from-purple-500/60 to-pink-500/10`}
    >
      {!docked && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Terminal className="w-5 h-5 text-white" />
          </div>

          <div>
            <h2 className="text-white">{title}</h2>
            <p className="text-xs text-white dark:text-purple-300/70 mt-0.5">Modal • Terminal</p>
          </div>
        </div>)}

      <div className="ml-auto flex items-center gap-3">
        {!maximized && (
          <button
            onClick={onToggleDock}
            className="dark:text-zinc-400 text-white hover:scale-95 text-xs px-2 py-1 rounded border border-transparent"
            title={docked ? 'Desancorar (modal)' : 'Ancorar embaixo (painel)'}
            type="button"
          >
            {docked ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
          </button>
        )}

        {!maximized && (
          <button
            onClick={onMinimize}
            className="dark:text-zinc-400 text-white hover:scale-95"
            title="Minimizar"
            type="button"
          >
            <Minus className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={onToggleMax}
          className="dark:text-zinc-400 text-white hover:scale-95"
          title={maximized ? 'Restaurar' : 'Tela cheia'}
          type="button"
        >
          {maximized ? <Copy className="w-5 h-5 rotate-90" /> : !docked ? <Copy className="w-5 h-5 rotate-90" /> : <></>}
        </button>

        <button
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center
                      rounded-full text-red-600
                      hover:bg-red-600 hover:text-white hover:scale-95 transition"
          aria-label="Fechar"
        >
          <CircleX className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TerminalModalHeader;
