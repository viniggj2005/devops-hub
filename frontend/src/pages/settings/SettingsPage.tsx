import toast from 'react-hot-toast';
import { Events } from '@wailsio/runtime';
import React, { useEffect, useState } from 'react';
import { useAppVersion } from '../../features/shared/hooks/useAppVersion';
import CloudSyncSettings from '../../features/settings/components/CloudSyncSettings';
import ModuleThemeSettings from '../../features/settings/components/ModuleThemeSettings';
import HomeModulesSettings from '../../features/settings/components/HomeModulesSettings';
import ThemeProfilesSettings from '../../features/settings/components/ThemeProfilesSettings';
import TerminalThemeSettings from '../../features/settings/components/TerminalThemeSettings';
import OctohubColorsSettings from '../../features/settings/components/OctohubColorsSettings';
import SqlEditorThemeSettings from '../../features/settings/components/SqlEditorThemeSettings';
import {
  CheckForUpdates,
  GetAvailableUpdate,
  ApplyAvailableUpdate,
} from '../../../bindings/docker-manager-go/app';
import {
  Cloud,
  Palette,
  Database,
  Download,
  GitBranch,
  RefreshCw,
  LayoutGrid,
  LucideIcon,
  SwatchBook,
  CheckCircle2,
  SquareTerminal,
} from 'lucide-react';

type SettingsSection =
  | 'cloud-sync'
  | 'home-modules'
  | 'module-theme'
  | 'theme-profiles'
  | 'terminal-theme'
  | 'octohub-colors'
  | 'sql-editor-theme';

const sections: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: 'module-theme', label: 'Tema por módulo', icon: Palette },
  { id: 'home-modules', label: 'Módulos na Home', icon: LayoutGrid },
  { id: 'theme-profiles', label: 'Perfis de tema', icon: SwatchBook },
  { id: 'octohub-colors', label: 'Cores do OctoHub', icon: GitBranch },
  { id: 'sql-editor-theme', label: 'Editor SQL (TalpaDB)', icon: Database },
  { id: 'terminal-theme', label: 'Terminal (FerretShell)', icon: SquareTerminal },
  { id: 'cloud-sync', label: 'Backup na nuvem', icon: Cloud },
];

const sectionContent: Record<SettingsSection, React.ReactNode> = {
  'cloud-sync': <CloudSyncSettings />,
  'module-theme': <ModuleThemeSettings />,
  'home-modules': <HomeModulesSettings />,
  'theme-profiles': <ThemeProfilesSettings />,
  'terminal-theme': <TerminalThemeSettings />,
  'octohub-colors': <OctohubColorsSettings />,
  'sql-editor-theme': <SqlEditorThemeSettings />,
};

const UPDATE_AVAILABLE_EVENT = 'app:update-available';

const SettingsPage: React.FC = () => {
  const appVersion = useAppVersion();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [updateInstalled, setUpdateInstalled] = useState(false);
  const [availableVersion, setAvailableVersion] = useState<string>('');
  const [activeSection, setActiveSection] = useState<SettingsSection>('home-modules');

  useEffect(() => {
    GetAvailableUpdate()
      .then((version) => {
        if (version) setAvailableVersion(version);
      })
      .catch(() => undefined);

    return Events.On(UPDATE_AVAILABLE_EVENT, ({ data: version }) => {
      if (version) setAvailableVersion(String(version));
    });
  }, []);

  const handleCheckUpdates = async () => {
    if (checkingUpdate || applyingUpdate) return;
    setCheckingUpdate(true);
    try {
      const updateMessage = await CheckForUpdates();
      const pendingVersion = await GetAvailableUpdate();
      if (pendingVersion) {
        setAvailableVersion(pendingVersion);
      }
      if (updateMessage.includes('já instalada')) {
        setUpdateInstalled(true);
      }
      toast.success(updateMessage);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao verificar atualização: ${errorText}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (applyingUpdate || !availableVersion) return;
    setApplyingUpdate(true);
    try {
      await ApplyAvailableUpdate();
      setAvailableVersion('');
      setUpdateInstalled(true);
      toast.success('Atualização instalada! Reinicie o aplicativo para usar a nova versão.');
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao instalar atualização: ${errorText}`);
    } finally {
      setApplyingUpdate(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-white">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                v{appVersion}
              </span>
            </div>
            <p className="text-gray-500 dark:text-zinc-400 mt-1">Personalize a tela inicial, a aparência de cada módulo e o backup na nuvem.</p>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-56 shrink-0 flex flex-col gap-4">
            <nav className="flex flex-wrap md:flex-col gap-1">
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

            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-600 dark:text-zinc-400">Versão do App</span>
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                  v{appVersion}
                </span>
              </div>

              {updateInstalled ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Atualizado! Reinicie o app para aplicar.</span>
                </div>
              ) : availableVersion ? (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      Nova versão:
                    </span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                      v{availableVersion}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUpdate}
                    disabled={applyingUpdate}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {applyingUpdate ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Instalando...
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        Atualizar para v{availableVersion}
                      </>
                    )}
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleCheckUpdates}
                disabled={checkingUpdate || applyingUpdate || updateInstalled}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-zinc-200 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdate ? 'animate-spin text-blue-500' : 'text-blue-500'}`} />
                {checkingUpdate ? 'Verificando...' : 'Verificar atualização'}
              </button>
            </div>
          </div>

          <main className="flex-1 min-w-0">
            {sectionContent[activeSection]}
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
