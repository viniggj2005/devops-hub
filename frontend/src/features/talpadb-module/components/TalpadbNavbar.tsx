import React from 'react';
import { useTalpadbStore } from '../TalpadbStore';
import { useAppStore } from '../../appFrame/AppStore';
import { Server, LayoutPanelLeft, LogOut } from 'lucide-react';
import { TALPADB_MODULE, TalpadbModuleIcon } from '../moduleInfo';
import type { TalpadbView } from '../../../interfaces/TalpadbInterfaces';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';

const TalpadbNavbar: React.FC = () => {
  const { setActiveTab } = useAppStore();
  const { view, setView, tabs, connections } = useTalpadbStore();

  const links: { view: TalpadbView; label: string; icon: typeof Server; badge?: number }[] = [
    { view: 'workspace', label: 'Workspace', icon: LayoutPanelLeft, badge: tabs.length },
    { view: 'home', label: 'Servidores', icon: Server, badge: connections.length },
  ];

  return (
    <nav className="h-16 flex-shrink-0 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-6 min-w-0">
        <button
          onClick={() => setView('workspace')}
          className="flex items-center gap-3 cursor-pointer group flex-shrink-0"
        >
          <div
            className={`p-2 bg-gradient-to-br ${TALPADB_MODULE.gradient} rounded-xl shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform`}
          >
            <TalpadbModuleIcon className="w-6 h-6 text-white" />
          </div>
          <span
            className={`text-xl font-bold tracking-tight bg-gradient-to-r ${TALPADB_MODULE.textGradient} bg-clip-text text-transparent hidden sm:inline`}
          >
            {TALPADB_MODULE.name}
          </span>
        </button>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/5">
          {links.map(({ view: linkView, label, icon: Icon, badge }) => (
            <button
              key={linkView}
              onClick={() => setView(linkView)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                view === linkView
                  ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {!!badge && (
                <span className="min-w-[18px] h-4 px-1 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 pl-4">
        <ToggleThemeButton />
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all group"
          title="Voltar ao Console"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden xl:inline">Voltar</span>
        </button>
      </div>
    </nav>
  );
};

export default TalpadbNavbar;
