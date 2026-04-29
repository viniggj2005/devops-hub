import './index.css';
import { useEffect, useState } from 'react';
import MainHomePage from './pages/MainHomePage';
import { AppFrame } from './features/appFrame/appFrame';
import { useAppStore } from './features/appFrame/AppStore';
import DockerModuleWrapper from './features/docker-module/components/DockerModuleWrapper';
import FerretShellModuleWrapper from './features/ferretShell-module/components/FerretShellModuleWrapper';
import { WindowIsFullscreen, WindowFullscreen, WindowUnfullscreen, WindowIsMaximised, WindowUnmaximise } from '../wailsjs/runtime/runtime';

export default function App() {
  const { tabs, activeTabId } = useAppStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleResize = async () => {
      const fullscreen = await WindowIsFullscreen();
      setIsFullscreen(fullscreen);
    };

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        const fullscreen = await WindowIsFullscreen();
        if (fullscreen) {
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
      } else if (event.key === 'Escape') {
        const fullscreen = await WindowIsFullscreen();
        if (fullscreen) {
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
        return <FerretShellModuleWrapper />;
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
