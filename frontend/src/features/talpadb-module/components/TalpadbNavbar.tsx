import React from 'react';
import { useTalpadbStore } from '../TalpadbStore';
import { useAppStore } from '../../appFrame/AppStore';
import { Home, LayoutPanelLeft, LogOut } from 'lucide-react';
import { TALPADB_MODULE, TalpadbModuleIcon } from '../moduleInfo';
import type { TalpadbView } from '../../../interfaces/TalpadbInterfaces';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';

const TalpadbNavbar: React.FC = () => {
  const { setActiveTab } = useAppStore();
  const { view, setView, tabs } = useTalpadbStore();

  const links: { view: TalpadbView; label: string; icon: typeof Home; badge?: number }[] = [
    { view: 'home', label: 'Início', icon: Home },
    { view: 'workspace', label: 'Workspace', icon: LayoutPanelLeft, badge: tabs.length },
  ];

  return (
    <nav className="h-16 flex-shrink-0 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-8 min-w-0">
        <button
          onClick={() => setView('home')}
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

        <div className="flex items-center gap-1">
          {links.map(({ view: linkView, label, icon: Icon, badge }) => (
            <button
              key={linkView}
              onClick={() => setView(linkView)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                view === linkView
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {!!badge && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[11px] font-bold flex items-center justify-center">
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
