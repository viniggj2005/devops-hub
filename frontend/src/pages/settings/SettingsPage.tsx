import React, { useState } from 'react';
import ModuleThemeSettings from '../../features/settings/components/ModuleThemeSettings';
import HomeModulesSettings from '../../features/settings/components/HomeModulesSettings';
import { GitBranch, LayoutGrid, LucideIcon, Palette, SquareTerminal } from 'lucide-react';
import TerminalThemeSettings from '../../features/settings/components/TerminalThemeSettings';
import OctohubColorsSettings from '../../features/settings/components/OctohubColorsSettings';

type SettingsSection = 'home-modules' | 'module-theme' | 'terminal-theme' | 'octohub-colors';

const sections: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: 'module-theme', label: 'Tema por módulo', icon: Palette },
  { id: 'home-modules', label: 'Módulos na Home', icon: LayoutGrid },
  { id: 'octohub-colors', label: 'Cores do OctoHub', icon: GitBranch },
  { id: 'terminal-theme', label: 'Terminal (FerretShell)', icon: SquareTerminal },
];

const sectionContent: Record<SettingsSection, React.ReactNode> = {
  'module-theme': <ModuleThemeSettings />,
  'home-modules': <HomeModulesSettings />,
  'terminal-theme': <TerminalThemeSettings />,
  'octohub-colors': <OctohubColorsSettings />,
};

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('home-modules');

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-white">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">Personalize a tela inicial e a aparência de cada módulo.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          <nav className="md:w-56 shrink-0 flex flex-wrap md:flex-col gap-1">
            {sections.map(section => {
              const SectionIcon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <button
                  type="button"
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-left transition-colors ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/5'}`}
                >
                  <SectionIcon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>

          <main className="flex-1 min-w-0">
            {sectionContent[activeSection]}
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
