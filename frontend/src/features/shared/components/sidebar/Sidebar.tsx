import React from 'react';
import { navItems } from './SidebarItems';
import { NavLink } from 'react-router-dom';
import appIcon from '../../../../assets/images/appicon.png';
import ToggleThemeButton from '../buttons/ToggleThemeButton';
import { ChevronLeft, ChevronRight, CircleX } from 'lucide-react';
import { SidebarProps } from '../../../../interfaces/SharedInterfaces';
import DockerCredentialSelector from '../../../docker-module/dockerCredentials/components/DockerCredentialSelector';

const Sidebar: React.FC<SidebarProps> = ({ open, collapsed, onClose, onToggleCollapse }) => {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30  transition-opacity duration-200 lg:hidden  ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        className={`
    z-40 flex w-72 transform flex-col overflow-y-auto px-6 py-8
    shadow-sm transition-transform duration-200
    
     bg-gradient-to-br dark:from-slate-900 dark:via-blue-900 dark:to-slate-700 from-gray-50 via-blue-50 to-purple-50

    fixed inset-y-0 left-0          
    lg:static lg:h-full lg:inset-auto

    lg:translate-x-0
    ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    ${collapsed ? 'lg:px-4' : 'lg:px-6'}
    ${collapsed ? 'lg:w-24 xl:w-28' : 'lg:w-72'}
  `}
      >

        <div className="flex items-center justify-between  gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`hidden h-12 w-12 items-center justify-center rounded-2xl  text-lg font-semibold text-blue-600 dark:border-white/10 dark:text-blue-600 lg:flex ${collapsed ? '' : 'lg:hidden'
                }`}
            >
              <img src={appIcon} alt="Docker Manager" className="h-16 w-16 object-contain" />
            </div>
            <div className={`${collapsed ? 'lg:hidden' : ''}`}>
              <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-zinc-400">
                Docker Manager
              </span>
              <h1 className="mt-2 text-2xl font-semibold">Painel</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition hover:bg-white/60 dark:border-white/10 dark:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <CircleX className="h-5 w-5" />
          </button>

          <button
            onClick={onToggleCollapse}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition hover:bg-white/60 dark:border-white/10 dark:text-white lg:inline-flex"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav
          className={`flex-1 overflow-y-auto px-3   ${collapsed ? 'lg:items-center lg:gap-3' : ''}`}
          aria-label="Menu principal"
        >
          {navItems.map(({ label, description, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              title={label}
              className={({ isActive }) =>
                `w-full flex items-start gap-3 p-3 rounded-lg mb-1 group-hover:bg-gray-200 dark:group-hover:bg-white/10 transition-colors ${collapsed
                  ? 'lg:w-full lg:justify-center lg:px-2'
                  : ''
                } ${isActive && !collapsed
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 shadow-lg shadow-blue-500/10 dark:from-blue-500/20 dark:to-purple-500/20  dark:shadow-blue-500/10 text-black dark:text-white'
                  : isActive && collapsed ? 'text-black dark:text-white' : 'text-gray-500 hover:bg-gray-50 dark:text-white dark:hover:bg-white/10'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-2 rounded-lg transition-all 
                ${isActive ? 'bg-gradient-to-br dark:from-blue-500 dark:to-purple-600 from-blue-400 to-purple-500 text-white' : 'text-gray-600 dark:text-gray-300'} `}>
                    <Icon className="h-5 w-5 " />
                  </div>

                  <div className={`flex flex-col ${collapsed ? 'lg:hidden' : ''}`}>
                    <span className="font-semibold text-current">{label}</span>
                    <span className="text-xs mt-0.5 text-gray-500 dark:text-zinc-400">
                      {description}
                    </span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={`mt-6 ${collapsed ? 'lg:hidden' : ''}`}>
          <h4 className={` text-black dark:text-white ${collapsed ? 'lg:hidden' : ''}`}>
            Credencial ativa
          </h4>
          <p className={`text-xs text-gray-500 dark:text-zinc-400 ${collapsed ? 'lg:hidden' : ''}`}>
            Escolha qual credencial Docker usar nas demais telas.
          </p>
          <div className={` ${collapsed ? 'lg:hidden' : ''}`}>
            <DockerCredentialSelector variant="default" />
          </div>
        </div>

        <div
          className={`mt-6 rounded-xl  ${collapsed
            ? 'lg:flex lg:flex-col lg:items-center lg:gap-2 lg:p-3'
            : ''
            }`}
        >
          <h2
            className={`text-sm font-semibold text-black dark:text-white ${collapsed ? 'lg:hidden' : ''
              }`}
          >
            Tema
          </h2>
          <p
            className={`mt-1 text-xs text-gray-500 dark:text-zinc-400 ${collapsed ? 'lg:hidden' : ''
              }`}
          >
            Alterne entre os modos claro e escuro para personalizar sua experiência.
          </p>
          <div className={`mt-3 ${collapsed ? 'lg:mt-0' : ''}`}>
            <ToggleThemeButton />
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
