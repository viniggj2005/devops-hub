import './index.css';
import { useEffect, useState } from 'react';
import MainHomePage from './pages/MainHomePage';
import { AppFrame } from './features/appFrame/appFrame';
import { useAppStore } from './features/appFrame/AppStore';
import FerretShellHomePage from './pages/FerretShellHomePage';
import FerretShellShell from './features/ferretShell-module/components/FerretShellShell';
import DockerModuleWrapper from './features/docker-module/components/DockerModuleWrapper';
import { WindowIsFullscreen, WindowFullscreen, WindowUnfullscreen, WindowIsMaximised, WindowUnmaximise } from '../wailsjs/runtime/runtime';

export default function App() {
  const { tabs, activeTabId } = useAppStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleResize = async () => {
      const fs = await WindowIsFullscreen();
      setIsFullscreen(fs);
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        const fs = await WindowIsFullscreen();
        if (fs) {
          await WindowUnfullscreen();
          setIsFullscreen(false);
        } else {
          setIsFullscreen(true);
          const isMax = await WindowIsMaximised();
          if (isMax) {
            await WindowUnmaximise();
          }
          await WindowFullscreen();
        }
      } else if (e.key === 'Escape') {
        const fs = await WindowIsFullscreen();
        if (fs) {
          await WindowUnfullscreen();
          setIsFullscreen(false);
        }
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const renderTabContent = (type: string) => {
    switch (type) {
      case 'home':
        return <MainHomePage />;
      case 'docker':
        return <DockerModuleWrapper />;
      case 'ferretshell':
        return (
          <FerretShellShell>
            <FerretShellHomePage />
          </FerretShellShell>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {!isFullscreen && <AppFrame />}

      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`absolute inset-0 w-full h-full ${isActive ? 'block z-10' : 'hidden z-0'}`}
            >
              {renderTabContent(tab.type)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
