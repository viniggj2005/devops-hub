import React from 'react';
import { Box, Laptop, Terminal, GitBranch, SquareTerminal } from 'lucide-react';
import { LocalShell, LocalShellKind } from '../../../../interfaces/TerminalInterfaces';

interface LocalShellListProps {
  loading: boolean;
  shells: LocalShell[];
  onOpen: (shell: LocalShell) => void;
}

const shellIcons: Record<LocalShellKind, React.ElementType> = {
  wsl: Box,
  cmd: Terminal,
  unix: Laptop,
  gitbash: GitBranch,
  powershell: SquareTerminal,
};

const LocalShellList: React.FC<LocalShellListProps> = ({ shells, loading, onOpen }) => {
  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-zinc-400">Detectando terminais locais...</p>;
  }

  if (!shells.length) {
    return <p className="text-sm text-gray-500 dark:text-zinc-400">Nenhum terminal local encontrado.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {shells.map(shell => {
        const ShellIcon = shellIcons[shell.kind] ?? SquareTerminal;
        return (
          <button
            key={shell.id}
            type="button"
            onClick={() => onOpen(shell)}
            title={`Abrir ${shell.name}`}
            className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl dark:border-white/5 dark:bg-[#0f172a]/80"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShellIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-gray-900 dark:text-white">{shell.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Abrir em nova aba</p>
            </div>
            {shell.isDefault && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Padrão
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LocalShellList;
