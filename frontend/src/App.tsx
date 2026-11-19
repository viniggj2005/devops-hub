import './index.css';
import MainHomePage from './pages/MainHomePage';
import { Events, Window } from '@wailsio/runtime';
import { AppFrame } from './features/appFrame/appFrame';
import { tabTitle } from './features/appFrame/TabTitle';
import { useTranslation } from './features/i18n/useTranslation';
import { windowInstanceId } from './features/appFrame/WindowContext';
import { ModuleType, useAppStore } from './features/appFrame/AppStore';
import { TabVisibilityContext } from './features/appFrame/TabVisibility';
import { useUpdateNotifier } from './features/shared/hooks/useUpdateNotifier';
import { languageChangedEvent, useLanguageStore } from './features/i18n/LanguageStore';
import { ComponentType, Suspense, lazy, memo, useEffect, useMemo, useState } from 'react';
import { applyOctohubColorVariables } from './features/settings/functions/OctohubColorVariables';
import { generalConfigsChangedEvent, useGeneralConfigsStore } from './features/settings/store/GeneralConfigsStore';

const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const VulpesModuleWrapper = lazy(() => import('./features/vulpes-module/components/VulpesModuleWrapper'));
const DockerModuleWrapper = lazy(() => import('./features/docker-module/components/DockerModuleWrapper'));
const OctohubModuleWrapper = lazy(() => import('./features/octohub-module/components/OctohubModuleWrapper'));
const TalpadbModuleWrapper = lazy(() => import('./features/talpadb-module/components/TalpadbModuleWrapper'));
const FerretShellModuleWrapper = lazy(() => import('./features/ferretShell-module/components/FerretShellModuleWrapper'));

const fullscreenSyncDelayMs = 150;

const tabComponents: Record<ModuleType, ComponentType> = {
  home: MainHomePage,
  settings: SettingsPage,
  vulpes: VulpesModuleWrapper,
  docker: DockerModuleWrapper,
  octohub: OctohubModuleWrapper,
  talpadb: TalpadbModuleWrapper,
  ferretshell: FerretShellModuleWrapper,
};

interface ModuleTabPanelProps {
  type: ModuleType;
  isActive: boolean;
}

const ModuleTabPanel = memo(({ type, isActive }: ModuleTabPanelProps) => {
  const TabComponent = tabComponents[type];
  if (!TabComponent) return null;

  return (
    <div className={`absolute inset-0 w-full h-full ${isActive ? 'block z-10' : 'hidden z-0'}`}>
      <TabVisibilityContext.Provider value={isActive}>
        <Suspense fallback={null}>
          <TabComponent />
        </Suspense>
      </TabVisibilityContext.Provider>
    </div>
  );
});

export default function App() {
  const { dictionary } = useTranslation();
  const tabs = useAppStore(state => state.tabs);
  const activeTabId = useAppStore(state => state.activeTabId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const loadGeneralConfigs = useGeneralConfigsStore(state => state.load);
  const resetGeneralConfigs = useGeneralConfigsStore(state => state.reset);
  const applyLanguage = useLanguageStore(state => state.applyLanguage);
  const octohubColors = useGeneralConfigsStore(state => state.octohubColors);

  useUpdateNotifier();

  useEffect(() => {
    loadGeneralConfigs();
    return resetGeneralConfigs;
  }, [loadGeneralConfigs, resetGeneralConfigs]);

  useEffect(() => Events.On(generalConfigsChangedEvent, ({ data: originWindowId }) => {
    if (originWindowId !== windowInstanceId) loadGeneralConfigs();
  }), [loadGeneralConfigs]);

  useEffect(() => Events.On(languageChangedEvent, ({ data }) => {
    if (data?.originWindowId !== windowInstanceId) applyLanguage(data?.language);
  }), [applyLanguage]);

  useEffect(() => applyOctohubColorVariables(octohubColors), [octohubColors]);

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const windowTitle = activeTab && activeTab.type !== 'home' ? `Devops Hub · ${tabTitle(activeTab, dictionary)}` : 'Devops Hub';

  useEffect(() => {
    Window.SetTitle(windowTitle);
  }, [windowTitle]);

  useEffect(() => {
    let resizeTimeout: number | undefined;

    const syncFullscreen = async () => {
      const fullscreen = await Window.IsFullscreen();
      setIsFullscreen(fullscreen);
    };

    const handleResize = () => {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(syncFullscreen, fullscreenSyncDelayMs);
    };

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        const fullscreen = await Window.IsFullscreen();
        if (fullscreen) {
          await Window.UnFullscreen();
          setIsFullscreen(false);
        } else {
          setIsFullscreen(true);
          const isMaximised = await Window.IsMaximised();
          if (isMaximised) {
            await Window.UnMaximise();
          }
          await Window.Fullscreen();
        }
      } else if (event.key === 'Escape') {
        const fullscreen = await Window.IsFullscreen();
        if (fullscreen) {
          await Window.UnFullscreen();
          setIsFullscreen(false);
        }
      }
    };

    syncFullscreen();

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {!isFullscreen && <AppFrame />}

      <div className="flex-1 min-h-0 relative">
        {tabs.map(tab => (
          <ModuleTabPanel key={tab.id} type={tab.type} isActive={tab.id === activeTabId} />
        ))}
      </div>
    </div>
  );
}
