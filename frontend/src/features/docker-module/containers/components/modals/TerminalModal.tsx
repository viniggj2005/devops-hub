import React from 'react';
import { X } from 'lucide-react';
import ContainerTerminal from '../terminal/ContainerTerminal';

interface TerminalModalProps {
  id: string;
  name: string;
  onClose: () => void;
}

const TerminalModal: React.FC<TerminalModalProps> = ({ id, name, onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative flex h-full max-h-[800px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e172a] shadow-2xl animate-in zoom-in-95 duration-300">

        <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/50 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <span className="text-xs font-bold">TTY</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Terminal: {name}</h3>
              <p className="text-[10px] text-gray-400 font-mono opacity-60">{id.substring(0, 12)}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ContainerTerminal
            instance={{
              id: `term-${id}`,
              title: `Terminal: ${name}`,
              containerId: id,
              containerName: name
            }}
          />
        </div>

        <div className="flex items-center justify-between border-t border-white/5 bg-slate-900/30 px-5 py-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-gray-400">Conectado</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 font-mono">
            /bin/sh -c [ -x /bin/bash ] && exec /bin/bash || exec /bin/sh
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalModal;
