import './index.css';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppFrame } from './features/appFrame/appFrame';
import AppShell from './features/shared/components/sidebar/AppShell';
import GlobalTerminalHost from './features/terminal/GlobalTerminalHost';
import { WindowIsFullscreen, WindowFullscreen, WindowUnfullscreen, WindowIsMaximised, WindowUnmaximise } from '../wailsjs/runtime/runtime';

const noShellRoutes = ['/login', '/create-account', '/home'];

export default function App() {
  const location = useLocation();
  const isNoShellRoute = noShellRoutes.includes(location.pathname);

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

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {!isFullscreen && <AppFrame />}

      <GlobalTerminalHost />

      <div className="flex-1 min-h-0">
        {isNoShellRoute ? (
          <Outlet />
        ) : (
          <AppShell>
            <Outlet />
          </AppShell>
        )}
      </div>
    </div>
  );
}
