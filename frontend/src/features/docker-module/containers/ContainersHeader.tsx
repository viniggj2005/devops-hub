import React from 'react';
import { RefreshCw } from 'lucide-react';

const ContainersHeader: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => (
  <header className="mb-4 flex items-center justify-between">
    <h1 className="text-2xl font-semibold text-black dark:text-white">
      Containers
    </h1>
    <button
      onClick={onRefresh}
      className="inline-flex items-center hover:scale-95  gap-2 px-3 py-2 rounded-xl 
      transition bg-white text-black dark:bg-zinc-900 dark:text-zinc-400
        border border-gray-300 dark:border-white/10 "
      title="Atualizar"
    >
      <RefreshCw className="h-4 w-4" />
      <span>Atualizar</span>
    </button>
  </header>
);

export default ContainersHeader;
