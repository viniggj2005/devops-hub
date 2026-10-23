import React from 'react';
import { LogOut } from 'lucide-react';
import { navItems } from './SidebarItems';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../appFrame/AppStore';
import ToggleThemeButton from '../buttons/ToggleThemeButton';
import { useDockerClient } from '../../../../contexts/DockerClientContext';
import { SidebarProps } from '../../../../interfaces/SharedInterfaces';
import DockerCredentialSelector from '../../../docker-module/dockerCredentials/components/DockerCredentialSelector';

const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const { setActiveTab } = useAppStore();
  const { connecting, dockerClientId } = useDockerClient();

  const statusColor = connecting
    ? 'bg-amber-400 animate-pulse'
    : dockerClientId != null
      ? 'bg-emerald-500'
      : 'bg-zinc-400 dark:bg-zinc-600';

  const statusTitle = connecting
    ? 'Conectando ao daemon Docker...'
    : dockerClientId != null
      ? 'Conectado ao daemon Docker'
      : 'Nenhuma credencial ativa';

  return (
    <nav className="h-16 shrink-0 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-40 px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 lg:gap-6 min-w-0">
        <button
          type="button"
          onClick={() => navigate('/docker/home')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <img src="/docker-manager.svg" alt="Docker Manager" className="w-5 h-5 brightness-0 invert" />
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent hidden xl:inline">
            Docker Manager
          </span>
        </button>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/5 overflow-x-auto no-scrollbar">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-2" title={statusTitle}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
          <DockerCredentialSelector variant="navbar" />
        </div>

        <ToggleThemeButton />

        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all group cursor-pointer"
          title="Voltar ao Console"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden xl:inline">Voltar</span>
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;
