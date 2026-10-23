import React from 'react';
import { useVulpesStore } from '../VulpesStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../appFrame/AppStore';
import { Globe2, LogOut, Settings2 } from 'lucide-react';
import Select from '../../shared/components/forms/Select';
import { VULPES_MODULE, VulpesModuleIcon } from '../moduleInfo';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';

const VulpesNavbar: React.FC<{ onManageEnvironments: () => void }> = ({ onManageEnvironments }) => {
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const { environments, activeEnvironmentId, setActiveEnvironment } = useVulpesStore(
    useShallow((state) => ({
      environments: state.environments,
      activeEnvironmentId: state.activeEnvironmentId,
      setActiveEnvironment: state.setActiveEnvironment,
    }))
  );

  const environmentOptions = [
    { value: '', label: 'Sem ambiente' },
    ...environments.map((environment) => ({ value: String(environment.id), label: environment.name })),
  ];

  return (
    <nav className="h-16 flex-shrink-0 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 bg-gradient-to-br ${VULPES_MODULE.gradient} rounded-xl shadow-lg shadow-amber-500/20`}>
          <VulpesModuleIcon className="w-6 h-6 text-white" />
        </div>
        <div className="hidden sm:flex flex-col leading-tight min-w-0">
          <span className={`text-xl font-bold tracking-tight bg-gradient-to-r ${VULPES_MODULE.textGradient} bg-clip-text text-transparent`}>
            {VULPES_MODULE.name}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">{VULPES_MODULE.tagline}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 pl-4">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-amber-500" />
          <Select
            variant="navbar"
            aria-label="Ambiente ativo"
            options={environmentOptions}
            value={activeEnvironmentId ? String(activeEnvironmentId) : ''}
            onChange={(value) => setActiveEnvironment(value ? Number(value) : null)}
          />
          <button
            type="button"
            title="Gerenciar ambientes"
            onClick={onManageEnvironments}
            className="p-2 rounded-xl text-gray-500 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
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

export default VulpesNavbar;
